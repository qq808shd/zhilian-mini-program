const content = require('../data/content');
const storage = require('./storage');
const model = require('./learningModel');
const KEY = 'zhilian_learning_v4';
const DRAFT_KEY = 'zhilian_daily_draft_v4';
const knowledgeMap = new Map(content.knowledge.map((k) => [k.id, k]));
const questionsMap = new Map(content.questions.map((q) => [q.id, q]));
const related = new Map();
content.questions.forEach((q) => { if (!related.has(q.knowledgeId)) related.set(q.knowledgeId, []); related.get(q.knowledgeId).push(q); });
function uid() { return `v4:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`; }
function write(value, notify = true) { wx.setStorageSync(KEY, value); if (notify) storage.notifyCloudSync(); }
function ensure(now = Date.now()) {
  let value = wx.getStorageSync(KEY);
  if (value && value.version === 4) return value;
  const seeds = {};
  Object.values(storage.getStudyProgress()).forEach((p) => {
    const set = content.getKnowledgeSet(p.topicId, p.setIndex);
    if (set) set.items.slice(0, p.maxIndex + 1).forEach((k) => { seeds[k.id] = { learned: true }; });
  });
  Object.values(storage.getQuestionStats()).forEach((r) => {
    const q = questionsMap.get(r.questionId);
    if (q && r.activeWrong) seeds[q.knowledgeId] = { ...seeds[q.knowledgeId], wrong: ((seeds[q.knowledgeId] || {}).wrong || 0) + (r.wrong || 1) };
  });
  const pending = Object.keys(seeds).map((id) => {
    const k = knowledgeMap.get(id);
    return { id: uid(), kind: 'seed', at: 1, knowledgeId: id, topicId: k.topicId, moduleId: k.moduleId, ...seeds[id] };
  });
  value = { version: 4, base: model.emptyState(), pending, state: model.replay(pending, null, now) };
  write(value, pending.length > 0);
  return value;
}
function getState(now = Date.now()) { return ensure(now).state; }
function emit(data, now = Date.now()) {
  const value = ensure(now);
  const event = { id: uid(), at: Math.max(now, (value.lastAt || 0) + 1), ...data };
  value.lastAt = event.at;
  if (value.pending.some((e) => e.id === event.id)) return event;
  value.pending.push(event);
  model.applyEvent(value.state, event); model.compact(value.state, now);
  write(value);
  return event;
}
function knowledgeEvent(id, data, now) {
  const k = knowledgeMap.get(id);
  if (!k) return null;
  return emit({ knowledgeId: id, topicId: k.topicId, moduleId: k.moduleId, ...data }, now);
}
function startLearning(id, now = Date.now()) {
  if (!getState(now).records[id]) knowledgeEvent(id, { kind: 'start' }, now);
}
function learn(id, rating = '', now = Date.now()) {
  return knowledgeEvent(id, { kind: 'learn', rating: ['none', 'fuzzy', 'remembered'].includes(rating) ? rating : '' }, now);
}
function onAnswer(event) {
  const q = questionsMap.get(event.questionId);
  if (q) knowledgeEvent(q.knowledgeId, { id: event.eventId, kind: 'answer', correct: event.isCorrect, questionId: q.id }, event.answeredAt);
}
function getPendingEvents() { const v = wx.getStorageSync(KEY); return v && v.pending || []; }
function importLegacySnapshot(snapshot) {
  if (!snapshot.initialized || snapshot.learningVersion !== 4) return;
  const value = ensure();
  if (value.remoteLegacyImported) return;
  value.remoteLegacyImported = true;
  const seeds = {};
  Object.values(snapshot.progress || {}).forEach((p) => {
    const set = content.getKnowledgeSet(p.topicId, p.setIndex);
    if (set) set.items.slice(0, p.maxIndex + 1).forEach((k) => { seeds[k.id] = { learned: true }; });
  });
  Object.values(snapshot.stats || {}).forEach((r) => {
    const q = questionsMap.get(r.questionId);
    if (q && r.activeWrong) seeds[q.knowledgeId] = { ...seeds[q.knowledgeId], wrong: ((seeds[q.knowledgeId] || {}).wrong || 0) + (r.wrong || 1) };
  });
  Object.keys(seeds).forEach((id) => {
    if (value.base.records[id] || value.pending.some((e) => e.kind === "seed" && e.knowledgeId === id) || (snapshot.learningState && snapshot.learningState.records[id])) return;
    const k = knowledgeMap.get(id);
    value.pending.push({ id: uid(), at: 1, kind: 'seed', knowledgeId: id, topicId: k.topicId, moduleId: k.moduleId, ...seeds[id] });
  });
  value.state = model.replay(value.pending, value.base);
  write(value, false);
}
function applySnapshot(snapshot, acked = [], now = Date.now()) {
  if (snapshot.learningVersion !== 4 || !snapshot.learningState) return false;
  const value = ensure(now);
  const ids = new Set(acked);
  value.pending = value.pending.filter((e) => !ids.has(e.id));
  value.base = snapshot.learningState;
  value.state = model.replay(value.pending, value.base, now);
  write(value, false);
  return true;
}
function reviewItems(topicId, now = Date.now()) {
  return Object.values(getState(now).records).filter((r) => !topicId || r.topicId === topicId).map((r) => {
    const k = knowledgeMap.get(r.knowledgeId); if (!k) return null;
    const state = model.status(r, now);
    return { ...r, id: k.id, title: k.title, summary: k.summary, state, status: model.labels[state],
      questionId: (related.get(k.id) || [])[0] ? related.get(k.id)[0].id : '',
      date: state === 'due' ? '已到期，优先复习' : r.nextReviewAt ? model.dayKey(r.nextReviewAt) : state === 'mastered' ? '已完成间隔检验' : '尚未安排' };
  }).filter(Boolean).sort((a, b) => (a.state === 'due' ? 0 : 1) - (b.state === 'due' ? 0 : 1) || a.nextReviewAt - b.nextReviewAt || b.wrongCount - a.wrongCount);
}
function topicSummary(topicId, now = Date.now()) {
  const items = reviewItems(topicId, now);
  return { learnedCount: items.filter((r) => r.firstLearnedAt).length,
    masteredCount: items.filter((r) => r.state === 'mastered').length,
    dueCount: items.filter((r) => r.state === 'due').length,
    consolidatingCount: items.filter((r) => ['due', 'consolidating'].includes(r.state)).length };
}
function makeTask(k, phase, question) { return { id: `${phase}:${k.id}`, phase, knowledgeId: k.id, questionId: question ? question.id : '' }; }
const DEFAULT_SETTINGS = { id: 'default', version: 2, topicId: 'idiom', batchId: '', newCount: 10 };
function studyLimit(topicId) {
  return Math.min(200, content.knowledge.filter((k) => k.topicId === topicId).length);
}
function getStudySettings(now = Date.now()) {
  const saved = getState(now).studySettings;
  if (!saved) return { ...DEFAULT_SETTINGS };
  const topicId = content.getTopicById(saved.topicId) ? saved.topicId : DEFAULT_SETTINGS.topicId;
  const newCount = Math.max(1, Math.min(studyLimit(topicId), Number.isInteger(saved.newCount) ? saved.newCount : 10));
  // Upgrade old batch preferences once, through the same durable event queue.
  // Started plans keep their tasks; the next untouched plan uses the whole category.
  if (saved.version !== 2 || saved.batchId || saved.topicId !== topicId || saved.newCount !== newCount) {
    const event = emit({ kind: 'preferences', settings: { version: 2, topicId, batchId: '', newCount } }, now);
    return { ...event.settings, id: event.id };
  }
  return { id: saved.id, version: 2, topicId, batchId: '', newCount };
}
function settingsLabel(settings) {
  if (!settings) return '原有学习安排';
  const topic = content.getTopicById(settings.topicId);
  return topic ? topic.name : '学习安排';
}
function hasStarted(plan) { return !!(plan && (Object.keys(plan.started).length || Object.keys(plan.completed).length)); }
function saveStudySettings(input, now = Date.now()) {
  const topic = content.getTopicById(input.topicId);
  if (!topic || !Number.isInteger(input.newCount) || input.newCount < 1 || input.newCount > studyLimit(topic.id)) throw new Error('请选择分类内有效的新学数量，最多 200 个');
  const current = getStudySettings(now);
  if (current.topicId === topic.id && current.newCount === input.newCount) return { changed: false };
  const plan = getState(now).days[model.dayKey(now)];
  emit({ kind: 'preferences', settings: { version: 2, topicId: topic.id, batchId: '', newCount: input.newCount } }, now);
  ensurePlan(now);
  return { changed: true, tomorrow: hasStarted(plan) };
}
function ensurePlan(now = Date.now()) {
  const settings = getStudySettings(now), state = getState(now), day = model.dayKey(now);
  const prior = state.days[day];
  if (prior && (hasStarted(prior) || (prior.settings && prior.settings.id === settings.id && prior.settings.version === 2))) return prior;
  const ordered = content.knowledge.filter((k) => k.topicId === settings.topicId);
  const scope = new Set(ordered.map((k) => k.id));
  const due = reviewItems(settings.topicId, now).filter((r) => r.state === 'due' && scope.has(r.id)).slice(0, 10);
  const dueIds = new Set(due.map((r) => r.id));
  const fresh = ordered.filter((k) => !dueIds.has(k.id) && !(state.records[k.id] && state.records[k.id].firstLearnedAt)).slice(0, settings.newCount);
  const practiceSource = fresh.length ? fresh : ordered.filter((k) => { const r = state.records[k.id]; return r && r.firstLearnedAt && r.reviewStage < 4 && !r.lastReviewedAt && !dueIds.has(k.id); });
  const practice = practiceSource.filter((k) => (related.get(k.id) || []).length).slice(0, 5);
  const tasks = due.map((r) => makeTask(knowledgeMap.get(r.id), 'review', (related.get(r.id) || [])[0]))
    .concat(fresh.map((k) => makeTask(k, 'new')))
    .concat(practice.map((k) => makeTask(k, 'practice', related.get(k.id)[0])));
  emit({ kind: 'plan', day, tasks, settings }, now);
  return getState(now).days[day];
}
function dailyView(now = Date.now()) {
  const plan = ensurePlan(now);
  const completed = plan.tasks.filter((t) => plan.completed[t.id]);
  const remaining = plan.tasks.filter((t) => !plan.completed[t.id]);
  const next = remaining[0] || null;
  const counts = (phase) => remaining.filter((t) => t.phase === phase).length;
  const done = completed.map((t) => ({ ...t, ...plan.completed[t.id] }));
  const answers = done.filter((t) => t.kind === 'answer' && !t.redacted);
  const state = getState(now);
  const settings = getStudySettings(now);
  const involved = new Set(done.map((t) => t.knowledgeId));
  const tomorrow = reviewItems(null, now).filter((r) => r.nextReviewAt && r.nextReviewAt < model.afterDays(now, 2) && r.state !== 'mastered');
  const newlyMastered = new Set(state.activity.filter((a) => model.dayKey(a.at) === plan.day && a.newlyMastered && involved.has(a.knowledgeId)).map((a) => a.knowledgeId)).size;
  return { subject: settingsLabel(plan.settings), goal: plan.settings ? plan.settings.newCount : null,
    settingsPending: hasStarted(plan) && (!plan.settings || plan.settings.id !== settings.id), nextSubject: settingsLabel(settings), nextGoal: settings.newCount,
    day: plan.day, planId: plan.id, total: plan.tasks.length, completed: completed.length, remaining: remaining.length,
    progress: plan.tasks.length ? Math.round(completed.length / plan.tasks.length * 100) : 100,
    due: counts('review'), fresh: counts('new'), practice: counts('practice') + counts('retry'), minutes: Math.ceil(remaining.reduce((sum, t) => sum + (t.phase === 'new' ? 60 : 40), 0) / 60),
    started: completed.length > 0 || Object.keys(plan.started).length > 0,
    button: remaining.length ? (completed.length || Object.keys(plan.started).length ? '继续今日学习' : '开始今日学习') : '查看今日总结',
    next: next ? { ...next, started: !!plan.started[next.id], knowledge: knowledgeMap.get(next.knowledgeId), question: questionsMap.get(next.questionId) || null } : null,
    summary: { newCount: done.filter((t) => t.phase === 'new').length, reviewCount: done.filter((t) => t.phase === 'review').length,
      exerciseCount: answers.length, accuracy: answers.length ? Math.round(answers.filter((t) => t.correct).length / answers.length * 100) : null,
      newlyMastered, weakCount: Array.from(involved).filter((id) => ['due', 'consolidating'].includes(model.status(state.records[id], now))).length,
      tomorrowCount: tomorrow.length, tomorrowTitles: tomorrow.slice(0, 3).map((r) => r.title).join('、') } };
}
function beginTask(now = Date.now()) {
  const v = dailyView(now); if (!v.next || v.next.started) return;
  emit({ kind: 'begin', day: v.day, planId: v.planId, taskId: v.next.id }, now);
}
function completeTask(taskId, result = {}, now = Date.now()) {
  const v = dailyView(now), t = v.next;
  if (!t || t.id !== taskId) return false;
  const kind = t.question ? 'answer' : t.phase === 'new' ? 'learn' : 'recall';
  if (kind === 'answer' && !t.question.options.some((o) => o.id === result.selected)) return false;
  const correct = kind === 'answer' ? result.selected === t.question.answer : result.rating === 'remembered';
  const event = knowledgeEvent(t.knowledgeId, { id: `${v.planId}:${taskId}`, kind, day: v.day, planId: v.planId, taskId,
    questionId: t.questionId, phase: t.phase, retry: t.phase === 'retry', rating: result.rating || '', ...(kind === 'learn' ? {} : { correct }) }, now);
  // A persisted completion is the recovery journal for the legacy answer counter.
  if (kind === 'answer') recordDailyAnswer(event);
  wx.removeStorageSync(DRAFT_KEY);
  return true;
}
function recordDailyAnswer(e) {
  const q = questionsMap.get(e.questionId); if (!q) return;
  storage.recordQuestionResult(q.id, q.moduleId, q.topicId, e.correct, { eventId: e.id, answeredAt: e.at, skipLearning: true });
}
function repairDailyAnswers() {
  const value = ensure();
  value.pending.filter((e) => e.kind === 'answer' && e.taskId && e.at > (value.state.resetAt || 0)).forEach(recordDailyAnswer);
}
function saveDraft(task, values) { wx.setStorageSync(DRAFT_KEY, { day: model.dayKey(Date.now()), taskId: task.id, ...values }); }
function getDraft(task) { const d = wx.getStorageSync(DRAFT_KEY); return d && d.day === model.dayKey(Date.now()) && d.taskId === task.id ? d : {}; }
function groupAction(topicId, setIndex, now = Date.now(), allowDue = true) {
  const set = content.getKnowledgeSet(topicId, setIndex);
  if (!set) return { type: 'catalog', label: '查看全部内容', topicId };
  const state = getState(now);
  const learnedCount = set.items.filter((k) => state.records[k.id] && state.records[k.id].firstLearnedAt).length;
  const due = allowDue && set.items.some((k) => model.status(state.records[k.id], now) === 'due');
  const common = { topicId, setIndex, learnedCount, total: set.count, completed: learnedCount === set.count };
  if (due) return { ...common, type: 'review', label: '今日复习' };
  if (learnedCount < set.count) return { ...common, type: 'learn', label: learnedCount ? '继续学习' : '开始学习', index: set.items.findIndex((k) => !(state.records[k.id] && state.records[k.id].firstLearnedAt)) };
  const questionIds = content.questions.filter((q) => set.items.some((k) => k.id === q.knowledgeId)).map((q) => q.id);
  if (!state.groups[`${topicId}_${setIndex}`] && questionIds.length) return { ...common, type: 'practice', label: '开始本组练习', questionIds };
  const next = content.getSetsForTopic(topicId).find((s) => s.index > setIndex && s.items.some((k) => !(state.records[k.id] && state.records[k.id].firstLearnedAt)));
  return next ? { ...common, type: 'next', label: '学习下一组', nextIndex: next.index } : { ...common, type: 'catalog', label: '本专项已学完 · 查看全部内容' };
}
function practiceGroup(topicId, setIndex) {
  const set = content.getKnowledgeSet(topicId, setIndex); if (!set) return;
  const ids = new Set(set.items.map((k) => k.id));
  const questionIds = content.questions.filter((q) => ids.has(q.knowledgeId)).map((q) => q.id);
  if (!questionIds.length) { wx.showToast({ title: '暂无配套题，已安排回忆复习', icon: 'none' }); return; }
  storage.setExamRequest({ mode: 'questionIds', questionIds, direct: true, count: 5, groupKey: `${topicId}_${setIndex}`, sessionMode: 'practice', title: `${content.getTopicName(topicId)} · 本组巩固` });
  wx.switchTab({ url: '/pages/exam/index' });
}
function navigateAction(action) {
  if (action.type === 'practice') return practiceGroup(action.topicId, action.setIndex);
  if (action.type === 'review') return wx.navigateTo({ url: `/pages/review-detail/index?topicId=${action.topicId}` });
  if (action.type === 'catalog') return wx.navigateTo({ url: `/pages/catalog/index?topicId=${action.topicId}` });
  wx.navigateTo({ url: `/pages/learn/index?topicId=${action.topicId}&setIndex=${action.type === 'next' ? action.nextIndex : action.setIndex}&index=${action.index || 0}` });
}
function resetAnswers() { emit({ kind: 'reset' }); }
function recall(id, rating) { return knowledgeEvent(id, { kind: 'recall', correct: rating === 'remembered', rating }); }
function markGroupPracticed(groupKey) { if (groupKey) emit({ kind: 'group', groupKey }); }
function recommendation(results) {
  const wrong = results.filter((r) => !r.isCorrect);
  const groups = {};
  wrong.forEach((r) => { if (!groups[r.topicId]) groups[r.topicId] = { id: r.topicId, name: content.getTopicName(r.topicId), count: 0 }; groups[r.topicId].count += 1; });
  const weakTopics = Object.values(groups).sort((a,b) => b.count - a.count);
  const weakTitles = Array.from(new Set(wrong.map((r) => { const k = knowledgeMap.get(r.knowledgeId); return k ? k.title : ''; }).filter(Boolean))).slice(0,5).join('、');
  return wrong.length ? { type: 'retry', title: `立即巩固 ${wrong.length} 道错题`, description: '先看错因，再完成一轮重练；之后按日期继续复习。', questionIds: wrong.map((r) => r.id), topicId: weakTopics[0].id, weakTopics, weakTitles }
    : { type: 'learn', title: '继续积累新知识', description: '本轮全部答对，后续仍会按计划检验记忆。', topicId: results[0] ? results[0].topicId : 'idiom', questionIds: [] };
}
function overview(now = Date.now()) {
  const state = getState(now), today = dailyView(now);
  const answers = state.activity.filter((e) => e.kind === 'answer' && e.at >= model.afterDays(now, -6) && e.at < model.afterDays(now, 1));
  return { ...topicSummary(null, now), today, sevenDayAccuracy: answers.length ? Math.round(answers.filter((e) => e.correct).length / answers.length * 100) : null };
}
module.exports = { getState, getPendingEvents, importLegacySnapshot, applySnapshot, startLearning, learn, onAnswer, reviewItems, topicSummary,
  getStudySettings, saveStudySettings, studyLimit, settingsLabel, ensurePlan, dailyView, beginTask, completeTask, repairDailyAnswers, getDraft, saveDraft, groupAction, navigateAction, practiceGroup,
  resetAnswers, recall, markGroupPracticed, recommendation, overview, model };
