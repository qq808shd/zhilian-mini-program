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
  const pendingCount = getPendingAnswerEvents().length;
  let title = "学习记录，仅保存在本机";
  let description = "开启同步后，可在其他设备接着学。";
  let state = "local";
  if (getPreferences().acceptedAt && !hasCurrentConsent()) {
    description = "协议已更新，重新确认后可恢复同步。";
  } else if (authorized) {
    state = status.state || "syncing";
    if (!isCloudEnabled()) { title = "同步服务尚未配置"; description = "学习记录保留在本机。"; }
    else if (state === "syncing") { title = "正在同步学习记录"; description = "可以继续学习，本机记录会保留。"; }
    else if (state === "offline") { title = "同步暂未完成"; description = "本机记录已保留，恢复网络后自动重试。"; }
    else if (dirty) { title = "有学习记录等待同步"; description = "请保持网络连接，或点击立即同步。"; }
    else if (state === "ready") { title = "学习记录已同步"; description = "其他设备使用同一微信可继续学习。"; }
    else { title = "等待同步学习记录"; description = "可点击立即同步，学习记录保留在本机。"; }
  } else if (status.lastSyncedAt) { description = "同步已停止，已有云端记录仍然保留。"; }
  return { authorized, state, title, description, pendingCount, dirty, resetPending: getStatsResetPending(),
    lastSynced: formatTime(status.lastSyncedAt) };
}
module.exports = { getSyncView };
