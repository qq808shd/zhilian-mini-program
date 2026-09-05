const { initializeCloudSync, syncCloudData } = require("./utils/cloudSync");
const { needsWelcome } = require("./utils/account");

App({
  onLaunch() {
    initializeCloudSync();
  },
  onShow(options = {}) {
    if (needsWelcome() && options.path && !["pages/welcome/index", "pages/legal/index", "pages/profile/index"].includes(options.path)) {
      this.globalData.launchTarget = { path: options.path, query: options.query || {} };
      wx.nextTick(() => wx.reLaunch({ url: "/pages/welcome/index" }));
    }
    syncCloudData();
  },
  onHide() {
    syncCloudData();
  },
  globalData: {
    appName: "知练",
    examRequest: null,
    launchTarget: null,
    cloudSync: {
      state: "disabled",
      lastSyncedAt: 0,
      revision: 0,
      lastError: ""
    }
  }
});
