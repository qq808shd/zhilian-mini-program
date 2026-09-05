const { getModuleById } = require("../../data/content");
const { getLearningOverview } = require("../../utils/learningView");
Page({
  data: { module: null, topics: [] },
  onLoad(options) {
    const module = getModuleById(options.id);
    if (!module) return;
    wx.setNavigationBarTitle({ title: module.name });
    this.setData({ module });
  },
  onShow() {
    if (this.data.module) this.setData({ topics: getLearningOverview().topics.filter((topic) => topic.moduleId === this.data.module.id) });
  },
  onOpenTopic(event) { wx.navigateTo({ url: `/pages/group/index?topicId=${event.currentTarget.dataset.id}` }); }
});
