const engine = require('../../utils/learningEngine');
const { getTopicById, getModuleById } = require('../../data/content');
Page({
  data: { daily: {}, scope: {}, topic: null, module: null },
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.refresh(); this.refresh(); },
  refresh() {
    const settings = engine.getStudySettings(), topic = getTopicById(settings.topicId);
    this.setData({ topic, module: getModuleById(topic.moduleId), scope: engine.topicSummary(topic.id), daily: engine.dailyView() });
  },
  onToday() { wx.navigateTo({ url: '/pages/today-study/index?mode=new' }); },
  onReview() { wx.navigateTo({ url: '/pages/today-study/index?mode=review' }); },
  onScope() { wx.navigateTo({ url: '/pages/free-study/index?mode=scope' }); },
  onSettings() { wx.navigateTo({ url: '/pages/study-settings/index' }); },
  onFreeStudy() { wx.navigateTo({ url: '/pages/free-study/index' }); },
  onDegree(e) { wx.navigateTo({ url: '/pages/review-detail/index?topicId=' + this.data.topic.id + '&filter=' + e.currentTarget.dataset.value }); }
});
