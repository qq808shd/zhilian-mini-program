const engine = require('../../utils/learningEngine');
const { getLearningOverview } = require('../../utils/learningView');
const dashboard = require('../../utils/learningDashboard');
Page({
  data: { recent: [], topics: [], activity: [], today: {} },
  onShow() { const now = Date.now(), view = getLearningOverview(), state = engine.getState(now); this.setData({ today: dashboard.completion(state, now), activity: dashboard.recentActivity(state, now), recent: view.recent, topics: view.topics.filter(t => t.learnedCount) }); },
  onRecent(e) { const item = this.data.recent[e.currentTarget.dataset.index]; if (item) engine.navigateAction(engine.groupAction(item.topicId, item.setIndex)); },
  onTopic(e) { wx.navigateTo({ url: '/pages/group/index?topicId=' + e.currentTarget.dataset.id }); },
  onKnowledge(e) { wx.navigateTo({ url: '/pages/detail/index?id=' + e.currentTarget.dataset.id }); },
  onToday() { wx.switchTab({ url: '/pages/study/index' }); },
  onStart() { wx.switchTab({ url: '/pages/study/index' }); }
});
