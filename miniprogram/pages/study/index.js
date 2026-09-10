const engine = require('../../utils/learningEngine');
const { getQuestionStats } = require('../../utils/storage');
const { buildDashboard } = require('../../utils/learningDashboard');
const guide = require('../../utils/learningGuide');
Page({
  data: { daily: {}, scope: {}, topic: null, action: {}, guideOpen: false, onboarding: false, dueHint: false },
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.refresh(); this.refresh(); if (!guide.read().completed) this.openGuide(true); else this.updateDueHint(); },
  onHide() { this.setBar(false); },
  onUnload() { this.setBar(false); },
  refresh() { const now = Date.now(), settings = engine.getStudySettings(now); this.setData(buildDashboard(engine.getState(now), settings, getQuestionStats(), now)); this.setBar(this.data.guideOpen); },
  setBar(hidden) { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setData({ hidden }); },
  openGuide(onboarding) { this.setData({ guideOpen: true, onboarding }); this.setBar(true); },
  onRules() { this.openGuide(false); },
  onGuideClose() { this.setData({ guideOpen: false }); this.setBar(false); this.updateDueHint(); },
  updateDueHint() { if (this.data.daily.due && guide.takeHint('due')) this.setData({ dueHint: true }); },
  onPrimary() { if (this.data.action.type === 'review') this.onReview(); else if (this.data.action.type === 'new') this.onToday(); else this.onScope(); },
  onToday() { wx.navigateTo({ url: '/pages/today-study/index?mode=new' }); },
  onReview() { wx.navigateTo({ url: '/pages/today-study/index?mode=review' }); },
  onScope() { wx.navigateTo({ url: '/pages/free-study/index?mode=scope' }); },
  onSettings() { wx.navigateTo({ url: '/pages/study-settings/index' }); },
  onFreeStudy() { wx.navigateTo({ url: '/pages/free-study/index' }); },
  onPractice() { wx.switchTab({ url: '/pages/exam/index' }); },
  onDegree(e) { if (this.data.topic) wx.navigateTo({ url: '/pages/review-detail/index?topicId=' + this.data.topic.id + '&filter=' + (e.currentTarget.dataset.value || 'all') }); }
});
