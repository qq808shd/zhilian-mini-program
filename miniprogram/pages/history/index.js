const engine = require("../../utils/learningEngine");
const { getLearningOverview } = require("../../utils/learningView");
Page({ data: { recent: [], topics: [] }, onShow() { const view = getLearningOverview(); this.setData({ daily: engine.dailyView(), recent: view.recent, topics: view.topics.filter((topic) => topic.learnedCount) }); },
  onRecent(event) { const item = this.data.recent[event.currentTarget.dataset.index]; if (item) engine.navigateAction(engine.groupAction(item.topicId, item.setIndex)); },
  onTopic(event) { wx.navigateTo({ url: "/pages/group/index?topicId=" + event.currentTarget.dataset.id }); },
  onToday() { wx.navigateTo({ url: "/pages/today-study/index" }); },
  onStart() { wx.switchTab({ url: "/pages/study/index" }); }
});
