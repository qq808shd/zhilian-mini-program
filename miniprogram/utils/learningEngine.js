const content = require('../data/content');
const storage = require('./storage');
const model = require('./learningModel');
// Retain the existing key so upgrading never abandons an offline queue.
const KEY = 'zhilian_learning_v4';
const DRAFT_KEY = 'zhilian_daily_draft_v5';
const LEGACY_DRAFT_KEY = 'zhilian_daily_draft_v4';
const RATINGS = ['none', 'fuzzy', 'remembered'];
const DEGREE_LABELS = { none: '陌生', fuzzy: '了解', remembered: '掌握', known: '熟知' };
const knowledgeMap = new Map(content.knowledge.map(k => [k.id, k]));
const questionsMap = new Map(content.questions.map(q => [q.id, q]));
const related = new Map();
content.questions.forEach(q => { if (!related.has(q.knowledgeId)) related.set(q.knowledgeId, []); related.get(q.knowledgeId).push(q); });
function uid() { return 'v5:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 12); }
function write(value, notify = true) { wx.setStorageSync(KEY, value); if (notify) storage.notifyCloudSync(); }
function legacySeeds(progress, stats) {
  const seeds = {};
  Object.values(progress || {}).forEach(p => {
    const set = content.getKnowledgeSet(p.topicId, p.setIndex);
    if (set) set.items.slice(0, p.maxIndex + 1).forEach(k => { seeds[k.id] = { learned: true }; });
  });
  Object.values(stats || {}).forEach(r => {
    const q = questionsMap.get(r.questionId);
    if (q && r.activeWrong) seeds[q.knowledgeId] = { ...seeds[q.knowledgeId], wrong: ((seeds[q.knowledgeId] || {}).wrong || 0) + (r.wrong || 1) };
  });
  return seeds;
}
function seedEvent(id, values) {
  const k = knowledgeMap.get(id);
  return { id: uid(), kind: 'seed', learningVersion: 5, at: 1, knowledgeId: id, topicId: k.topicId, moduleId: k.moduleId, ...values };
}
function ensure(now = Date.now()) {
  let value = wx.getStorageSync(KEY);
  if (value && [4, 5].includes(value.version)) {
    if (value.version !== 5 || value.state.version !== 5) {
      value.state = model.upgradeState(value.state);
      value.version = 5;
      write(value, false);
    }
    return value;
  }
  const seeds = legacySeeds(storage.getStudyProgress(), storage.getQuestionStats());
  const pending = Object.keys(seeds).map(id => seedEvent(id, seeds[id]));
  value = { version: 5, base: model.emptyState(), pending, state: model.replay(pending, null, now) };
  write(value, pending.length > 0);
  return value;
}
function getState(now = Date.now()) { return ensure(now).state; }
function emit(data, now = Date.now()) {
  const value = ensure(now);
  const event = { id: uid(), learningVersion: 5, at: Math.max(now, (value.lastAt || 0) + 1), ...data };
  value.lastAt = event.at;
  if (value.pending.some(e => e.id === event.id)) return event;
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
function startLearning() { /* Reading alone does not complete learning. */ }
function learn(id, rating, now = Date.now()) {
  if (!RATINGS.includes(rating)) return null;
  return knowledgeEvent(id, { kind: 'assessment', rating }, now);
}
function recall(id, rating, now = Date.now()) { return learn(id, rating, now); }
function setFamiliar(id, excluded, now = Date.now()) {
  if (typeof excluded !== 'boolean') return null;
  return knowledgeEvent(id, { kind: 'exemption', excluded }, now);
}
function onAnswer(event) {
  const q = questionsMap.get(event.questionId);
  if (q) knowledgeEvent(q.knowledgeId, { id: event.eventId, kind: 'answer', correct: event.isCorrect, questionId: q.id }, event.answeredAt);
}
function getPendingEvents() { const v = wx.getStorageSync(KEY); return v && v.pending || []; }
function importLegacySnapshot(snapshot) {
  if (!snapshot.initialized || snapshot.learningVersion !== 5) return;
  const value = ensure();
  if (value.remoteLegacyImported) return;
  value.remoteLegacyImported = true;
  const seeds = legacySeeds(snapshot.progress, snapshot.stats);
  Object.keys(seeds).forEach(id => {
    if (value.base.records[id] || value.pending.some(e => e.kind === 'seed' && e.knowledgeId === id) || (snapshot.learningState && snapshot.learningState.records[id])) return;
    value.pending.push(seedEvent(id, seeds[id]));
  });
  value.state = model.replay(value.pending, value.base);
  write(value, false);
}
function applySnapshot(snapshot, acked = [], now = Date.now()) {
  if (snapshot.learningVersion !== 5 || !snapshot.learningState || snapshot.learningState.version !== 5) return false;
  const value = ensure(now), ids = new Set(acked);
  if (Object.keys(value.state.learningResets || {}).length && snapshot.learningResetVersion !== model.LEARNING_RESET_VERSION) return false;
  value.pending = value.pending.filter(e => !ids.has(e.id));
  value.base = snapshot.learningState;
  value.state = model.replay(value.pending, value.base, now);
  write(value, false);
  return true;
}
function recordView(r, now) {
  const learned = !!(r && r.firstLearnedAt);
  const degree = model.familiarity(r);
  const excluded = !!(r && r.excludedFromReview);
  const due = model.isDue(r, now);
  return { learned, rating: r && RATINGS.includes(r.selfRating) ? r.selfRating : degree === 'known' ? 'remembered' : degree,
    degreeLabel: DEGREE_LABELS[degree] || '陌生', excluded, due,
    date: !learned ? '未学习' : excluded ? '已免复习' : due ? '今日待复习' : r.nextReviewAt ? '下次复习 ' + model.dayKey(r.nextReviewAt) : '等待安排' };
}
function getKnowledgeView(id, now = Date.now()) { return recordView(getState(now).records[id], now); }
function reviewItems(topicId, now = Date.now()) {
  return Object.values(getState(now).records).filter(r => r.firstLearnedAt && (!topicId || r.topicId === topicId)).map(r => {
    const k = knowledgeMap.get(r.knowledgeId); if (!k) return null;
    const view = recordView(r, now), state = model.status(r, now);
    return { ...r, ...view, id: k.id, title: k.title, summary: k.summary, state, status: view.degreeLabel,
      questionId: (related.get(k.id) || [])[0] ? related.get(k.id)[0].id : '' };
  }).filter(Boolean).sort((a, b) => Number(b.due) - Number(a.due) || (a.nextReviewAt || Infinity) - (b.nextReviewAt || Infinity) || (b.wrongCount || 0) - (a.wrongCount || 0));
}
function topicSummary(topicId, now = Date.now()) {
  const items = reviewItems(topicId, now);
  const total = content.knowledge.filter(k => !topicId || k.topicId === topicId).length;
  return { total, learnedCount: items.length, unlearnedCount: total - items.length,
    strangerCount: items.filter(r => !r.excluded && r.rating === 'none').length,
    understoodCount: items.filter(r => !r.excluded && r.rating === 'fuzzy').length,
    masteredCount: items.filter(r => !r.excluded && r.rating === 'remembered').length,
    familiarCount: items.filter(r => r.excluded).length,
    dueCount: items.filter(r => r.due).length,
    consolidatingCount: items.filter(r => !r.excluded && r.rating !== 'remembered').length,
    progress: total ? Math.round(items.length / total * 100) : 0 };
}
const DEFAULT_SETTINGS = { id: 'default', version: 3, topicId: 'idiom', batchId: '', newCount: 10 };
function studyLimit(topicId) { return Math.min(200, content.knowledge.filter(k => k.topicId === topicId).length); }
function getStudySettings(now = Date.now()) {
  const saved = getState(now).studySettings;
  if (!saved) return { ...DEFAULT_SETTINGS };
  const topicId = content.getTopicById(saved.topicId) ? saved.topicId : DEFAULT_SETTINGS.topicId;
  const newCount = Math.max(1, Math.min(studyLimit(topicId), Number.isInteger(saved.newCount) ? saved.newCount : 10));
  if (saved.version !== 3 || saved.batchId || saved.topicId !== topicId || saved.newCount !== newCount) {
    const event = emit({ kind: 'preferences', settings: { version: 3, topicId, batchId: '', newCount } }, now);
    return { ...event.settings, id: event.id };
  }
  return { id: saved.id, version: 3, topicId, batchId: '', newCount };
}
function settingsLabel(settings) { const topic = settings && content.getTopicById(settings.topicId); return topic ? topic.name : '学习内容'; }
function saveStudySettings(input, now = Date.now()) {
  const topic = content.getTopicById(input.topicId);
  if (!topic || !Number.isInteger(input.newCount) || input.newCount < 1 || input.newCount > studyLimit(topic.id)) throw new Error('请选择分类内有效的新学数量，最多 200 个');
  const current = getStudySettings(now);
  if (current.topicId === topic.id && current.newCount === input.newCount) return { changed: false };
  emit({ kind: 'preferences', settings: { version: 3, topicId: topic.id, batchId: '', newCount: input.newCount } }, now);
  return { changed: true, tomorrow: false };
}
function makeTask(k, phase) { return { id: phase + ':' + k.id, phase, knowledgeId: k.id, questionId: '' }; }
function sessionScope(now, mode, topicId) {
  const settings = getStudySettings(now);
  const topic = content.getTopicById(topicId || settings.topicId);
  if (!topic) throw new Error('学习范围不存在');
  const selectedMode = mode === 'review' ? 'review' : 'new';
  return { settings: { ...settings, topicId: topic.id, newCount: Math.min(settings.newCount, studyLimit(topic.id)) }, mode: selectedMode, topicId: topic.id,
    day: model.dayKey(now), key: model.dayKey(now) + '/' + selectedMode + '/' + topic.id };
}
function learnedToday(records, topicId, now) {
  return Object.values(records).filter(r => r.topicId === topicId && r.firstLearnedAt && model.dayKey(r.firstLearnedAt) === model.dayKey(now)).length;
}
function ensurePlan(now = Date.now(), mode = 'new', topicId) {
  const scope = sessionScope(now, mode, topicId), state = getState(now), prior = state.days[scope.key];
  if (prior && scope.mode === 'review') {
    const existing = new Set(prior.tasks.map(t => t.knowledgeId));
    const additional = reviewItems(scope.topicId, now).filter(r => r.due && !existing.has(r.id));
    if (!additional.length) return prior;
    emit({ kind: 'plan', day: scope.key, mode: scope.mode, topicId: scope.topicId,
      tasks: prior.tasks.concat(additional.map(r => makeTask(knowledgeMap.get(r.id), 'review'))), settings: scope.settings }, now);
    return getState(now).days[scope.key];
  }
  if (prior && prior.settings && prior.settings.id === scope.settings.id) return prior;
  let tasks;
  if (scope.mode === 'review') {
    tasks = reviewItems(scope.topicId, now).filter(r => r.due).map(r => makeTask(knowledgeMap.get(r.id), 'review'));
  } else {
    const ordered = content.knowledge.filter(k => k.topicId === scope.topicId);
    const legacy = state.days[scope.day];
    const legacyNew = !prior && legacy ? legacy.tasks.filter(t => t.phase === 'new' && knowledgeMap.has(t.knowledgeId) && knowledgeMap.get(t.knowledgeId).topicId === scope.topicId).map(t => knowledgeMap.get(t.knowledgeId)) : [];
    const candidates = Array.from(new Map(legacyNew.concat(ordered).map(k => [k.id, k])).values());
    const retained = prior ? prior.tasks.filter(t => prior.completed[t.id]) : [];
    const remaining = Math.max(0, scope.settings.newCount - learnedToday(state.records, scope.topicId, now));
    tasks = retained.concat(candidates.filter(k => !(state.records[k.id] && state.records[k.id].firstLearnedAt)).slice(0, remaining).map(k => makeTask(k, 'new')));
  }
  emit({ kind: 'plan', day: scope.key, mode: scope.mode, topicId: scope.topicId, tasks, settings: scope.settings }, now);
  return getState(now).days[scope.key];
}
function dailyView(now = Date.now(), mode = 'new', topicId) {
  const scope = sessionScope(now, mode, topicId), plan = ensurePlan(now, scope.mode, scope.topicId), state = getState(now);
  const eligible = t => {
    const r = state.records[t.knowledgeId];
    return !plan.completed[t.id] && (scope.mode === 'new' ? !(r && r.firstLearnedAt) : model.isDue(r, now));
  };
  const limit = scope.mode === 'new' ? Math.max(0, scope.settings.newCount - learnedToday(state.records, scope.topicId, now)) : plan.tasks.length;
  const remaining = plan.tasks.filter(eligible).slice(0, limit);
  const done = plan.tasks.filter(t => !eligible(t));
  const next = remaining[0] || null;
  const total = done.length + remaining.length;
  const summary = topicSummary(scope.topicId, now);
  const pendingReview = reviewItems(scope.topicId, now).filter(r => r.due);
  const todayNew = learnedToday(state.records, scope.topicId, now);
  return { subject: settingsLabel(scope.settings), topicId: scope.topicId, mode: scope.mode, goal: scope.settings.newCount,
    day: scope.day, sessionKey: scope.key, planId: plan.id, total, completed: done.length, remaining: remaining.length,
    progress: total ? Math.round(done.length / total * 100) : 0, due: pendingReview.length,
    fresh: scope.mode === 'new' ? remaining.length : Math.min(Math.max(0, scope.settings.newCount - todayNew), summary.unlearnedCount),
    started: done.length > 0 || Object.keys(plan.started).length > 0,
    next: next ? { ...next, sessionKey: scope.key, started: !!plan.started[next.id], knowledge: knowledgeMap.get(next.knowledgeId) } : null,
    summary: { newCount: todayNew, reviewCount: Object.values(state.days).filter(p => p.day && p.day.startsWith(scope.day + '/review/') && p.topicId === scope.topicId).reduce((sum, p) => sum + Object.keys(p.completed).length, 0), ...summary } };
}
function beginTask(now = Date.now(), mode = 'new', topicId) {
  const v = dailyView(now, mode, topicId); if (!v.next || v.next.started) return;
  emit({ kind: 'begin', day: v.sessionKey, planId: v.planId, taskId: v.next.id }, now);
}
function completeTask(taskId, result = {}, now = Date.now(), mode = 'new', topicId) {
  const v = dailyView(now, mode, topicId), plan = getState(now).days[v.sessionKey];
  const t = plan && plan.tasks.find(task => task.id === taskId);
  const record = t && getState(now).records[t.knowledgeId];
  const eligible = t && !plan.completed[t.id] && (v.mode === 'new' ? !(record && record.firstLearnedAt) && v.remaining > 0 : model.isDue(record, now));
  if (!eligible || (!RATINGS.includes(result.rating) && result.excluded !== true)) return false;
  knowledgeEvent(t.knowledgeId, { id: v.planId + ':' + taskId, kind: result.excluded ? 'exemption' : 'assessment', day: v.sessionKey, planId: v.planId,
    taskId, questionId: '', phase: t.phase, ...(result.excluded ? { excluded: true } : { rating: result.rating }) }, now);
  const drafts = wx.getStorageSync(DRAFT_KEY) || {};
  delete drafts[v.sessionKey + ':' + t.id]; wx.setStorageSync(DRAFT_KEY, drafts);
  return true;
}
function recordDailyAnswer(e) {
  const q = questionsMap.get(e.questionId); if (!q) return;
  storage.recordQuestionResult(q.id, q.moduleId, q.topicId, e.correct, { eventId: e.id, answeredAt: e.at, skipLearning: true });
}
function repairDailyAnswers() { const value = ensure(); value.pending.filter(e => e.kind === 'answer' && e.taskId && e.at > (value.state.resetAt || 0)).forEach(recordDailyAnswer); }
function saveDraft(task, values) {
  const drafts = wx.getStorageSync(DRAFT_KEY) || {};
  Object.keys(drafts).forEach(key => { if (!key.startsWith(model.dayKey(Date.now()) + '/')) delete drafts[key]; });
  const topicId = task.sessionKey.split('/')[2], reset = (getState().learningResets || {})[topicId];
  drafts[task.sessionKey + ':' + task.id] = { ...values, resetId: reset ? reset.id : '' }; wx.setStorageSync(DRAFT_KEY, drafts);
}
function getDraft(task) {
  const drafts = wx.getStorageSync(DRAFT_KEY) || {}, saved = drafts[task.sessionKey + ':' + task.id];
  const topicId = task.sessionKey.split('/')[2], reset = (getState().learningResets || {})[topicId];
  if (reset && (!saved || saved.resetId !== reset.id)) return {};
  if (saved) return saved;
  const old = wx.getStorageSync(LEGACY_DRAFT_KEY);
  return old && old.day === model.dayKey(Date.now()) && old.taskId === task.id ? old : {};
}
function groupAction(topicId, setIndex, now = Date.now()) {
  const set = content.getKnowledgeSet(topicId, setIndex);
  if (!set) return { type: 'catalog', label: '查看全部内容', topicId };
  const state = getState(now), isLearned = k => state.records[k.id] && state.records[k.id].firstLearnedAt;
  const learnedCount = set.items.filter(isLearned).length;
  const common = { topicId, setIndex, learnedCount, total: set.count, completed: learnedCount === set.count };
  if (learnedCount < set.count) return { ...common, type: 'learn', label: learnedCount ? '继续学习' : '开始学习', index: set.items.findIndex(k => !isLearned(k)) };
  const next = content.getSetsForTopic(topicId).find(s => s.index > setIndex && s.items.some(k => !isLearned(k)));
  return next ? { ...common, type: 'next', label: '学习下一组', nextIndex: next.index } : { ...common, type: 'catalog', label: '本分类已学完 · 查看内容' };
}
function practiceGroup(topicId, setIndex) {
  const set = content.getKnowledgeSet(topicId, setIndex); if (!set) return;
  const ids = new Set(set.items.map(k => k.id));
  const questionIds = content.questions.filter(q => ids.has(q.knowledgeId)).map(q => q.id);
  if (!questionIds.length) { wx.showToast({ title: '本组暂无练习题', icon: 'none' }); return; }
  storage.setExamRequest({ mode: 'questionIds', questionIds, direct: true, count: 5, groupKey: topicId + '_' + setIndex, sessionMode: 'practice', title: content.getTopicName(topicId) + ' · 自由练习' });
  wx.switchTab({ url: '/pages/exam/index' });
}
function navigateAction(action) {
  if (action.type === 'practice') return practiceGroup(action.topicId, action.setIndex);
  if (action.type === 'review') return wx.navigateTo({ url: '/pages/today-study/index?mode=review&topicId=' + action.topicId });
  if (action.type === 'catalog') return wx.navigateTo({ url: '/pages/catalog/index?topicId=' + action.topicId });
  wx.navigateTo({ url: '/pages/learn/index?topicId=' + action.topicId + '&setIndex=' + (action.type === 'next' ? action.nextIndex : action.setIndex) + '&index=' + (action.index || 0) });
}
function resetAnswers() { emit({ kind: 'reset' }); }
function resetLearning(topicId, now = Date.now()) {
  if (!content.getTopicById(topicId)) throw new Error('学习范围不存在');
  return emit({ kind: 'reset-learning', topicId, knowledgeIds: content.knowledge.filter(k => k.topicId === topicId).map(k => k.id) }, now);
}
function markGroupPracticed(groupKey) { if (groupKey) emit({ kind: 'group', groupKey }); }
function recommendation(results) {
  const wrong = results.filter(r => !r.isCorrect), groups = {};
  wrong.forEach(r => { if (!groups[r.topicId]) groups[r.topicId] = { id: r.topicId, name: content.getTopicName(r.topicId), count: 0 }; groups[r.topicId].count += 1; });
  const weakTopics = Object.values(groups).sort((a, b) => b.count - a.count);
  const weakTitles = Array.from(new Set(wrong.map(r => { const k = knowledgeMap.get(r.knowledgeId); return k ? k.title : ''; }).filter(Boolean))).slice(0, 5).join('、');
  return wrong.length ? { type: 'retry', title: '再练 ' + wrong.length + ' 道错题', description: '按需重练本轮错题，学习与到期复习可以单独进行。', questionIds: wrong.map(r => r.id), topicId: weakTopics[0].id, weakTopics, weakTitles }
    : { type: 'learn', title: '继续积累新知识', description: '本轮全部答对，可以继续学习或稍后再练。', topicId: results[0] ? results[0].topicId : 'idiom', questionIds: [] };
}
function overview(now = Date.now()) {
  const state = getState(now), today = dailyView(now);
  const answers = state.activity.filter(e => e.kind === 'answer' && e.at >= model.afterDays(now, -6) && e.at < model.afterDays(now, 1));
  const completed = new Set(state.activity.filter(e => ['assessment', 'exemption'].includes(e.kind) && model.dayKey(e.at) === model.dayKey(now)).map(e => e.knowledgeId)).size;
  return { ...topicSummary(null, now), today: { ...today, completed }, sevenDayAccuracy: answers.length ? Math.round(answers.filter(e => e.correct).length / answers.length * 100) : null };
}
module.exports = { getState, getPendingEvents, importLegacySnapshot, applySnapshot, startLearning, learn, recall, setFamiliar, getKnowledgeView, onAnswer, reviewItems, topicSummary,
  getStudySettings, saveStudySettings, studyLimit, settingsLabel, ensurePlan, dailyView, beginTask, completeTask, repairDailyAnswers, getDraft, saveDraft, groupAction, navigateAction, practiceGroup,
  resetAnswers, resetLearning, markGroupPracticed, recommendation, overview, model };
