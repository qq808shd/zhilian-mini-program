// Pure versioned domain model, shared by the mini program and Node service.
const scheduler = require('./memoryScheduler');
const VERSION = 5;
const LEARNING_RESET_VERSION = 1;
const DAY = 86400000;
const OFFSET = 8 * 3600000;
const dayKey = (at) => new Date(at + OFFSET).toISOString().slice(0, 10);
const dayStart = (at) => Math.floor((at + OFFSET) / DAY) * DAY - OFFSET;
const afterDays = (at, days) => dayStart(at) + days * DAY;
const emptyState = () => ({ version: VERSION, records: {}, days: {}, groups: {}, activity: [] });
const ratings = ['none', 'fuzzy', 'remembered'];
const order = (a, b) => (a.at || 0) - (b.at || 0) || String(a.id || '').localeCompare(String(b.id || ''));
const stamp = (event) => ({ at: event.at, id: event.id || '' });
const newer = (event, previous) => !previous || order(event, previous) > 0;
function markLearned(record, at) {
  record.firstLearnedAt = Math.min(record.firstLearnedAt || at || 1, at || 1);
  record.lastStudyAt = Math.max(record.lastStudyAt || 0, at);
}
function familiarity(record) {
  if (record && record.excludedFromReview) return 'known';
  if (record && ratings.includes(record.selfRating)) return record.selfRating;
  if (record && record.reviewStage >= 4) return 'remembered';
  return 'none';
}
function isDue(record, now = Date.now()) {
  if (!record || !record.firstLearnedAt || record.excludedFromReview || !record.nextReviewAt || record.nextReviewAt > now) return false;
  const last = Math.max(record.lastStudyAt || 0, record.memory ? record.memory.lastReviewAt : record.lastReviewedAt || record.firstLearnedAt);
  return !last || dayKey(last) !== dayKey(now);
}
function upgradeRecord(record) {
  if (record.schedulingVersion === VERSION) return record;
  const r = { ...record, schedulingVersion: VERSION, excludedFromReview: !!record.excludedFromReview };
  r.lastStudyAt = Math.max(record.lastStudyAt || 0, record.firstLearnedAt || 0, record.lastReviewedAt || 0);
  // Preserve explicit self-assessment and every legacy counter/field. An old
  // stage-4 record participates in reviews; it is not an explicit exemption.
  r.selfRating = familiarity(record);
  if (r.selfRating === 'known') r.selfRating = ratings.includes(record.selfRating) ? record.selfRating : 'remembered';
  // Old snapshots do not always retain an assessment event ID. Their latest
  // known record time is a conservative boundary until full server replay.
  if (!r.ratingEvent && ratings.includes(record.selfRating)) r.ratingEvent = { at: record.updatedAt || record.lastReviewedAt || record.firstLearnedAt || 0, id: '' };
  if (r.firstLearnedAt) {
    const at = r.lastReviewedAt || r.firstLearnedAt;
    r.memory = scheduler.initial(r.selfRating, at);
    r.memory.reviews = 0;
    r.memory.migrated = true;
    r.memoryEvent = r.memoryEvent || { at, id: '' };
    const oldInterval = (r.nextReviewAt - at) / DAY;
    if (oldInterval > 0) r.memory.stability = Math.min(36500, oldInterval);
    const next = Math.max(r.nextReviewAt || scheduler.nextReviewAt(r.memory), afterDays(at, 1));
    r.nextReviewAt = r.excludedFromReview ? 0 : next;
    if (r.excludedFromReview) r.reviewResumeAt = next;
  } else r.nextReviewAt = 0;
  return r;
}
function upgradeState(state) {
  // Deterministic, idempotent, and independent of the current clock. Keep the
  // historical day plans, completion IDs, settings, groups and activity intact.
  state.version = VERSION;
  Object.keys(state.records).forEach((id) => { state.records[id] = upgradeRecord(state.records[id]); });
  return state;
}
function status(record, now = Date.now()) {
  if (!record) return 'unlearned';
  if (record.schedulingVersion === VERSION) {
    if (!record.firstLearnedAt) return 'unlearned';
    if (record.excludedFromReview) return 'excluded';
    if (isDue(record, now)) return 'due';
    return { none: 'stranger', fuzzy: 'familiar', remembered: 'mastered' }[familiarity(record)];
  }
  if (record.reviewStage >= 4) return 'mastered';
  if (record.nextReviewAt && record.nextReviewAt <= now) return 'due';
  if (record.reviewStage > 0 || record.selfRating === 'none' || record.selfRating === 'fuzzy' || record.wrongCount) return 'consolidating';
  return record.firstLearnedAt ? 'learned' : 'learning';
}
const labels = { unlearned: '未学习', learning: '学习中', learned: '已学习', due: '待复习', consolidating: '巩固中', mastered: '掌握', stranger: '陌生', familiar: '了解', excluded: '熟知' };
function updateLegacyRecord(previous, event) {
  const r = { knowledgeId: event.knowledgeId, topicId: event.topicId, moduleId: event.moduleId,
    firstLearnedAt: 0, lastReviewedAt: 0, nextReviewAt: 0, reviewStage: 0, masteryLevel: 0,
    selfRating: '', correctStreak: 0, wrongCount: 0, lastResult: '', ...previous };
  const at = event.at;
  if (event.kind === 'seed') {
    if (previous && !previous.legacy) return previous;
    r.legacy = true;
    if (event.learned) r.firstLearnedAt = r.firstLearnedAt || at || 1;
    r.nextReviewAt = r.nextReviewAt || at || 1;
    if (event.wrong) { r.wrongCount = Math.max(r.wrongCount, event.wrong); r.lastResult = 'wrong'; }
    return r;
  }
  r.legacy = false; r.updatedAt = at;
  if (event.kind === 'start') return r;
  r.firstLearnedAt = r.firstLearnedAt || at;
  r.lastStudyAt = Math.max(r.lastStudyAt || 0, at);
  if (event.kind === 'learn' || event.kind === 'rating') {
    if (!r.nextReviewAt && r.reviewStage < 4) r.nextReviewAt = afterDays(at, 1);
    if (event.rating) { r.selfRating = event.rating; r.ratingEvent = stamp(event); }
    if (event.rating === 'none' || event.rating === 'fuzzy') {
      r.reviewStage = 0; r.masteryLevel = 0; r.correctStreak = 0;
      r.nextReviewAt = event.rating === 'none' ? at : afterDays(at, 1);
      r.lastResult = event.rating;
    }
  }
  if (event.kind === 'answer' || event.kind === 'recall') {
    const canAdvance = !r.lastReviewedAt || (dayKey(at) !== dayKey(r.lastReviewedAt) && at >= r.nextReviewAt);
    r.lastReviewedAt = at;
    r.lastResult = event.correct ? 'correct' : 'wrong';
    if (!event.correct) {
      r.reviewStage = 0; r.correctStreak = 0; r.wrongCount += 1; r.nextReviewAt = at;
    } else {
      r.correctStreak += 1;
      if (r.reviewStage === 0) r.reviewStage = 1;
      else if (r.reviewStage < 4 && canAdvance) r.reviewStage += 1;
      const interval = [0, 1, 3, 7][r.reviewStage];
      if (r.reviewStage >= 4) r.nextReviewAt = 0;
      else if (canAdvance || r.nextReviewAt <= at) r.nextReviewAt = afterDays(at, interval);
    }
  }
  if (event.retry && (event.correct === false || event.rating === 'none')) r.nextReviewAt = afterDays(at, 1);
  r.masteryLevel = r.reviewStage;
  return r;
}
function updateRecord(previous, event) {
  // Old histories retain their exact V4 recurrence until a V5 event/upgrade.
  // Once a record has migrated, old-client answers must not reinstate fixed
  // stages, remove exemptions, or overwrite the user's independent degree.
  if (event.kind === 'seed') {
    if (previous && !previous.legacy) return previous;
    const legacy = updateLegacyRecord(previous, event);
    if (!previous || previous.schedulingVersion !== VERSION) return legacy;
    delete legacy.schedulingVersion;
    return upgradeRecord(legacy);
  }
  if (event.learningVersion !== VERSION && (!previous || previous.schedulingVersion !== VERSION)) return updateLegacyRecord(previous, event);
  const r = upgradeRecord({ knowledgeId: event.knowledgeId, topicId: event.topicId, moduleId: event.moduleId,
    firstLearnedAt: 0, lastReviewedAt: 0, nextReviewAt: 0, reviewStage: 0, masteryLevel: 0,
    selfRating: 'none', correctStreak: 0, wrongCount: 0, lastResult: '', ...previous });
  const at = event.at;
  r.legacy = false;
  r.updatedAt = Math.max(r.updatedAt || 0, at);
  if (event.kind === 'start') return r;
  if (event.kind === 'exemption') {
    if (event.excluded) {
      markLearned(r, at);
      if (!r.memory) {
        r.memory = scheduler.initial(r.selfRating, at); r.memory.reviews = 0;
        r.memoryEvent = stamp(event);
        r.nextReviewAt = r.excludedFromReview ? 0 : scheduler.nextReviewAt(r.memory);
      }
    }
    if (!newer(event, r.exemptionEvent)) return r;
    r.exemptionEvent = stamp(event);
    if (event.excluded) {
      r.reviewResumeAt = r.nextReviewAt || r.reviewResumeAt || scheduler.nextReviewAt(r.memory);
      r.excludedFromReview = true;
      r.nextReviewAt = 0;
    } else if (r.excludedFromReview) {
      r.excludedFromReview = false;
      r.nextReviewAt = r.reviewResumeAt || (r.memory ? scheduler.nextReviewAt(r.memory) : 0);
    }
    return r;
  }
  const assessment = ['assessment', 'learn', 'rating'].includes(event.kind);
  const response = event.kind === 'answer' || event.kind === 'recall';
  if (assessment || response) {
    let memoryChanged = false;
    const canUpdateMemory = newer(event, r.memoryEvent || (r.memory ? { at: r.memory.lastReviewAt, id: '' } : null));
    if (assessment) {
      const rating = ratings.includes(event.rating) ? event.rating : r.selfRating;
      markLearned(r, at);
      if (newer(event, r.ratingEvent)) {
        r.selfRating = rating;
        r.ratingEvent = stamp(event);
      }
      // A compact cloud snapshot cannot reconstruct the FSRS state before an
      // older offline event. Preserve the newer memory and let authoritative
      // full event replay incorporate that evidence when it is acknowledged.
      if (canUpdateMemory) {
        r.memory = scheduler.review(r.memory, rating, at);
        r.memoryEvent = stamp(event);
        r.lastResult = rating;
        r.assessmentMemory = { ...r.memory };
        r.assessmentMemoryEvent = stamp(event);
        memoryChanged = true;
      }
    } else {
      if (!event.correct) r.wrongCount += 1;
      if (canUpdateMemory) {
        r.lastResult = event.correct ? 'correct' : 'wrong';
        r.correctStreak = event.correct ? r.correctStreak + 1 : 0;
      }
      // Free practice is evidence only for already learned knowledge. It never
      // manufactures formal learning progress or changes a self-assessment.
      if (r.firstLearnedAt && canUpdateMemory) {
        r.memory = scheduler.review(r.memory, event.correct ? 'remembered' : 'none', at);
        r.memoryEvent = stamp(event);
        memoryChanged = true;
      }
    }
    if (memoryChanged && r.memory && r.firstLearnedAt) {
      r.lastReviewedAt = r.memory.lastReviewAt;
      const next = scheduler.nextReviewAt(r.memory);
      r.nextReviewAt = r.excludedFromReview ? 0 : next;
      if (r.excludedFromReview) r.reviewResumeAt = next;
      if (assessment) r.assessmentNextReviewAt = next;
    }
  }
  return r;
}
function filterResetProgress(progress, resets = {}) {
  return Object.fromEntries(Object.entries(progress || {}).filter(([, item]) => !resets[item.topicId] || item.updatedAt > resets[item.topicId].at));
}
function resetForEvent(state, event) {
  const resets = state.learningResets || {};
  const topicId = event.topicId || (event.day && event.day.split('/')[2]);
  if (resets[topicId]) return resets[topicId];
  return Object.entries(resets).find(([topic, reset]) =>
    (event.knowledgeId && reset.knowledgeIds.includes(event.knowledgeId)) ||
    (event.groupKey && event.groupKey.startsWith(topic + '_')))?.[1];
}
function resetLearningScope(state, event) {
  const resets = state.learningResets || (state.learningResets = {});
  if (!newer(event, resets[event.topicId])) return state;
  const ids = new Set(event.knowledgeIds);
  resets[event.topicId] = { ...stamp(event), knowledgeIds: Array.from(ids) };
  Object.entries(state.records).forEach(([id, record]) => {
    if (record.topicId !== event.topicId && !ids.has(id)) return;
    // A pending reset can arrive over a newer cloud snapshot. Keep records
    // wholly learned after it; otherwise preserve only later explicit actions.
    if (record.firstLearnedAt > event.at) return;
    const later = [];
    const common = { learningVersion: VERSION, knowledgeId: id, topicId: record.topicId, moduleId: record.moduleId };
    if (record.ratingEvent && newer(record.ratingEvent, event)) later.push({ ...common, ...record.ratingEvent, kind: 'assessment', rating: record.selfRating });
    if (record.exemptionEvent && newer(record.exemptionEvent, event)) later.push({ ...common, ...record.exemptionEvent, kind: 'exemption', excluded: record.excludedFromReview });
    delete state.records[id];
    // Server full replay restores all post-reset evidence. The local projection
    // uses actual retained action stamps, never the cleared pre-reset strength.
    later.sort(order).forEach(e => { state.records[id] = updateRecord(state.records[id], e); });
  });
  Object.entries(state.days).forEach(([key, plan]) => {
    if (plan.createdAt > event.at) return;
    if (plan.topicId === event.topicId || key.split('/')[2] === event.topicId) { delete state.days[key]; return; }
    plan.tasks = plan.tasks.filter(task => !ids.has(task.knowledgeId));
    const keep = values => Object.fromEntries(Object.entries(values || {}).filter(([id, value]) =>
      !ids.has(value.knowledgeId) && plan.tasks.some(task => task.id === id)));
    plan.completed = keep(plan.completed);
    plan.started = Object.fromEntries(Object.entries(plan.started).filter(([id]) => plan.tasks.some(task => task.id === id)));
    plan.extraCompleted = Object.fromEntries(Object.entries(plan.extraCompleted || {}).filter(([, value]) => !ids.has(value.knowledgeId)));
  });
  Object.keys(state.groups).forEach(key => { if (key.startsWith(event.topicId + '_') && state.groups[key] <= event.at) delete state.groups[key]; });
  state.activity = state.activity.filter(item => !ids.has(item.knowledgeId) || item.at > event.at);
  return state;
}
function applyEvent(state, event, checkActivityDuplicate = true) {
  // Snapshots retain recent activity and task completion IDs; do not apply a
  // pending event twice merely because its explicit network ack was missing.
  if (checkActivityDuplicate && state.activity.some((a) => a.id === event.id)) return state;
  // Do this at the first new event, not before replaying pending V4 events over
  // a V4 base. Both incremental local state and cloud replay then converge.
  // Seed events are migration baselines at time 1, not a user's V5 transition.
  if (event.learningVersion === VERSION && event.kind !== 'seed') upgradeState(state);
  if (event.kind === 'preferences') {
    if (newer(event, state.studySettings)) state.studySettings = { ...event.settings, id: event.id, at: event.at };
    return state;
  }
  if (event.kind === 'reset-learning') return resetLearningScope(state, event);
  const scopeReset = resetForEvent(state, event);
  if (scopeReset && !newer(event, scopeReset)) return state;
  if (event.kind === 'reset') {
    if (!newer(event, state.resetAt ? { at: state.resetAt, id: state.resetId || '' } : null)) return state;
    state.resetAt = event.at;
    state.resetId = event.id;
    Object.values(state.records).forEach((r) => {
      r.wrongCount = 0; r.correctStreak = 0; r.lastReviewedAt = 0; r.lastResult = ''; r.reviewStage = 0; r.masteryLevel = 0;
      if (r.schedulingVersion === VERSION) {
        // Statistics reset preserves explicit study decisions and exemptions.
        if (r.assessmentMemory) { r.memory = { ...r.assessmentMemory }; r.memoryEvent = r.assessmentMemoryEvent || r.ratingEvent; }
        else if (r.firstLearnedAt) {
          r.memory = scheduler.initial(r.selfRating, r.firstLearnedAt);
          r.memory.reviews = 0;
          r.memoryEvent = { at: r.firstLearnedAt, id: '' };
        }
        const next = r.memory ? scheduler.nextReviewAt(r.memory) : 0;
        r.lastReviewedAt = r.memory ? r.memory.lastReviewAt : 0;
        r.nextReviewAt = r.excludedFromReview ? 0 : next;
        if (r.excludedFromReview) r.reviewResumeAt = next;
      } else r.nextReviewAt = r.selfRating === 'none' ? event.at : r.firstLearnedAt ? afterDays(event.at, 1) : 0;
    });
    state.activity = state.activity.filter((a) => a.kind !== 'answer');
    Object.values(state.days).forEach((p) => Object.values(p.completed).forEach((c) => { if (c.kind === 'answer') c.redacted = true; }));
    return state;
  }

  if (event.kind === 'plan') {
    event = { ...event, tasks: event.tasks.filter(task => {
      const reset = resetForEvent(state, { knowledgeId: task.knowledgeId });
      return !reset || newer(event, reset);
    }) };
    const prior = state.days[event.day];
    if (prior && prior.learningVersion === VERSION && event.learningVersion === VERSION && prior.mode === 'review' && event.mode === 'review') {
      const incomingFirst = order(event, { at: prior.createdAt, id: prior.id }) < 0;
      const first = incomingFirst ? event.tasks : prior.tasks;
      const second = incomingFirst ? prior.tasks : event.tasks;
      prior.tasks = Array.from(new Map(first.concat(second).map((t) => [t.id, { ...t }])).values());
      if (incomingFirst) { prior.id = event.id; prior.createdAt = event.at; }
      return state;
    }
    // V4 started plans remain frozen. V5 scoped plans can reflect new settings
    // while retaining the exact completion and started IDs still in scope.
    const untouched = prior && !Object.keys(prior.started).length && !Object.keys(prior.completed).length;
    const currentSettingsId = state.studySettings ? state.studySettings.id : 'default';
    const replacement = (untouched || (prior && event.learningVersion === VERSION)) && event.settings && event.settings.id === currentSettingsId && (!prior.settings || prior.settings.id !== currentSettingsId || (prior.settings.version || 1) < (event.settings.version || 1));
    if (!prior || replacement || event.at < prior.createdAt || (event.at === prior.createdAt && event.id < prior.id)) {
      const keep = (values) => Object.fromEntries(Object.entries(values || {}).filter(([id]) => event.tasks.some((t) => t.id === id)));
      const preserve = replacement && event.learningVersion === VERSION;
      state.days[event.day] = { id: event.id, day: event.day, createdAt: event.at,
        ...(event.learningVersion === VERSION ? { learningVersion: VERSION, mode: event.mode, topicId: event.topicId } : {}),
        ...(event.settings ? { settings: { ...event.settings } } : {}), tasks: event.tasks.map((t) => ({ ...t })),
        completed: preserve ? keep(prior.completed) : {}, started: preserve ? keep(prior.started) : {}, extraCompleted: prior ? prior.extraCompleted || {} : {} };
    }
    return state;
  }
  if (event.kind === 'group') { state.groups[event.groupKey] = Math.max(state.groups[event.groupKey] || 0, event.at); return state; }
  const plan = event.day && state.days[event.day];
  if (event.kind === 'begin') { if (plan && plan.id === event.planId) plan.started[event.taskId] = true; return state; }
  if (event.taskId && plan && plan.completed[event.taskId] && plan.completed[event.taskId].eventId === event.id) return state;
  const redactedAnswer = event.kind === 'answer' && event.at <= (state.resetAt || 0);
  const previous = state.records[event.knowledgeId];
  if (event.knowledgeId && !redactedAnswer) state.records[event.knowledgeId] = updateRecord(previous, event);
  if (!redactedAnswer && ['answer', 'recall', 'learn', 'rating', 'assessment', 'exemption'].includes(event.kind)) {
    state.activity.push({ id: event.id, at: event.at, kind: event.kind, knowledgeId: event.knowledgeId, correct: event.correct,
      newlyMastered: event.learningVersion === VERSION
        ? familiarity(previous) !== 'remembered' && familiarity(state.records[event.knowledgeId]) === 'remembered'
        : (previous ? previous.reviewStage : 0) < 4 && state.records[event.knowledgeId].reviewStage >= 4 });
  }
  if (event.taskId && plan) {
    const completion = { at: event.at, correct: event.correct, rating: event.rating || '', eventId: event.id,
      knowledgeId: event.knowledgeId, questionId: event.questionId || '', kind: event.kind, phase: event.phase,
      ...(redactedAnswer ? { redacted: true } : {}) };
    const matchesCanonical = plan.tasks.some((t) => t.id === event.taskId && t.knowledgeId === event.knowledgeId);
    if (matchesCanonical) {
      if (!plan.completed[event.taskId]) plan.completed[event.taskId] = completion;
      const failed = event.correct === false || event.rating === 'none';
      if (event.learningVersion !== VERSION && plan.learningVersion !== VERSION && failed && !event.retry && plan.tasks.filter((t) => t.phase === 'retry').length < 10 && !plan.tasks.some((t) => t.phase === 'retry' && t.knowledgeId === event.knowledgeId)) {
        plan.tasks.push({ id: `retry:${event.knowledgeId}`, phase: 'retry', knowledgeId: event.knowledgeId, questionId: event.questionId || '' });
      }
    } else { plan.extraCompleted[event.id] = completion; }
  }
  return state;
}
function compact(state, now) {
  const cutoff = dayKey(afterDays(now, -30));
  Object.keys(state.days).forEach((day) => { if (day < cutoff) delete state.days[day]; });
  state.activity = state.activity.filter((a) => a.at >= afterDays(now, -7));
  return state;
}
function replay(events, base, now = Date.now()) {
  const state = base ? JSON.parse(JSON.stringify(base)) : emptyState();
  const ids = new Set(state.activity.map((a) => a.id));
  events.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).forEach((e) => {
    if (!ids.has(e.id)) { applyEvent(state, e, false); ids.add(e.id); }
  });
  return compact(upgradeState(state), now);
}
module.exports = { VERSION, LEARNING_RESET_VERSION, DAY, dayKey, dayStart, afterDays, emptyState, upgradeState, familiarity, isDue, status, labels, updateRecord, applyEvent, replay, compact, filterResetProgress };
