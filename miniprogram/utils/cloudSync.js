const cloudConfig = require("../config/cloud");
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

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code);
        else reject(new Error("微信登录未返回有效凭证"));
      },
      fail: reject
    });
  });
}

function rawRequest({ path, method = "GET", data, token }) {
  const baseUrl = String(cloudConfig.baseUrl).replace(/\/+$/, "");
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      timeout: cloudConfig.requestTimeout || 10000,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data || {});
          return;
        }
        const error = new Error((response.data && response.data.message) || `云端请求失败（${response.statusCode}）`);
        error.statusCode = response.statusCode;
        error.code = response.data && response.data.code;
        reject(error);
      },
      fail: reject
    });
  });
}

function getStoredAuth() {
  const auth = wx.getStorageSync(AUTH_KEY) || null;
  if (!auth || !auth.token || auth.expiresAt <= Date.now() + MIN_TOKEN_REMAINING) return null;
  return auth;
}

async function login() {
  const stored = getStoredAuth();
  if (stored) return stored;
  const code = await wxLogin();
  const auth = await rawRequest({ path: "/v1/auth/wechat", method: "POST", data: { code } });
  if (!auth.token || !auth.expiresAt) throw new Error("云端登录响应不完整");
  wx.setStorageSync(AUTH_KEY, auth);
  return auth;
}

async function authorizedRequest(options, canRetry = true) {
  const auth = await login();
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
  if (!isCloudEnabled() || retryTimer) return;
  const delay = Math.min(5 * 60 * 1000, 15000 * Math.pow(2, Math.min(failureCount, 4)));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    syncCloudData();
  }, delay);
}

function scheduleCloudSync(delay = cloudConfig.syncDebounceMs || 1800) {
  if (!isCloudEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncCloudData();
  }, delay);
}

async function performSync() {
  setSyncStatus("syncing", { lastError: "" });
  const remote = await authorizedRequest({ path: "/v1/sync" });

  if (remote.initialized && !isCloudSyncDirty()) {
    applyCloudSnapshot(remote, []);
    return remote;
  }

  const pendingAtStart = getPendingAnswerEvents();
  const resetStats = getStatsResetPending();
  const firstCloudImport = !remote.initialized;
  const sentEvents = firstCloudImport ? [] : pendingAtStart.slice(0, cloudConfig.maxEventBatch || 200);
  const payload = {
    resetStats,
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
  const result = await authorizedRequest({ path: "/v1/sync", method: "PUT", data: payload });
  const ackedEventIds = firstCloudImport
    ? pendingAtStart.map((event) => event.eventId)
    : (result.ackedEventIds || []);
  applyCloudSnapshot(result, ackedEventIds, resetStats);
  return result;
}

function syncCloudData() {
  if (!isCloudEnabled()) {
    setSyncStatus("disabled");
    return Promise.resolve(null);
  }
  if (syncPromise) return syncPromise;

  syncPromise = performSync()
    .then((result) => {
      failureCount = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      setSyncStatus("ready", { lastSyncedAt: Date.now(), revision: result ? result.revision : 0, lastError: "" });
      if (isCloudSyncDirty()) scheduleCloudSync(300);
      return result;
    })
    .catch((error) => {
      failureCount += 1;
      setSyncStatus("offline", { lastError: error.message || "同步失败" });
      console.warn("知练云同步暂不可用，本地学习不受影响：", error.message || error);
      scheduleRetry();
      return null;
    })
    .finally(() => {
      syncPromise = null;
    });
  return syncPromise;
}

function initializeCloudSync() {
  setCloudSyncScheduler(scheduleCloudSync);
  if (!isCloudEnabled()) {
    setSyncStatus("disabled");
    return Promise.resolve(null);
  }
  return syncCloudData();
}

module.exports = {
  initializeCloudSync,
  syncCloudData,
  scheduleCloudSync,
  isCloudEnabled
};
