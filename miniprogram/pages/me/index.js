const engine = require('../../utils/learningEngine');
const { getProfile, DEFAULT_AVATAR } = require('../../utils/profile');
const { buildDashboard } = require('../../utils/learningDashboard');
const { getQuestionStats } = require('../../utils/storage');
const { contact } = require('../../utils/productActions');
const product = require('../../config/product');
Page({
  data: { profile: {}, summary: {}, email: product.contactEmail, filing: product.filingNumber || '备案信息 · 待补齐' },
  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.refresh();
    const now = Date.now(), settings = engine.getStudySettings(now);
    const view = buildDashboard(engine.getState(now), settings, getQuestionStats(), now);
    this.setData({ learning: view.learning, profile: getProfile() });
  },
  onAvatarError() { this.setData({ 'profile.avatar': DEFAULT_AVATAR }); },
  onOpen(event) { wx.navigateTo({ url: '/pages/' + event.currentTarget.dataset.page + '/index' }); },
  onContact: contact
});
