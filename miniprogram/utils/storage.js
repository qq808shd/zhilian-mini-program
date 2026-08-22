const { idiomQuestionAliases } = require("../data/materials/idioms");

const STATS_KEY = "zhilian_question_stats_v3";
const STUDY_PROGRESS_KEY = "zhilian_study_progress_v1";
const CONNECTIVE_MIGRATION_KEY = "zhilian_connective_relation_cards_v1";
const IDIOM_ID_MIGRATION_KEY = "zhilian_idiom_incremental_merge_20260808_v2";
const IDIOM_GROUPING_MIGRATION_KEY = "zhilian_idiom_batch_grouping_20260821_v1";
const PENDING_ANSWER_EVENTS_KEY = "zhilian_pending_answer_events_v1";
const CLOUD_SYNC_DIRTY_KEY = "zhilian_cloud_sync_dirty_v1";
const CLOUD_STATS_RESET_KEY = "zhilian_cloud_stats_reset_v1";
const CLOUD_CLIENT_ID_KEY = "zhilian_cloud_client_id_v1";

let cloudSyncScheduler = null;

function setCloudSyncScheduler(scheduler) {
  cloudSyncScheduler = typeof scheduler === "function" ? scheduler : null;
}

function notifyCloudSync() {
  wx.setStorageSync(CLOUD_SYNC_DIRTY_KEY, true);
  if (cloudSyncScheduler) cloudSyncScheduler();
}

function getClientId() {
  const existing = wx.getStorageSync(CLOUD_CLIENT_ID_KEY);
  if (existing) return existing;
  const created = `wx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(CLOUD_CLIENT_ID_KEY, created);
  return created;
}

function createAnswerEvent(questionId, moduleId, topicId, isCorrect, answeredAt) {
  return {
    eventId: `${getClientId()}:${answeredAt.toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
    questionId,
    moduleId,
    topicId,
    isCorrect: Boolean(isCorrect),
    answeredAt
  };
}

function getPendingAnswerEvents(limit) {
  const events = wx.getStorageSync(PENDING_ANSWER_EVENTS_KEY) || [];
  return Number.isInteger(limit) ? events.slice(0, limit) : events;
}

function enqueueAnswerEvent(event) {
  const events = getPendingAnswerEvents();
  events.push(event);
  wx.setStorageSync(PENDING_ANSWER_EVENTS_KEY, events);
}

function acknowledgeAnswerEvents(eventIds) {
  if (!eventIds || !eventIds.length) return;
  const acknowledged = new Set(eventIds);
  const remaining = getPendingAnswerEvents().filter((event) => !acknowledged.has(event.eventId));
  wx.setStorageSync(PENDING_ANSWER_EVENTS_KEY, remaining);
}

function applyAnswerEvent(stats, event) {
  const previous = stats[event.questionId] || {
    questionId: event.questionId,
    moduleId: event.moduleId,
    topicId: event.topicId,
    attempts: 0,
    correct: 0,
    wrong: 0,
    consecutiveCorrect: 0,
    activeWrong: false,
    lastWrongAt: 0,
    lastAnsweredAt: 0
  };
  const next = {
    ...previous,
    moduleId: event.moduleId,
    topicId: event.topicId,
    attempts: previous.attempts + 1,
    lastAnsweredAt: Math.max(previous.lastAnsweredAt || 0, event.answeredAt),
    updatedAt: event.answeredAt
  };
  if (event.isCorrect) {
    next.correct += 1;
    next.consecutiveCorrect += 1;
    if (next.consecutiveCorrect >= 2) next.activeWrong = false;
  } else {
    next.wrong += 1;
    next.consecutiveCorrect = 0;
    next.activeWrong = true;
    next.lastWrongAt = event.answeredAt;
  }
  next.errorRate = Number(((next.wrong / next.attempts) * 100).toFixed(1));
  stats[event.questionId] = next;
  return next;
}

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
  const answeredAt = Date.now();
  const stats = getQuestionStats();
  const event = createAnswerEvent(questionId, moduleId, topicId, isCorrect, answeredAt);
  const next = applyAnswerEvent(stats, event);
  wx.setStorageSync(STATS_KEY, stats);
  enqueueAnswerEvent(event);
  notifyCloudSync();
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
  notifyCloudSync();
  return all[key];
}

function setExamRequest(request) { getApp().globalData.examRequest = request; }
function consumeExamRequest() {
  const request = getApp().globalData.examRequest;
  getApp().globalData.examRequest = null;
  return request;
}
function getStatsResetPending() { return Boolean(wx.getStorageSync(CLOUD_STATS_RESET_KEY)); }
function isCloudSyncDirty() { return Boolean(wx.getStorageSync(CLOUD_SYNC_DIRTY_KEY)); }

function mergeProgress(remoteProgress, localProgress) {
  const merged = { ...(remoteProgress || {}) };
  Object.keys(localProgress || {}).forEach((key) => {
    const local = localProgress[key];
    const remote = merged[key];
    if (!remote) {
      merged[key] = local;
      return;
    }
    const maxIndex = Math.max(remote.maxIndex || 0, local.maxIndex || 0);
    const preferLocal = (local.updatedAt || 0) > (remote.updatedAt || 0);
    const total = preferLocal ? local.total : remote.total;
    merged[key] = {
      ...(preferLocal ? remote : local),
      ...(preferLocal ? local : remote),
      maxIndex,
      total,
      completed: maxIndex >= total - 1,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0)
    };
  });
  return merged;
}

function applyCloudSnapshot(snapshot, ackedEventIds = [], resetAcknowledged = false) {
  acknowledgeAnswerEvents(ackedEventIds);
  if (resetAcknowledged) wx.removeStorageSync(CLOUD_STATS_RESET_KEY);

  const pending = getPendingAnswerEvents();
  const nextStats = { ...(snapshot.stats || {}) };
  pending.forEach((event) => applyAnswerEvent(nextStats, event));
  wx.setStorageSync(STATS_KEY, nextStats);

  const mergedProgress = mergeProgress(snapshot.progress || {}, getStudyProgress());
  wx.setStorageSync(STUDY_PROGRESS_KEY, mergedProgress);
  wx.setStorageSync(CLOUD_SYNC_DIRTY_KEY, pending.length > 0 || getStatsResetPending());
}

function clearQuestionStats() {
  wx.removeStorageSync(STATS_KEY);
  wx.removeStorageSync(PENDING_ANSWER_EVENTS_KEY);
  wx.setStorageSync(CLOUD_STATS_RESET_KEY, true);
  notifyCloudSync();
}

module.exports = {
  getQuestionStats, recordQuestionResult, getActiveWrongQuestionIds,
  getStudyProgress, getGroupProgress, markGroupProgress,
  setExamRequest, consumeExamRequest, clearQuestionStats,
  getPendingAnswerEvents, getStatsResetPending, isCloudSyncDirty,
  applyCloudSnapshot, setCloudSyncScheduler
};
