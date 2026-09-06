const { getPreferences, hasCurrentConsent, isSyncAuthorized } = require("./account");
const { isCloudEnabled } = require("./cloudSync");
const { getPendingAnswerEvents, isCloudSyncDirty, getStatsResetPending } = require("./storage");
function formatTime(value) {
  if (!value) return "尚未成功同步";
  const date = new Date(value), pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "/" + pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function getSyncView() {
  const authorized = isSyncAuthorized();
  const status = getApp().globalData.cloudSync || {};
  const dirty = isCloudSyncDirty();
  const pendingCount = getPendingAnswerEvents().length + require("./learningEngine").getPendingEvents().length;
  let title = "请确认用户协议";
  let description = "请阅读并同意当前协议后继续。";
  let state = "local";
  if (getPreferences().acceptedAt && !hasCurrentConsent()) {
    description = "请阅读并同意更新后的协议。";
  } else if (authorized) {
    state = status.state || "syncing";
    if (!isCloudEnabled()) { title = "同步服务尚未配置"; description = "服务暂不可用，请稍后重试。"; }
    else if (state === "syncing") { title = "正在同步学习记录"; description = "请稍候，正在更新记录。"; }
    else if (state === "offline") { title = "同步暂未完成"; description = status.lastError && /V4|学习设置/.test(status.lastError) ? status.lastError : "恢复网络后将自动重试。"; }
    else if (dirty) { title = "有学习记录等待同步"; description = "将在后台自动更新。"; }
    else if (state === "ready") { title = "学习记录已同步"; description = "其他设备使用同一微信可继续学习。"; }
    else { title = "等待同步学习记录"; description = "学习记录已保留，将在后台自动同步。"; }
  } else if (status.lastSyncedAt) { description = "请阅读并同意当前协议后继续。"; }
  return { authorized, state, title, description, pendingCount, dirty, resetPending: getStatsResetPending(),
    lastSynced: formatTime(status.lastSyncedAt) };
}
module.exports = { getSyncView };
