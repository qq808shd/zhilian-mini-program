const learningEngine = require("./learningEngine");
const cloudConfig = require("../config/cloud");
const { isSyncAuthorized, stopSyncPreference } = require("./account");
const {
  getQuestionStats,
  getStudyProgress,
  getPendingAnswerEvents,
  getStatsResetPending,
  isCloudSyncDirty,
  applyCloudSnapshot,
  setCloudSyncScheduler
} = require("./storage");

const AUTH_KEY = "zhilian_cloud_auth_v1";
const MIN_TOKEN_REMAINING = 60 * 1000;

let syncPromise = null;
let syncTimer = null;
let retryTimer = null;
let failureCount = 0;
let generation = 0;
const activeRequests = new Set();
const SYNC_META_KEY = "zhilian_sync_status_v1";
function isSyncAllowed() { return isCloudEnabled() && isSyncAuthorized(); }
function assertAllowed(runGeneration) {
  if (!isSyncAllowed() || runGeneration !== generation) {
    const error = new Error("同步已停止"); error.code = "SYNC_STOPPED"; throw error;
  }
}

function isCloudEnabled() {
  return Boolean(cloudConfig.enabled && /^https:\/\//.test(String(cloudConfig.baseUrl || "")));
}

function setSyncStatus(state, detail = {}) {
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.cloudSync = {
        ...(app.globalData.cloudSync || {}),
        state,
        ...detail
      };
    }
  } catch (error) {
    // App 尚未完成初始化时不影响本地学习功能。
  }
}

function wxLogin(runGeneration) {
  return new Promise((resolve, reject) => {
    assertAllowed(runGeneration);
    wx.login({
      success(result) {
        try { assertAllowed(runGeneration); } catch (error) { reject(error); return; }
        if (result.code) resolve(result.code);
        else reject(new Error("微信登录未返回有效凭证"));
      },
      fail: reject
    });
  });
}

function rawRequest({ path, method = "GET", data, token, runGeneration }) {
  const baseUrl = String(cloudConfig.baseUrl).replace(/\/+$/, "");
  return new Promise((resolve, reject) => {
    assertAllowed(runGeneration);
    let task;
    task = wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      timeout: cloudConfig.requestTimeout || 10000,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        try { assertAllowed(runGeneration); } catch (error) { reject(error); return; }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data || {});
          return;
        }
        const error = new Error((response.data && response.data.message) || `云端请求失败（${response.statusCode}）`);
        error.statusCode = response.statusCode;
        error.code = response.data && response.data.code;
        reject(error);
      },
      fail: reject,
      complete() { if (task) activeRequests.delete(task); }
    });
    if (task) activeRequests.add(task);
  });
}

function getStoredAuth() {
  const auth = wx.getStorageSync(AUTH_KEY) || null;
  if (!auth || !auth.token || auth.expiresAt <= Date.now() + MIN_TOKEN_REMAINING) return null;
  return auth;
}

async function login(runGeneration) {
  assertAllowed(runGeneration);
  const stored = getStoredAuth();
  if (stored) return stored;
  const code = await wxLogin(runGeneration);
  const auth = await rawRequest({ path: "/v1/auth/wechat", method: "POST", data: { code }, runGeneration });
  if (!auth.token || !auth.expiresAt) throw new Error("云端登录响应不完整");
  assertAllowed(runGeneration);
  wx.setStorageSync(AUTH_KEY, auth);
  return auth;
}

async function authorizedRequest(options, canRetry = true) {
  const auth = await login(options.runGeneration);
  assertAllowed(options.runGeneration);
  try {
    return await rawRequest({ ...options, token: auth.token });
  } catch (error) {
    if (canRetry && error.statusCode === 401) {
      wx.removeStorageSync(AUTH_KEY);
      return authorizedRequest(options, false);
    }
    throw error;
  }
}

function scheduleRetry() {
  if (!isSyncAllowed() || retryTimer) return;
  const delay = Math.min(5 * 60 * 1000, 15000 * Math.pow(2, Math.min(failureCount, 4)));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    syncCloudData();
  }, delay);
}

function scheduleCloudSync(delay = cloudConfig.syncDebounceMs || 1800) {
  if (!isSyncAllowed()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncCloudData();
  }, delay);
}

async function performSync(runGeneration) {
  assertAllowed(runGeneration);
  setSyncStatus("syncing", { lastError: "" });
  learningEngine.repairDailyAnswers();
  const remote = await authorizedRequest({ path: "/v1/sync", runGeneration });
  assertAllowed(runGeneration);

  learningEngine.importLegacySnapshot(remote);
  const pendingLearning = learningEngine.getPendingEvents().slice(0, 200);
  const requiresReset = pendingLearning.some(e => e.kind === 'reset-learning') || Object.keys(learningEngine.getState().learningResets || {}).length > 0;
  const assertResetSupport = snapshot => {
    if (requiresReset && snapshot.learningResetVersion !== learningEngine.model.LEARNING_RESET_VERSION) {
      throw new Error('学习记录清空已保存在本机，服务更新后会同步');
    }
  };
  assertResetSupport(remote);
  const requiresV5 = pendingLearning.length > 0 || remote.learningVersion || remote.learningState;
  const settingsVersion = pendingLearning.reduce((version, event) => Math.max(version, event.settings ? event.settings.version || 1 : 0), 0);
  // Check capabilities before sending: an older server may acknowledge an event
  // after discarding fields it does not understand.
  if (requiresV5 && !(remote.learningVersion === 5 && remote.learningState && remote.learningState.version === 5)) {
    throw new Error("学习记录和学习设置已保存在本机，云端需更新至 V5 后继续同步");
  }
  if (settingsVersion > (remote.learningSettingsVersion || 0)) {
    throw new Error("学习设置已保存在本机，服务更新后将自动同步");
  }
  if (remote.initialized && !isCloudSyncDirty()) {
    applyCloudSnapshot(remote, []);
    learningEngine.applySnapshot(remote);
    return remote;
  }

  const pendingAtStart = getPendingAnswerEvents();
  const resetStats = getStatsResetPending();
  const firstCloudImport = !remote.initialized;
  const sentEvents = firstCloudImport ? [] : pendingAtStart.slice(0, cloudConfig.maxEventBatch || 200);
  const payload = {
    resetStats,
    learningEvents: pendingLearning,
    events: sentEvents,
    progress: firstCloudImport ? {} : getStudyProgress(),
    ...(firstCloudImport ? {
      bootstrap: {
        stats: getQuestionStats(),
        progress: getStudyProgress(),
        events: pendingAtStart
      }
    } : {})
  };
  const result = await authorizedRequest({ path: "/v1/sync", method: "PUT", data: payload, runGeneration });
  assertAllowed(runGeneration);
  assertResetSupport(result);
  const sentAnswerIds = new Set((firstCloudImport ? pendingAtStart : sentEvents).map((event) => event.eventId));
  const ackedEventIds = (result.ackedEventIds || []).filter((id) => sentAnswerIds.has(id));
  applyCloudSnapshot(result, ackedEventIds, resetStats);
  const supportsV5 = result.learningVersion === 5 && result.learningState && result.learningState.version === 5;
  const sentLearning = new Map(payload.learningEvents.map((event) => [event.id, event]));
  const learningAcks = (result.ackedLearningEventIds || []).filter((id) => {
    const event = sentLearning.get(id);
    return event && supportsV5 && (!event.settings || result.learningSettingsVersion >= (event.settings.version || 1));
  });
  learningEngine.applySnapshot(result, learningAcks);
  if (settingsVersion > (result.learningSettingsVersion || 0)) throw new Error("学习设置等待同步，服务更新后将自动重试");
  if (pendingLearning.length && !supportsV5) throw new Error("学习记录已保存在本机，云端需更新至 V5 后继续同步");
  return result;
}

function syncCloudData() {
  if (!isSyncAllowed()) {
    setSyncStatus(isCloudEnabled() ? "local" : "disabled");
    return Promise.resolve(null);
  }
  if (syncPromise) return syncPromise;
  const runGeneration = generation;
  const run = performSync(runGeneration)
    .then((result) => {
      assertAllowed(runGeneration);
      failureCount = 0;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      const detail = { lastSyncedAt: Date.now(), revision: result ? result.revision : 0 };
      wx.setStorageSync(SYNC_META_KEY, detail);
      setSyncStatus("ready", { ...detail, lastError: "" });
      if (isCloudSyncDirty()) scheduleCloudSync(300);
      else if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      return result;
    })
    .catch((error) => {
      if (runGeneration !== generation || !isSyncAllowed() || error.code === "SYNC_STOPPED") return null;
      failureCount += 1;
      setSyncStatus("offline", { lastError: error.message || "同步失败" });
      console.warn("知练云同步暂不可用，本地学习不受影响：", error.message || error);
      scheduleRetry();
      return null;
    })
    .finally(() => { if (syncPromise === run) syncPromise = null; });
  syncPromise = run;
  return run;
}

function stopCloudSync() {
  stopSyncPreference();
  generation += 1;
  if (syncTimer) clearTimeout(syncTimer);
  if (retryTimer) clearTimeout(retryTimer);
  syncTimer = null; retryTimer = null; syncPromise = null; failureCount = 0;
  activeRequests.forEach((task) => { try { task.abort(); } catch (_) {} });
  activeRequests.clear();
  setSyncStatus("local", { lastError: "" });
}

function initializeCloudSync() {
  setCloudSyncScheduler(scheduleCloudSync);
  setSyncStatus("local", wx.getStorageSync(SYNC_META_KEY) || {});
  if (!isCloudEnabled()) {
    setSyncStatus("disabled");
    return Promise.resolve(null);
  }
  return syncCloudData();
}

module.exports = {
  requestAuthenticated(options) { return authorizedRequest({ ...options, runGeneration: generation }); },
  initializeCloudSync,
  syncCloudData,
  scheduleCloudSync,
  isCloudEnabled,
  stopCloudSync
};
