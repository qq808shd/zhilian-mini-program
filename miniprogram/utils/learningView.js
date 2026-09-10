const engine = require("./learningEngine");
const { topics, getTopicById, getModuleById, getKnowledgeSet, getSetsForTopic } = require("../data/content");
const { getStudyProgress, getQuestionStats } = require("./storage");
// Device-local cursor; cloud progress retains its existing max-index semantics.
const POSITION_KEY = "zhilian_reading_positions_v1";
function saveReadingPosition(topicId, setIndex, currentIndex) {
  const positions = wx.getStorageSync(POSITION_KEY) || {};
  const reset = (engine.getState().learningResets || {})[topicId];
  positions[`${topicId}_${setIndex}`] = { topicId, setIndex, currentIndex, updatedAt: Math.max(Date.now(), reset ? reset.at + 1 : 0) };
  wx.setStorageSync(POSITION_KEY, positions);
}
function getReadingIndex(topicId, setIndex, total) {
  const local = engine.model.filterResetProgress(wx.getStorageSync(POSITION_KEY), engine.getState().learningResets)[`${topicId}_${setIndex}`];
  const progress = getStudyProgress()[`${topicId}_${setIndex}`];
  const raw = local ? local.currentIndex : progress ? progress.maxIndex : 0;
  return Math.min(Math.max(Number(raw) || 0, 0), Math.max(total - 1, 0));
}
function summarize(records) {
  const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
  const correct = records.reduce((sum, item) => sum + item.correct, 0);
  return { attempts, correct, accuracy: attempts ? Math.round(correct / attempts * 100) : null,
    activeWrongCount: records.filter((item) => item.activeWrong).length,
    masteredCount: records.filter((item) => item.wrong > 0 && !item.activeWrong).length };
}
function getLearningOverview() {
  const progress = getStudyProgress();
  const records = Object.values(getQuestionStats());
  const topicViews = topics.map((topic) => {
    const sets = getSetsForTopic(topic.id);
    const knowledgeCount = sets.reduce((sum, set) => sum + set.count, 0);
    const browsedCount = sets.reduce((sum, set) => {
      const saved = progress[`${topic.id}_${set.index}`];
      return sum + (saved ? Math.min((saved.maxIndex || 0) + 1, set.count) : 0);
    }, 0);
    const stats = summarize(records.filter((record) => record.topicId === topic.id));
    const actual = engine.topicSummary(topic.id);
    const learnedCount = actual.learnedCount;
    stats.activeWrongCount = actual.dueCount;
    stats.masteredCount = actual.masteredCount;
    return { ...topic, ...stats, ...actual, browsedCount, knowledgeCount, learnedCount, setCount: sets.length,
      progress: knowledgeCount ? Math.round(learnedCount / knowledgeCount * 100) : 0,
      meta: `已学习 ${learnedCount} · 自评掌握 ${actual.masteredCount} · 待复习 ${actual.dueCount}`,
      badge: stats.activeWrongCount ? `${stats.activeWrongCount} 项待复习` : stats.attempts ? `累计正确率 ${stats.accuracy}%` : "尚未练习" };
  });
  const positions = engine.model.filterResetProgress(wx.getStorageSync(POSITION_KEY), engine.getState().learningResets);
  const recent = Object.values({ ...progress, ...positions }).sort((a, b) => b.updatedAt - a.updatedAt).map((saved) => {
    const topic = getTopicById(saved.topicId);
    const set = topic && getKnowledgeSet(topic.id, saved.setIndex);
    if (!set || !set.count) return null;
    const index = getReadingIndex(topic.id, set.index, set.count);
    return { key: `${topic.id}_${set.index}`, topicId: topic.id, topicName: topic.name, moduleName: getModuleById(topic.moduleId).name,
      setIndex: set.index, setName: set.name, currentIndex: index, count: set.count,
      actionLabel: engine.groupAction(topic.id, set.index).label, title: set.items[index].title, progress: Math.round((index + 1) / set.count * 100), updatedAt: saved.updatedAt };
  }).filter(Boolean).slice(0, 3);
  const weakTopics = topicViews.filter((topic) => topic.activeWrongCount > 0)
    .sort((a, b) => b.activeWrongCount - a.activeWrongCount || a.accuracy - b.accuracy);
  return { topics: topicViews, recent, weakTopics, summary: { ...summarize(records), ...engine.topicSummary(), activeWrongCount: engine.topicSummary().dueCount } };
}
module.exports = { saveReadingPosition, getReadingIndex, summarize, getLearningOverview };
