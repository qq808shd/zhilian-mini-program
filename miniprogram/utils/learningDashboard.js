// V6 presentation only: no storage, navigation, scheduling or protocol writes.
const content = require('../data/content');
const model = require('./learningModel');
const knowledge = new Map(content.knowledge.map(k => [k.id, k]));
const topicKnowledge = new Map();
const related = new Map();
content.knowledge.forEach(k => {
  if (!topicKnowledge.has(k.topicId)) topicKnowledge.set(k.topicId, []);
  topicKnowledge.get(k.topicId).push(k.id);
});
content.questions.forEach(q => {
  if (!knowledge.has(q.knowledgeId) || !q.options.some(o => o.id === q.answer)) return;
  if (!related.has(q.knowledgeId)) related.set(q.knowledgeId, []);
  related.get(q.knowledgeId).push(q.id);
});
const validQuestions = new Set([...related.values()].flat());

function completion(state, now, topicId) {
  const day = model.dayKey(now), fresh = new Set(), review = new Set();
  Object.values(state.records).forEach(r => {
    if (knowledge.has(r.knowledgeId) && (!topicId || r.topicId === topicId) && r.firstLearnedAt && model.dayKey(r.firstLearnedAt) === day) fresh.add(r.knowledgeId);
  });
  Object.values(state.days).forEach(p => {
    Object.values(p.completed || {}).forEach(c => {
      const k = knowledge.get(c.knowledgeId);
      if (k && (!topicId || k.topicId === topicId) && c.phase === 'review' && !c.redacted && model.dayKey(c.at) === day) review.add(k.id);
    });
  });
  return { newCount: fresh.size, reviewCount: review.size, completed: fresh.size + review.size };
}
function summary(state, now, topicId) {
  const ids = topicId ? topicKnowledge.get(topicId) || [] : [...knowledge.keys()];
  const result = { total: ids.length, learnedCount: 0, strangerCount: 0, understoodCount: 0, masteredCount: 0, familiarCount: 0, dueCount: 0 };
  const degreeKeys = { none: 'strangerCount', fuzzy: 'understoodCount', remembered: 'masteredCount', known: 'familiarCount' };
  ids.forEach(id => {
    const r = state.records[id];
    if (!r || !r.firstLearnedAt) return;
    result.learnedCount++;
    result[degreeKeys[model.familiarity(r)]]++;
    if (model.isDue(r, now)) result.dueCount++;
  });
  return { ...result, unlearnedCount: result.total - result.learnedCount, progress: result.total ? Math.round(result.learnedCount / result.total * 100) : 0 };
}
function getTodayRecommendation({ topic, goal, scope, today }) {
  if (!topic || !scope.total) return { type: 'scope', completed: false, primaryCount: 0, newRemaining: 0, title: '选择一个学习内容开始', description: '从感兴趣的分类开始，按自己的节奏积累。', button: '选择学习范围' };
  const fresh = Math.min(Math.max(0, goal - today.newCount), scope.unlearnedCount);
  const common = { newRemaining: fresh, reviewRemaining: scope.dueCount, newCompleted: today.newCount, reviewCompleted: today.reviewCount, completed: !fresh && !scope.dueCount };
  if (scope.dueCount) return { ...common, type: 'review', primaryCount: scope.dueCount, title: `今天先复习 ${scope.dueCount} 个`, description: '这些内容到了建议复习时间。', button: '开始复习' };
  if (fresh) return { ...common, type: 'new', primaryCount: fresh, title: `今日待新学 ${fresh} 个`, description: today.reviewCount ? '复习已完成，接着完成今天的新学计划。' : `按你的每日计划，逐步学习${topic.name}。`, button: today.newCount ? '继续新学' : '开始新学' };
  return { ...common, type: 'complete', primaryCount: 0, title: today.completed ? '今天的学习完成了' : scope.unlearnedCount ? '今天的学习完成了' : '这个分类已学完', description: scope.unlearnedCount ? '后续到期内容会自动出现在复习中。' : '已学内容仍会按记忆安排回来复习。', button: '' };
}
function getPracticeRecommendation(state, stats, topic) {
  const wrong = Object.keys(stats).filter(id => stats[id].activeWrong && validQuestions.has(id));
  if (wrong.length) return { type: 'wrong', title: `还有 ${wrong.length} 道当前错题`, eyebrow: '需要巩固', description: '从错题开始，看看哪些知识值得再回忆。', button: '开始错题巩固', questionIds: wrong, count: Math.min(20, wrong.length) };
  const learnedIds = (topicKnowledge.get(topic && topic.id) || []).filter(id => state.records[id] && state.records[id].firstLearnedAt);
  const questionIds = learnedIds.flatMap(id => related.get(id) || []);
  if (questionIds.length) return { type: 'learned', title: '检验一下学过的内容', eyebrow: '建议练习', description: `${topic.name} · 已学习 ${learnedIds.length} 个`, button: '练习当前学习内容', questionIds, count: Math.min(10, questionIds.length) };
  return { type: 'free', title: '选一个专项练一练', eyebrow: '从这里开始', description: '按自己的需要选择，练习用于检验学习效果。', button: '选择专项', questionIds: [], count: 0 };
}
function buildDashboard(state, settings, stats, now) {
  const topic = content.getTopicById(settings.topicId) || null;
  const scope = topic ? summary(state, now, topic.id) : summary({ ...state, records: {} }, now, '__none__');
  const today = completion(state, now, topic && topic.id);
  const action = getTodayRecommendation({ topic, goal: settings.newCount, scope, today });
  const overall = summary(state, now);
  const answers = state.activity.filter(e => e.kind === 'answer' && e.at >= model.afterDays(now, -6) && e.at < model.afterDays(now, 1));
  return { topic, scope, action, daily: { completed: today.newCount, fresh: action.newRemaining, due: scope.dueCount, goal: settings.newCount, summary: { ...scope, ...today } },
    learning: { ...overall, today: completion(state, now), sevenDayAccuracy: answers.length ? Math.round(answers.filter(e => e.correct).length / answers.length * 100) : null },
    practice: getPracticeRecommendation(state, stats, topic) };
}
function scheduleEvidence(record) {
  return record && record.firstLearnedAt && !record.excludedFromReview ? record.memoryEvent ? `${record.memoryEvent.at}/${record.memoryEvent.id}` : 'uninitialized' : '';
}
function didUpdateSchedule(before, after) { return !!before && !!(after && after.memoryEvent) && !!scheduleEvidence(after) && before !== scheduleEvidence(after); }
function recentActivity(state, now, limit = 20) {
  const completions = new Map();
  Object.values(state.days).forEach(p => Object.values(p.completed || {}).forEach(c => { completions.set(c.eventId, c); }));
  return state.activity.filter(e => knowledge.has(e.knowledgeId) && e.at <= now && e.at >= model.afterDays(now, -6)).slice().sort((a, b) => b.at - a.at).slice(0, limit).map(e => {
    const k = knowledge.get(e.knowledgeId), r = state.records[k.id], c = completions.get(e.id);
    const isNew = r && r.firstLearnedAt === e.at;
    const label = e.kind === 'answer' ? '练习' : c && c.phase === 'review' ? '复习' : isNew ? '新学' : e.kind === 'exemption' ? '熟知设置' : '程度反馈';
    return { id: e.id, knowledgeId: k.id, title: k.title, label, date: model.dayKey(e.at), detail: e.kind === 'answer' ? e.correct ? '✓ 正确' : '× 错误' : label === '熟知设置' ? '主动调整免复习选择' : label === '程度反馈' ? '主动学习程度反馈' : '已记录学习' };
  });
}
module.exports = { completion, summary, getTodayRecommendation, getPracticeRecommendation, buildDashboard, scheduleEvidence, didUpdateSchedule, recentActivity };
