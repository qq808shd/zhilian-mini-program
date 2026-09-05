const { getLearningOverview } = require("../../utils/learningView");
Page({ data: { recent: [], topics: [] }, onShow() { const view = getLearningOverview(); this.setData({ recent: view.recent, topics: view.topics.filter((topic) => topic.learnedCount) }); },
  onRecent(event) { const item = this.data.recent[event.currentTarget.dataset.index]; if (item) wx.navigateTo({ url: "/pages/learn/index?topicId=" + item.topicId + "&setIndex=" + item.setIndex }); },
  onTopic(event) { wx.navigateTo({ url: "/pages/group/index?topicId=" + event.currentTarget.dataset.id }); },
  onStart() { wx.switchTab({ url: "/pages/study/index" }); }
});
