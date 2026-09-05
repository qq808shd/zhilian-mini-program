const { getModuleById } = require("../../data/content");
const { getLearningOverview } = require("../../utils/learningView");
Page({
  data: { module: null, topics: [] },
  onLoad(options) {
    const module = getModuleById(options.moduleId);
    if (!module) return;
    wx.setNavigationBarTitle({ title: `${module.name}复习` });
    this.setData({ module });
  },
  onShow() {
    if (!this.data.module) return;
    const topics = getLearningOverview().topics.filter((topic) => topic.moduleId === this.data.module.id)
      .sort((a, b) => b.activeWrongCount - a.activeWrongCount);
    this.setData({ topics });
  },
  onOpenTopic(event) { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${event.currentTarget.dataset.id}` }); }
});
