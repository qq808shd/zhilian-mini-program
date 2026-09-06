const { markProfilePromptDone, needsWelcome } = require("./account");
function finishOnboarding() {
  if (needsWelcome()) { wx.reLaunch({ url: "/pages/welcome/index" }); return; }
  markProfilePromptDone();
  const app = getApp(), target = app.globalData.launchTarget;
  app.globalData.launchTarget = null;
  const allowed = ["study", "free-study", "study-settings", "today-study", "module", "group", "catalog", "learn", "exam", "review", "review-topic", "review-detail", "detail", "me"];
  const match = target && /^pages\/([a-z-]+)\/index$/.exec(target.path);
  if (match && allowed.includes(match[1])) {
    const query = Object.entries(target.query || {}).map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(String(value))).join("&");
    wx.reLaunch({ url: "/" + target.path + (query ? "?" + query : "") });
  } else wx.switchTab({ url: "/pages/study/index" });
}
function openLegal(event) { wx.navigateTo({ url: "/pages/legal/index?kind=" + event.currentTarget.dataset.kind }); }
module.exports = { finishOnboarding, openLegal };
