const test = require('node:test');
const assert = require('node:assert/strict');
const scheduler = require('../miniprogram/utils/memoryScheduler');
const model = require('../miniprogram/utils/learningModel');

const at = Date.parse('2026-09-07T04:00:00Z');
const event = (id, kind, extra = {}) => ({ id, kind, learningVersion: 5, at,
  knowledgeId: 'k', topicId: 't', moduleId: 'm', ...extra });
const assess = (rating, extra) => event(`assessment-${rating}`, 'assessment', { rating, ...extra });
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('FSRS-6 published initial states and definition R(S)=90% are preserved', () => {
  assert.equal(scheduler.VERSION, 6);
  assert.equal(scheduler.PARAMETERS.length, 21);
  const expected = { none: 0.212, fuzzy: 1.2931, remembered: 2.3065 };
  for (const rating of Object.keys(expected)) {
    const memory = scheduler.initial(rating, at);
    assert.equal(memory.stability, expected[rating]);
    near(scheduler.retrievability(memory, at), 1);
    near(scheduler.retrievability(memory, at + memory.stability * model.DAY), 0.9);
    near(scheduler.intervalDays(memory), memory.stability);
    assert.ok(memory.difficulty >= 1 && memory.difficulty <= 10);
    assert.equal(model.dayKey(scheduler.nextReviewAt(memory)), model.dayKey(model.afterDays(at, Math.max(1, Math.round(memory.stability)))));
  }
  assert.throws(() => scheduler.initial('known', at));
  assert.throws(() => scheduler.intervalDays(scheduler.initial('none', at), 0));
});

test('elapsed time and successful review history independently change the memory estimate', () => {
  const initial = scheduler.initial('remembered', at);
  const early = scheduler.review(initial, 'remembered', at + model.DAY);
  const late = scheduler.review(initial, 'remembered', at + 10 * model.DAY);
  assert.ok(scheduler.retrievability(initial, at + 10 * model.DAY) < scheduler.retrievability(initial, at + model.DAY));
  assert.ok(late.stability > early.stability, 'a successful delayed recall is stronger evidence');
  assert.ok(early.stability > initial.stability);
  const hard = scheduler.review(initial, 'fuzzy', at + model.DAY);
  const failed = scheduler.review(initial, 'none', at + model.DAY);
  assert.ok(failed.stability < initial.stability);
  assert.ok(hard.stability < early.stability);
  assert.equal(failed.lapses, 1);
  assert.equal(early.reviews, 2);
  const sameDay = scheduler.review(initial, 'remembered', at + 3600000);
  assert.ok(sameDay.stability >= initial.stability);
  const repeated = scheduler.review(early, 'remembered', at + 8 * model.DAY);
  assert.ok(repeated.stability > early.stability);
  assert.deepEqual(scheduler.review(early, 'none', at), early, 'stale evidence cannot reverse the memory clock');
});

test('all three assessments count as learned while their degrees and memory remain distinct', () => {
  const state = model.emptyState();
  ['none', 'fuzzy', 'remembered'].forEach((rating) => model.applyEvent(state, assess(rating, { knowledgeId: rating })));
  assert.equal(Object.values(state.records).filter((r) => r.firstLearnedAt).length, 3);
  for (const rating of ['none', 'fuzzy', 'remembered']) {
    const r = state.records[rating];
    assert.equal(r.firstLearnedAt, at);
    assert.equal(model.familiarity(r), rating);
    assert.equal(model.isDue(r, at), false);
  }
  assert.ok(state.records.none.memory.stability < state.records.fuzzy.memory.stability);
  assert.ok(state.records.fuzzy.memory.stability < state.records.remembered.memory.stability);
  model.applyEvent(state, assess('none', { id: 'forgot-later', knowledgeId: 'remembered', at: at + 30 * model.DAY }));
  assert.equal(state.records.remembered.firstLearnedAt, at);
  assert.equal(Object.values(state.records).filter((r) => r.firstLearnedAt).length, 3);
});

test('Beijing calendar policy blocks same-day automatic review even after failures', () => {
  const late = Date.parse('2026-09-07T15:59:00Z');
  let r = model.updateRecord(undefined, assess('none', { at: late }));
  assert.equal(model.isDue(r, late + 59000), false);
  assert.equal(r.nextReviewAt, Date.parse('2026-09-07T16:00:00Z'));
  assert.equal(model.isDue(r, r.nextReviewAt), true);
  r = model.updateRecord(r, assess('none', { id: 'failed-review', at: r.nextReviewAt + 3600000 }));
  assert.equal(model.isDue(r, r.lastReviewedAt), false);
  assert.equal(model.isDue(r, model.afterDays(r.lastReviewedAt, 1) - 1), false);
  assert.equal(model.isDue(r, model.afterDays(r.lastReviewedAt, 1)), true);
});

test('熟知 is a reversible exemption that preserves degree and counts first study', () => {
  let r = model.updateRecord(undefined, assess('fuzzy'));
  const due = r.nextReviewAt;
  r = model.updateRecord(r, event('exclude', 'exemption', { excluded: true }));
  assert.equal(model.familiarity(r), 'known');
  assert.equal(r.selfRating, 'fuzzy');
  assert.equal(r.nextReviewAt, 0);
  assert.equal(model.isDue(r, at + 1000 * model.DAY), false);
  r = model.updateRecord(r, event('restore', 'exemption', { excluded: false, at: at + 7 * model.DAY }));
  assert.equal(model.familiarity(r), 'fuzzy');
  assert.equal(r.nextReviewAt, due);
  assert.equal(model.isDue(r, at + 7 * model.DAY), true);
  assert.equal(r.firstLearnedAt, at);
  const unseen = model.updateRecord(undefined, event('known-first', 'exemption', { excluded: true }));
  assert.equal(unseen.firstLearnedAt, at);
  assert.equal(unseen.memory.reviews, 0, 'exempting is not an invented successful recall');
  assert.equal(unseen.excludedFromReview, true);
});

test('free practice updates evidence only for learned knowledge and preserves degree/exemption', () => {
  let r = model.updateRecord(undefined, event('free-answer', 'answer', { correct: false }));
  assert.equal(r.firstLearnedAt, 0);
  assert.equal(r.memory, undefined);
  assert.equal(model.isDue(r, at + model.DAY), false);
  r = model.updateRecord(r, assess('remembered'));
  r = model.updateRecord(r, event('exclude', 'exemption', { excluded: true }));
  const previousStability = r.memory.stability;
  r = model.updateRecord(r, event('later-wrong', 'answer', { correct: false, at: at + 3 * model.DAY }));
  assert.equal(r.firstLearnedAt, at);
  assert.equal(r.selfRating, 'remembered');
  assert.equal(r.excludedFromReview, true);
  assert.equal(r.nextReviewAt, 0);
  assert.ok(r.memory.stability < previousStability);
  assert.equal(r.wrongCount, 2);
});

function legacyFixture() {
  const day = model.dayKey(at);
  return { version: 4, records: {
    k: { knowledgeId: 'k', topicId: 't', moduleId: 'm', firstLearnedAt: at - 3 * model.DAY,
      lastReviewedAt: at - model.DAY, nextReviewAt: at, reviewStage: 2, masteryLevel: 2, selfRating: 'fuzzy', wrongCount: 3 },
    mastered: { knowledgeId: 'mastered', firstLearnedAt: at - 30 * model.DAY, lastReviewedAt: at - 10 * model.DAY,
      reviewStage: 4, masteryLevel: 4, nextReviewAt: 0, selfRating: 'remembered' },
    unseenWrong: { knowledgeId: 'unseenWrong', firstLearnedAt: 0, nextReviewAt: at, wrongCount: 4 }
  }, days: { [day]: { id: 'old-plan', day, createdAt: at, tasks: [{ id: 'new:k', phase: 'new', knowledgeId: 'k' }],
    completed: { 'new:k': { eventId: 'old-done', at, kind: 'learn' } }, started: { 'new:k': true }, extraCompleted: {} } },
  activity: [{ id: 'old-activity', kind: 'learn', at, knowledgeId: 'k' }], groups: { t_0: at }, studySettings: { id: 'old-settings', topicId: 't', newCount: 10 } };
}

test('V4 migration is deterministic and idempotent, retaining progress, history, plans and counters', () => {
  const legacy = legacyFixture();
  const state = model.upgradeState(structuredClone(legacy));
  assert.equal(state.version, 5);
  assert.deepEqual(model.upgradeState(structuredClone(state)), state);
  assert.deepEqual(state.days, legacy.days);
  assert.deepEqual(state.activity, legacy.activity);
  assert.deepEqual(state.groups, legacy.groups);
  assert.deepEqual(state.studySettings, legacy.studySettings);
  assert.equal(state.records.k.firstLearnedAt, legacy.records.k.firstLearnedAt);
  assert.equal(state.records.k.lastReviewedAt, legacy.records.k.lastReviewedAt);
  assert.equal(state.records.k.wrongCount, 3);
  assert.equal(state.records.k.selfRating, 'fuzzy');
  assert.equal(state.records.k.memory.reviews, 0);
  assert.equal(state.records.k.memory.migrated, true);
  assert.equal(state.records.mastered.excludedFromReview, false);
  assert.equal(model.isDue(state.records.mastered, at), true);
  assert.equal(state.records.unseenWrong.firstLearnedAt, 0);
  assert.equal(state.records.unseenWrong.wrongCount, 4);
  assert.equal(model.isDue(state.records.unseenWrong, at), false);
});

test('legacy pending replay then migration equals migration of local state then new events', () => {
  const base = legacyFixture();
  const old = [{ id: 'old-offline', kind: 'rating', knowledgeId: 'k', topicId: 't', moduleId: 'm', at: at + 1, rating: 'none' }];
  const modern = [assess('remembered', { at: at + 2 }), event('exemption', 'exemption', { at: at + 3, excluded: true })];
  const local = structuredClone(base);
  old.forEach((e) => model.applyEvent(local, e));
  model.upgradeState(local);
  modern.forEach((e) => model.applyEvent(local, e));
  assert.deepEqual(model.replay([...old, ...modern], base, at + 4), model.compact(local, at + 4));
  assert.deepEqual(base, legacyFixture(), 'replay must not mutate the cloud baseline');
  const replayed = model.replay([...old, ...modern, ...modern], base, at + 4);
  assert.deepEqual(replayed, model.replay([...old, ...modern], base, at + 4), 'duplicate event IDs are inert');
});

test('late legacy answers on V5 records cannot restore fixed stages or undo exemption', () => {
  const state = model.replay([assess('remembered'), event('exclude', 'exemption', { excluded: true, at: at + 1 })], undefined, at);
  const response = { id: 'old-client-answer', kind: 'answer', at: at + 4 * model.DAY, knowledgeId: 'k', correct: false };
  model.applyEvent(state, response);
  const r = state.records.k;
  assert.equal(r.schedulingVersion, 5);
  assert.equal(r.selfRating, 'remembered');
  assert.equal(r.excludedFromReview, true);
  assert.equal(r.nextReviewAt, 0);
  assert.equal(r.memory.reviews, 2);
});

test('V5 scoped plans preserve completion across settings replacement and never create retries', () => {
  const state = legacyFixture();
  const day = `${model.dayKey(at)}/new/t`;
  const tasks = [{ id: 'new:k', phase: 'new', knowledgeId: 'k', questionId: '' }];
  model.applyEvent(state, event('prefs-1', 'preferences', { settings: { version: 3, topicId: 't', newCount: 1 } }));
  model.applyEvent(state, event('plan-1', 'plan', { day, mode: 'new', topicId: 't', tasks, settings: { version: 3, id: 'prefs-1' } }));
  model.applyEvent(state, event('begin', 'begin', { day, planId: 'plan-1', taskId: 'new:k' }));
  model.applyEvent(state, assess('none', { id: 'done-1', day, planId: 'plan-1', taskId: 'new:k', phase: 'new' }));
  assert.equal(state.days[day].tasks.length, 1);
  model.applyEvent(state, event('prefs-2', 'preferences', { at: at + 1, settings: { version: 3, topicId: 't', newCount: 2 } }));
  model.applyEvent(state, event('plan-2', 'plan', { at: at + 2, day, mode: 'new', topicId: 't',
    tasks: [...tasks, { id: 'new:b', phase: 'new', knowledgeId: 'b' }], settings: { version: 3, id: 'prefs-2' } }));
  assert.equal(state.days[day].id, 'plan-2');
  assert.equal(state.days[day].completed['new:k'].eventId, 'done-1');
  assert.equal(state.days[day].started['new:k'], true);
  assert.equal(state.days[day].mode, 'new');
  assert.equal(state.days[day].topicId, 't');
  assert.deepEqual(state.days[model.dayKey(at)], legacyFixture().days[model.dayKey(at)]);
});

test('statistics reset retains formal assessments, exclusion and completed study positions', () => {
  const day = `${model.dayKey(at)}/new/t`;
  const state = model.replay([
    event('plan', 'plan', { at: at - 1, day, mode: 'new', topicId: 't', tasks: [{ id: 'new:k', phase: 'new', knowledgeId: 'k' }] }),
    assess('fuzzy', { day, planId: 'plan', taskId: 'new:k' }),
    event('answer', 'answer', { correct: false, at: at + 3 * model.DAY }),
    event('exclude', 'exemption', { excluded: true, at: at + 3 * model.DAY + 1 })
  ], undefined, at + 3 * model.DAY);
  const assessmentMemory = structuredClone(state.records.k.assessmentMemory);
  model.applyEvent(state, event('reset', 'reset', { at: at + 3 * model.DAY + 2 }));
  const r = state.records.k;
  assert.equal(r.wrongCount, 0);
  assert.equal(r.firstLearnedAt, at);
  assert.equal(r.selfRating, 'fuzzy');
  assert.equal(r.excludedFromReview, true);
  assert.deepEqual(r.memory, assessmentMemory);
  assert.equal(state.days[day].completed['new:k'].eventId, 'assessment-fuzzy');
  assert.equal(state.activity.some((e) => e.kind === 'answer'), false);
});

test('a V5 migration seed never changes the recurrence of pending V4 events on another record', () => {
  const base = legacyFixture();
  const pending = { id: 'legacy-correct', at, kind: 'answer', knowledgeId: 'k', correct: true };
  const seed = event('seed-other', 'seed', { at: 1, knowledgeId: 'other', learned: true });
  const original = model.replay([pending], base, at);
  const withSeed = model.replay([seed, pending], base, at);
  assert.deepEqual(withSeed.records.k, original.records.k);
  assert.equal(withSeed.records.other.firstLearnedAt, 1);
  assert.equal(withSeed.records.other.memory.reviews, 0);
  assert.deepEqual(withSeed.days, original.days);
});

test('older offline assessments retain newer cloud degree/memory and merge earlier formal learning', () => {
  const older = assess('none', { id: 'offline-early', at });
  const latest = assess('remembered', { id: 'cloud-latest', at: at + 3 * model.DAY });
  const base = model.replay([latest], undefined, latest.at);
  const merged = model.replay([older], base, latest.at);
  assert.equal(merged.records.k.selfRating, 'remembered');
  assert.equal(merged.records.k.firstLearnedAt, at);
  assert.equal(merged.records.k.updatedAt, latest.at);
  assert.deepEqual(merged.records.k.memory, base.records.k.memory, 'stale memory awaits authoritative full replay');
  assert.deepEqual(merged.records.k.ratingEvent, { at: latest.at, id: latest.id });
  assert.equal(merged.activity.filter((e) => e.id === older.id).length, 1, 'real offline activity survives');
  const acknowledged = model.replay([older, latest], undefined, latest.at);
  assert.equal(acknowledged.records.k.firstLearnedAt, merged.records.k.firstLearnedAt);
  assert.equal(acknowledged.records.k.selfRating, merged.records.k.selfRating);
  assert.ok(acknowledged.records.k.memory.reviews > merged.records.k.memory.reviews);
});

test('independent exemption order survives old pending toggles and same-time ID ties', () => {
  const known = event('known-latest', 'exemption', { excluded: true, at: at + 2 * model.DAY });
  const base = model.replay([assess('fuzzy'), known], undefined, known.at);
  const staleRestore = event('restore-old', 'exemption', { excluded: false, at: at + model.DAY });
  const merged = model.replay([staleRestore], base, known.at);
  assert.equal(merged.records.k.excludedFromReview, true);
  assert.equal(merged.records.k.selfRating, 'fuzzy');
  assert.equal(merged.records.k.nextReviewAt, 0);
  const restored = event('z-restore', 'exemption', { excluded: false, at: known.at });
  model.applyEvent(merged, restored);
  assert.equal(merged.records.k.excludedFromReview, false);
  model.applyEvent(merged, event('a-known', 'exemption', { excluded: true, at: known.at }));
  assert.equal(merged.records.k.excludedFromReview, false, 'smaller equal-time ID cannot override latest toggle');
  assert.equal(model.isDue(merged.records.k, known.at), false, 'marking 熟知 completed study on this day');
  assert.equal(model.isDue(merged.records.k, model.afterDays(known.at, 1)), true);

  const latestRating = assess('remembered', { id: 'z-rating' });
  const rated = model.replay([latestRating], undefined, at);
  model.applyEvent(rated, assess('none', { id: 'a-rating' }));
  assert.equal(rated.records.k.selfRating, 'remembered');
  assert.equal(rated.records.k.memory.reviews, 1);
});

test('pending event already present in snapshot activity or completion is not counted twice', () => {
  const learned = assess('none');
  const base = JSON.parse(JSON.stringify(model.replay([learned], undefined, at)));
  assert.deepEqual(model.replay([learned], base, at), base);
  const day = `${model.dayKey(at)}/new/t`;
  const planned = event('plan', 'plan', { day, mode: 'new', topicId: 't', at: at - 1,
    tasks: [{ id: 'new:k', phase: 'new', knowledgeId: 'k' }] });
  const completed = assess('none', { day, taskId: 'new:k', planId: 'plan' });
  const taskBase = JSON.parse(JSON.stringify(model.replay([planned, completed], undefined, at)));
  taskBase.activity = [];
  assert.deepEqual(model.replay([completed], taskBase, at), taskBase, 'completion ID survives compacted activity');
});

test('V5 review plans add later restored/synced tasks without losing canonical completion', () => {
  const day = `${model.dayKey(at)}/review/t`;
  const task = { id: 'review:k', phase: 'review', knowledgeId: 'k', questionId: '' };
  const initial = event('first-plan', 'plan', { day, mode: 'review', topicId: 't', tasks: [task], at: at - 1 });
  const completed = assess('fuzzy', { day, taskId: task.id, planId: initial.id, phase: 'review' });
  const state = model.replay([initial, completed], undefined, at);
  state.days[day].started[task.id] = true;
  const addition = event('append-plan', 'plan', { at: at + 1, day, mode: 'review', topicId: 't',
    tasks: [task, { id: 'review:restored', phase: 'review', knowledgeId: 'restored' }] });
  model.applyEvent(state, addition);
  assert.equal(state.days[day].id, initial.id);
  assert.equal(state.days[day].tasks.length, 2);
  assert.equal(state.days[day].completed[task.id].eventId, completed.id);
  assert.equal(state.days[day].started[task.id], true);
  model.applyEvent(state, addition);
  assert.equal(state.days[day].tasks.length, 2);
  const earlier = event('earlier-plan', 'plan', { at: at - 2, day, mode: 'review', topicId: 't',
    tasks: [{ id: 'review:remote', phase: 'review', knowledgeId: 'remote' }] });
  model.applyEvent(state, earlier);
  assert.equal(state.days[day].id, earlier.id);
  assert.equal(state.days[day].completed[task.id].eventId, completed.id);
  assert.equal(state.days[day].tasks.length, 3);
});

test('old pending answers cannot resurrect statistics removed by a cloud reset', () => {
  const answered = event('answer-old', 'answer', { correct: false, at: at + model.DAY });
  const reset = event('reset-latest', 'reset', { at: at + 2 * model.DAY });
  const base = JSON.parse(JSON.stringify(model.replay([assess('fuzzy'), answered, reset], undefined, reset.at)));
  assert.deepEqual(model.replay([answered], base, reset.at), base);
});

test('completing a review as 熟知 then restoring that day cannot schedule it twice', () => {
  const learned = assess('fuzzy', { at: at - 10 * model.DAY });
  const day = `${model.dayKey(at)}/review/t`;
  const plan = event('review-plan', 'plan', { day, mode: 'review', topicId: 't', at: at - 1,
    tasks: [{ id: 'review:k', phase: 'review', knowledgeId: 'k' }] });
  const complete = event('complete-known', 'exemption', { excluded: true, day, taskId: 'review:k', planId: plan.id, phase: 'review' });
  const state = model.replay([learned, plan], undefined, at);
  const memoryBefore = structuredClone(state.records.k.memory);
  const dueBefore = state.records.k.nextReviewAt;
  assert.equal(model.isDue(state.records.k, at), true);
  model.applyEvent(state, complete);
  model.applyEvent(state, event('restore', 'exemption', { excluded: false, at: at + 1 }));
  assert.deepEqual(state.records.k.memory, memoryBefore, 'exemption does not invent successful recall');
  assert.equal(state.records.k.nextReviewAt, dueBefore);
  assert.equal(state.records.k.lastStudyAt, at);
  assert.equal(state.days[day].completed['review:k'].eventId, complete.id);
  assert.equal(model.isDue(state.records.k, at + 1), false);
  assert.equal(model.isDue(state.records.k, model.afterDays(at, 1) - 1), false);
  assert.equal(model.isDue(state.records.k, model.afterDays(at, 1)), true);
});
