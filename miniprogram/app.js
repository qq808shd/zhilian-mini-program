const { initializeCloudSync, syncCloudData } = require("./utils/cloudSync");

App({
  onLaunch() {
    initializeCloudSync();
  },
  onShow() {
    syncCloudData();
  },
  onHide() {
    syncCloudData();
  },
  globalData: {
    appName: "知练",
    examRequest: null,
    cloudSync: {
      state: "disabled",
      lastSyncedAt: 0,
      revision: 0,
      lastError: ""
    }
  }
});
