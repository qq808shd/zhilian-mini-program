const { initializeCloudSync, syncCloudData } = require("./utils/cloudSync");
const { ensureAccess, guardPage } = require("./utils/consentGate");

const registerPage = Page;
Page = function(definition) { return registerPage(guardPage(definition)); };

App({
  onLaunch() {
    require("./utils/storage").recoverAnswerWrites();
    require("./utils/learningEngine").repairDailyAnswers();
    initializeCloudSync();
  },
  onShow(options = {}) {
    ensureAccess(options.path, options.query);
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
