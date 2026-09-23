const { initializeCloudSync, syncCloudData } = require("./utils/cloudSync");
const { ensureAccess, guardPage } = require("./utils/consentGate");

const registerPage = Page;
Page = function(definition) {
  const page = { ...definition };
  // 普通页面分享应用入口；小组等页面可保留自己的分享路径。
  if (!page.onShareAppMessage) {
    page.onShareAppMessage = () => ({ title: "知练 · 学习与复习", path: "/pages/study/index" });
  }
  return registerPage(guardPage(page));
};

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
