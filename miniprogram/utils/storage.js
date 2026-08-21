const { idiomQuestionAliases } = require("../data/materials/idioms");

const STATS_KEY = "zhilian_question_stats_v3";
const STUDY_PROGRESS_KEY = "zhilian_study_progress_v1";
const CONNECTIVE_MIGRATION_KEY = "zhilian_connective_relation_cards_v1";
const IDIOM_ID_MIGRATION_KEY = "zhilian_idiom_incremental_merge_20260808_v2";
const IDIOM_GROUPING_MIGRATION_KEY = "zhilian_idiom_batch_grouping_20260821_v1";

function migrateConnectiveRecords() {
  if (wx.getStorageSync(CONNECTIVE_MIGRATION_KEY)) return;

  const stats = wx.getStorageSync(STATS_KEY) || {};
  let statsChanged = false;
  Object.keys(stats).forEach((questionId) => {
    if (questionId.indexOf("q-mat-connective-") === 0) {
      delete stats[questionId];
      statsChanged = true;
    }
  });
  if (statsChanged) wx.setStorageSync(STATS_KEY, stats);

  const progress = wx.getStorageSync(STUDY_PROGRESS_KEY) || {};
  let progressChanged = false;
  Object.keys(progress).forEach((key) => {
    if (key.indexOf("connective_") === 0) {
      delete progress[key];
      progressChanged = true;
    }
  });
  if (progressChanged) wx.setStorageSync(STUDY_PROGRESS_KEY, progress);

  wx.setStorageSync(CONNECTIVE_MIGRATION_KEY, Date.now());
}

function migrateIdiomRecords() {
  if (wx.getStorageSync(IDIOM_ID_MIGRATION_KEY)) return;

  const stats = wx.getStorageSync(STATS_KEY) || {};
  let statsChanged = false;
  Object.keys(idiomQuestionAliases).forEach((sourceId) => {
    const source = stats[sourceId];
    if (!source) return;

    const targetId = idiomQuestionAliases[sourceId];
    const target = stats[targetId];
    if (target) {
      const attempts = (target.attempts || 0) + (source.attempts || 0);
      const wrong = (target.wrong || 0) + (source.wrong || 0);
      stats[targetId] = {
        ...source,
        ...target,
        questionId: targetId,
        moduleId: "verbal",
        topicId: "idiom",
        attempts,
        correct: (target.correct || 0) + (source.correct || 0),
        wrong,
        consecutiveCorrect: target.consecutiveCorrect || 0,
        activeWrong: Boolean(target.activeWrong),
        lastWrongAt: Math.max(target.lastWrongAt || 0, source.lastWrongAt || 0),
        errorRate: attempts ? Number(((wrong / attempts) * 100).toFixed(1)) : 0
      };
    } else {
      stats[targetId] = { ...source, questionId: targetId, moduleId: "verbal", topicId: "idiom" };
    }
    delete stats[sourceId];
    statsChanged = true;
  });
  if (statsChanged) wx.setStorageSync(STATS_KEY, stats);

  wx.setStorageSync(IDIOM_ID_MIGRATION_KEY, Date.now());
}

function migrateIdiomGroupingProgress() {
  if (wx.getStorageSync(IDIOM_GROUPING_MIGRATION_KEY)) return;

  const progress = wx.getStorageSync(STUDY_PROGRESS_KEY) || {};
  let progressChanged = false;
  Object.keys(progress).forEach((key) => {
    if (key.indexOf("idiom_") !== 0) return;
    const setIndex = Number(key.slice("idiom_".length));
    const item = progress[key];
    const keepLegacyLastGroup = setIndex === 7 && item && item.total === 13;
    if (setIndex >= 7 && !keepLegacyLastGroup) {
      delete progress[key];
      progressChanged = true;
    }
  });
  if (progressChanged) wx.setStorageSync(STUDY_PROGRESS_KEY, progress);

  wx.setStorageSync(IDIOM_GROUPING_MIGRATION_KEY, Date.now());
}

function migrateContentRecords() {
  migrateConnectiveRecords();
  migrateIdiomRecords();
  migrateIdiomGroupingProgress();
}

function getQuestionStats() {
  migrateContentRecords();
  return wx.getStorageSync(STATS_KEY) || {};
}

function recordQuestionResult(questionId, moduleId, topicId, isCorrect) {
  const stats = getQuestionStats();
  const previous = stats[questionId] || {
    questionId,
    moduleId,
    topicId,
    attempts: 0,
    correct: 0,
    wrong: 0,
    consecutiveCorrect: 0,
    activeWrong: false,
    lastWrongAt: 0
  };
  const next = { ...previous, moduleId, topicId, attempts: previous.attempts + 1 };
  if (isCorrect) {
    next.correct += 1;
    next.consecutiveCorrect += 1;
    if (next.consecutiveCorrect >= 2) next.activeWrong = false;
  } else {
    next.wrong += 1;
    next.consecutiveCorrect = 0;
    next.activeWrong = true;
    next.lastWrongAt = Date.now();
  }
  next.errorRate = Number(((next.wrong / next.attempts) * 100).toFixed(1));
  stats[questionId] = next;
  wx.setStorageSync(STATS_KEY, stats);
  return next;
}

function getActiveWrongQuestionIds(filters = {}) {
  const { moduleId, topicId } = filters;
  const stats = getQuestionStats();
  return Object.keys(stats).filter((id) => {
    const item = stats[id];
    if (!item.activeWrong) return false;
    if (moduleId && item.moduleId !== moduleId) return false;
    if (topicId && item.topicId !== topicId) return false;
    return true;
  });
}

function getStudyProgress() {
  migrateContentRecords();
  return wx.getStorageSync(STUDY_PROGRESS_KEY) || {};
}

function getGroupProgress(topicId, setIndex) {
  return getStudyProgress()[`${topicId}_${setIndex}`] || null;
}

function markGroupProgress(topicId, setIndex, currentIndex, total) {
  const all = getStudyProgress();
  const key = `${topicId}_${setIndex}`;
  const previous = all[key] || {};
  const maxIndex = Math.max(previous.maxIndex || 0, currentIndex);
  all[key] = { topicId, setIndex, maxIndex, total, completed: maxIndex >= total - 1, updatedAt: Date.now() };
  wx.setStorageSync(STUDY_PROGRESS_KEY, all);
  return all[key];
}

function setExamRequest(request) { getApp().globalData.examRequest = request; }
function consumeExamRequest() {
  const request = getApp().globalData.examRequest;
  getApp().globalData.examRequest = null;
  return request;
}
function clearQuestionStats() { wx.removeStorageSync(STATS_KEY); }

module.exports = {
  getQuestionStats, recordQuestionResult, getActiveWrongQuestionIds,
  getStudyProgress, getGroupProgress, markGroupProgress,
  setExamRequest, consumeExamRequest, clearQuestionStats
};
