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
  let title = "学习记录，仅保存在本机";
  let description = "阅读并同意协议后，学习记录会自动保存到云端。";
  let state = "local";
  if (getPreferences().acceptedAt && !hasCurrentConsent()) {
    description = "请确认当前协议，之后学习记录会自动同步。";
  } else if (authorized) {
    state = status.state || "syncing";
    if (!isCloudEnabled()) { title = "同步服务尚未配置"; description = "学习记录保留在本机。"; }
    else if (state === "syncing") { title = "正在同步学习记录"; description = "可以继续学习，本机记录会保留。"; }
    else if (state === "offline") { title = "同步暂未完成"; description = status.lastError && status.lastError.includes("V4") ? status.lastError : "本机记录已保留，恢复网络后自动重试。"; }
    else if (dirty) { title = "有学习记录等待同步"; description = "记录已暂存本机，将在后台自动上传。"; }
    else if (state === "ready") { title = "学习记录已同步"; description = "其他设备使用同一微信可继续学习。"; }
    else { title = "等待同步学习记录"; description = "学习记录已保留，将在后台自动同步。"; }
  } else if (status.lastSyncedAt) { description = "确认协议后恢复自动保存，已有云端记录仍然保留。"; }
  return { authorized, state, title, description, pendingCount, dirty, resetPending: getStatsResetPending(),
    lastSynced: formatTime(status.lastSyncedAt) };
}
module.exports = { getSyncView };
