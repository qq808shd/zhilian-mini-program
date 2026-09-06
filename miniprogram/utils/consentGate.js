const { needsWelcome } = require("./account");
const PUBLIC_PAGES = ["pages/welcome/index", "pages/legal/index", "pages/filing/index"];

function ensureAccess(path, query = {}) {
  if (!needsWelcome() || PUBLIC_PAGES.includes(path)) return true;
  const app = getApp();
  if (path) app.globalData.launchTarget = { path, query };
  if (!app.globalData.consentRedirecting) {
    app.globalData.consentRedirecting = true;
    wx.nextTick(() => wx.reLaunch({
      url: "/pages/welcome/index",
      complete() { app.globalData.consentRedirecting = false; }
    }));
  }
  return false;
}

// 所有业务页复用入口校验，阻止深链、Tab 和旧导航栈绕过协议。
function guardPage(definition) {
  const result = { ...definition };
  const load = definition.onLoad;
  result.onLoad = function(options = {}) {
    this.consentQuery = options;
    if (!ensureAccess(this.route, options)) return;
    return load && load.call(this, options);
  };
  const show = definition.onShow;
  result.onShow = function() {
    if (!ensureAccess(this.route, this.consentQuery || {})) return;
    return show && show.call(this);
  };
  return result;
}
module.exports = { ensureAccess, guardPage };
