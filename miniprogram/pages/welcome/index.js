const { needsWelcome, getPreferences, acceptTerms, chooseLocalMode, getConsentScope, isPublicationReady } = require("../../utils/account");
const { syncCloudData } = require("../../utils/cloudSync");
const { finishOnboarding, openLegal } = require("../../utils/accountNavigation");
Page({
  data: { agreed: false, busy: false, draft: true, unavailable: false, enableOnly: false, error: "" },
  onLoad(options) {
    this.setData({ enableOnly: options.enable === "1", draft: !isPublicationReady(), unavailable: getConsentScope() === "unavailable" });
    if (!this.data.enableOnly && !needsWelcome()) finishOnboarding();
  },
  onAgreement(event) { this.setData({ agreed: event.detail.value.includes("agree"), error: "" }); },
  onLegal: openLegal,
  onContinue() {
    if (!this.data.agreed || this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      acceptTerms(); syncCloudData();
      if (!getPreferences().profilePromptDone) wx.redirectTo({ url: "/pages/profile/index?onboarding=1" });
      else if (this.data.enableOnly) wx.navigateBack();
      else finishOnboarding();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  onLocal() {
    if (this.data.enableOnly) { wx.navigateBack(); return; }
    try { chooseLocalMode(); finishOnboarding(); }
    catch (_) { this.setData({ error: "无法保存选择，请检查设备空间后重试" }); }
  }
});
