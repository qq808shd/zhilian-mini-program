// FSRS-6 memory equations and the published default parameters, implemented here
// without a runtime dependency. Algorithm: Jarrett Ye / Open Spaced Repetition.
// https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
// Numerical bounds / post-lapse cap also checked against:
// https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/algorithm.ts
// Formula reference verified 2026-09-07. This is a population-default model,
// not a fitted prediction of an individual learner's actual forgetting rate.
const VERSION = 6;
const DAY = 86400000;
const OFFSET = 8 * 3600000;
const RETENTION = 0.9;
const PARAMETERS = Object.freeze([0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334,
  3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
  0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]);
const MIN_STABILITY = 0.001;
const MAX_INTERVAL = 36500;
const grades = Object.freeze({ none: 1, fuzzy: 2, remembered: 3 });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dayNumber = (at) => Math.floor((at + OFFSET) / DAY);
const factor = Math.pow(RETENTION, -1 / PARAMETERS[20]) - 1;

function grade(rating) {
  if (!Object.prototype.hasOwnProperty.call(grades, rating)) throw new Error('Unknown memory rating');
  return grades[rating];
}
function initialDifficulty(g) {
  return PARAMETERS[4] - Math.exp(PARAMETERS[5] * (g - 1)) + 1;
}
function initial(rating, at) {
  const g = grade(rating);
  return { version: VERSION, stability: PARAMETERS[g - 1], difficulty: clamp(initialDifficulty(g), 1, 10),
    lastReviewAt: at, reviews: 1, lapses: 0 };
}
function retrievability(memory, at) {
  if (!memory || !(memory.stability > 0)) return null;
  const elapsed = Math.max(0, (at - memory.lastReviewAt) / DAY);
  return Math.pow(1 + factor * elapsed / memory.stability, -PARAMETERS[20]);
}
function intervalDays(memory, retention = RETENTION) {
  if (!(retention > 0 && retention <= 1)) throw new Error('Retention must be in (0, 1]');
  return memory.stability / factor * (Math.pow(retention, -1 / PARAMETERS[20]) - 1);
}
function nextReviewAt(memory) {
  // Product policy: daily scheduling, no automatic same-day relearning. Rounding
  // to a Beijing calendar date means the actual recall target is approximate.
  const days = clamp(Math.round(intervalDays(memory)), 1, MAX_INTERVAL);
  return (dayNumber(memory.lastReviewAt) + days) * DAY - OFFSET;
}
function review(memory, rating, at) {
  const g = grade(rating);
  if (!memory || !(memory.stability > 0)) return initial(rating, at);
  // Replay is chronological. Refuse a backwards timestamp so a stale event
  // cannot move the memory clock or scheduled review into the past.
  if (at < memory.lastReviewAt) return { ...memory };
  const w = PARAMETERS, s = memory.stability, d = memory.difficulty;
  const r = retrievability(memory, at);
  let stability;
  if (dayNumber(at) === dayNumber(memory.lastReviewAt)) {
    let increase = Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
    if (g >= 2) increase = Math.max(increase, 1);
    stability = s * increase;
  } else if (g === 1) {
    const forgotten = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
    // With short-term updates enabled, cap the post-lapse memory as specified
    // by the FSRS implementation reference; a failure cannot increase stability.
    stability = Math.min(forgotten, s / Math.exp(w[17] * w[18]));
  } else {
    const hardPenalty = g === 2 ? w[15] : 1;
    stability = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9])
      * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty);
  }
  const damped = d - w[6] * (g - 3) * (10 - d) / 9;
  const difficulty = clamp(w[7] * initialDifficulty(4) + (1 - w[7]) * damped, 1, 10);
  return { version: VERSION, stability: clamp(stability, MIN_STABILITY, MAX_INTERVAL), difficulty,
    lastReviewAt: at, reviews: (memory.reviews || 0) + 1,
    lapses: (memory.lapses || 0) + (g === 1 ? 1 : 0) };
}

// App semantics: 陌生 = failed recall (Again), 了解 = partial/effortful recall
// (Hard), 掌握 = successful recall (Good). Reading-time self-report is an
// approximation; 熟知 is a separate opt-out and is never the FSRS Easy grade.
module.exports = { VERSION, PARAMETERS, RETENTION, DAY, initial, review, retrievability, intervalDays, nextReviewAt };
