const engine = require('../../utils/learningEngine');
const { getProfile, DEFAULT_AVATAR } = require('../../utils/profile');
const { getLearningOverview } = require('../../utils/learningView');
const { contact } = require('../../utils/productActions');
const product = require('../../config/product');
Page({
  data: { profile: {}, summary: {}, email: product.contactEmail, filing: product.filingNumber || '备案信息 · 待补齐' },
  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.refresh();
    const overview = getLearningOverview();
    this.setData({ learning: engine.overview(), profile: getProfile(), summary: overview.summary });
  },
  onAvatarError() { this.setData({ 'profile.avatar': DEFAULT_AVATAR }); },
  onOpen(event) { wx.navigateTo({ url: '/pages/' + event.currentTarget.dataset.page + '/index' }); },
  onContact: contact
});
