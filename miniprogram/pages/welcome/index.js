const { needsWelcome, getPreferences, acceptTerms, getConsentScope } = require("../../utils/account");
const { syncCloudData } = require("../../utils/cloudSync");
const { finishOnboarding, openLegal } = require("../../utils/accountNavigation");
Page({
  data: { agreed: false, busy: false, unavailable: false, error: "" },
  onLoad(options) {
    this.setData({ unavailable: getConsentScope() === "unavailable" });
    if (!needsWelcome()) finishOnboarding();
  },
  onAgreement(event) { this.setData({ agreed: event.detail.value.includes("agree"), error: "" }); },
  onLegal: openLegal,
  onContinue() {
    if (!this.data.agreed || this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      acceptTerms(); syncCloudData();
      if (!getPreferences().profilePromptDone) wx.redirectTo({ url: "/pages/profile/index?onboarding=1" });
      else finishOnboarding();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
