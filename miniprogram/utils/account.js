const product = require("../config/product");
const KEY = "zhilian_account_preferences_v1";
function getEnvironment() {
  try { return wx.getAccountInfoSync().miniProgram.envVersion || "release"; } catch (_) { return "release"; }
}
function isPublicationReady() {
  return !!(product.published && product.operator && product.contactEmail && product.filingNumber && product.effectiveDate);
}
function getConsentScope() {
  return isPublicationReady() ? "published" : getEnvironment() !== "release" ? "preview" : "unavailable";
}
function getPreferences() { return wx.getStorageSync(KEY) || {}; }
function hasCurrentConsent() {
  const saved = getPreferences();
  return getConsentScope() !== "unavailable" && saved.policyVersion === product.policyVersion &&
    saved.consentScope === getConsentScope() && !!saved.acceptedAt;
}
function isSyncAuthorized() { return hasCurrentConsent() && getPreferences().cloudEnabled === true; }
function needsWelcome() {
  return !isSyncAuthorized();
}
function acceptTerms() {
  const scope = getConsentScope();
  if (scope === "unavailable") throw new Error("服务尚未开放，请稍后再试");
  const saved = { ...getPreferences(), onboardingComplete: true, policyVersion: product.policyVersion,
    consentScope: scope, acceptedAt: Date.now(), cloudEnabled: true };
  wx.setStorageSync(KEY, saved);
}
function chooseLocalMode() {
  wx.setStorageSync(KEY, { ...getPreferences(), onboardingComplete: true, acceptedAt: 0, cloudEnabled: false,
    policyVersion: product.policyVersion, consentScope: "" });
}
function stopSyncPreference() { wx.setStorageSync(KEY, { ...getPreferences(), cloudEnabled: false }); }
function enableSyncPreference() {
  if (!hasCurrentConsent()) throw new Error("请先阅读并同意当前协议");
  wx.setStorageSync(KEY, { ...getPreferences(), cloudEnabled: true });
}
function markProfilePromptDone() { wx.setStorageSync(KEY, { ...getPreferences(), profilePromptDone: true }); }
function getVersionLabel() {
  try {
    const info = wx.getAccountInfoSync().miniProgram;
    return info.envVersion === "release" ? (info.version || "正式版") : info.envVersion === "trial" ? "体验版" : "开发版";
  } catch (_) { return "版本信息暂不可用"; }
}
module.exports = { getPreferences, getEnvironment, getConsentScope, isPublicationReady, hasCurrentConsent,
  isSyncAuthorized, needsWelcome, acceptTerms, chooseLocalMode, stopSyncPreference, enableSyncPreference,
  markProfilePromptDone, getVersionLabel };
