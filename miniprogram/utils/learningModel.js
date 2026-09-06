// Pure V4 domain model, shared by the mini program and Node service.
const DAY = 86400000;
const OFFSET = 8 * 3600000;
const dayKey = (at) => new Date(at + OFFSET).toISOString().slice(0, 10);
const dayStart = (at) => Math.floor((at + OFFSET) / DAY) * DAY - OFFSET;
const afterDays = (at, days) => dayStart(at) + days * DAY;
const emptyState = () => ({ version: 4, records: {}, days: {}, groups: {}, activity: [] });
function status(record, now) {
  if (!record) return 'unlearned';
  if (record.reviewStage >= 4) return 'mastered';
  if (record.nextReviewAt && record.nextReviewAt <= now) return 'due';
  if (record.reviewStage > 0 || record.selfRating === 'none' || record.selfRating === 'fuzzy' || record.wrongCount) return 'consolidating';
  return record.firstLearnedAt ? 'learned' : 'learning';
}
const labels = { unlearned: '未学习', learning: '学习中', learned: '已学习 · 待检验', due: '待复习', consolidating: '巩固中', mastered: '已掌握' };
function updateRecord(previous, event) {
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
  if (event.kind === 'learn' || event.kind === 'rating') {
    if (!r.nextReviewAt && r.reviewStage < 4) r.nextReviewAt = afterDays(at, 1);
    if (event.rating) r.selfRating = event.rating;
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
function applyEvent(state, event) {
  if (event.kind === 'reset') {
    state.resetAt = event.at;
    Object.values(state.records).forEach((r) => {
      r.wrongCount = 0; r.correctStreak = 0; r.lastReviewedAt = 0; r.lastResult = ''; r.reviewStage = 0; r.masteryLevel = 0;
      r.nextReviewAt = r.selfRating === 'none' ? event.at : r.firstLearnedAt ? afterDays(event.at, 1) : 0;
    });
    state.activity = state.activity.filter((a) => a.kind !== 'answer');
    Object.values(state.days).forEach((p) => Object.values(p.completed).forEach((c) => { if (c.kind === 'answer') c.redacted = true; }));
    return state;
  }

  if (event.kind === 'plan') {
    const prior = state.days[event.day];
    // Canonical earliest plan; completed work from a second offline plan is still recorded separately.
    if (!prior || event.at < prior.createdAt || (event.at === prior.createdAt && event.id < prior.id)) {
      state.days[event.day] = { id: event.id, day: event.day, createdAt: event.at, tasks: event.tasks.map((t) => ({ ...t })), completed: {}, started: {}, extraCompleted: prior ? prior.extraCompleted || {} : {} };
    }
    return state;
  }
  if (event.kind === 'group') { state.groups[event.groupKey] = Math.max(state.groups[event.groupKey] || 0, event.at); return state; }
  const plan = event.day && state.days[event.day];
  if (event.kind === 'begin') { if (plan && plan.id === event.planId) plan.started[event.taskId] = true; return state; }
  if (event.taskId && plan && plan.completed[event.taskId] && plan.completed[event.taskId].eventId === event.id) return state;
  const previous = state.records[event.knowledgeId];
  if (event.knowledgeId) state.records[event.knowledgeId] = updateRecord(previous, event);
  if (['answer', 'recall', 'learn', 'rating'].includes(event.kind)) {
    state.activity.push({ id: event.id, at: event.at, kind: event.kind, knowledgeId: event.knowledgeId, correct: event.correct,
      newlyMastered: (previous ? previous.reviewStage : 0) < 4 && state.records[event.knowledgeId].reviewStage >= 4 });
  }
  if (event.taskId && plan) {
    const completion = { at: event.at, correct: event.correct, rating: event.rating || '', eventId: event.id,
      knowledgeId: event.knowledgeId, questionId: event.questionId || '', kind: event.kind, phase: event.phase };
    const matchesCanonical = plan.tasks.some((t) => t.id === event.taskId && t.knowledgeId === event.knowledgeId);
    if (matchesCanonical) {
      if (!plan.completed[event.taskId]) plan.completed[event.taskId] = completion;
      const failed = event.correct === false || event.rating === 'none';
      if (failed && !event.retry && plan.tasks.filter((t) => t.phase === 'retry').length < 10 && !plan.tasks.some((t) => t.phase === 'retry' && t.knowledgeId === event.knowledgeId)) {
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
  const ids = new Set();
  events.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).forEach((e) => {
    if (!ids.has(e.id)) { applyEvent(state, e); ids.add(e.id); }
  });
  return compact(state, now);
}
module.exports = { DAY, dayKey, dayStart, afterDays, emptyState, status, labels, updateRecord, applyEvent, replay, compact };
