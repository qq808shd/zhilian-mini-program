const engine = require("../../utils/learningEngine");
const { getProfile, DEFAULT_AVATAR } = require("../../utils/profile");
const { getLearningOverview } = require("../../utils/learningView");
const { getSyncView } = require("../../utils/accountView");
const product = require("../../config/product");
Page({
  data: { profile: {}, summary: {}, learned: 0, sync: {}, filing: product.filingNumber || "备案信息 · 待补齐" },
  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.refresh(); this.refresh(); this.timer = setInterval(() => this.setData({ sync: getSyncView() }), 1500); },
  onHide() { clearInterval(this.timer); }, onUnload() { clearInterval(this.timer); },
  refresh() { const overview = getLearningOverview(); this.setData({ learning: engine.overview(), profile: getProfile(), summary: overview.summary,
    learned: overview.topics.reduce((sum, topic) => sum + topic.learnedCount, 0), sync: getSyncView() }); },
  onAvatarError() { this.setData({ "profile.avatar": DEFAULT_AVATAR }); },
  onOpen(event) { wx.navigateTo({ url: "/pages/" + event.currentTarget.dataset.page + "/index" }); },
  onReview() { wx.switchTab({ url: "/pages/review/index" }); }
});
