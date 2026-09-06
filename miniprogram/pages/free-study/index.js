const { modules } = require("../../data/content");
const { getLearningOverview } = require("../../utils/learningView");
Page({
  data: { modules, activeId: modules[0].id, activeName: modules[0].name, topics: [] },
  onShow() { this.refresh(); },
  refresh() { this.setData({ topics: getLearningOverview().topics.filter((t) => t.moduleId === this.data.activeId) }); },
  onModule(event) {
    const item = modules.find((m) => m.id === event.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ activeId: item.id, activeName: item.name }); this.refresh();
  },
  onTopic(event) { wx.navigateTo({ url: "/pages/group/index?topicId=" + event.currentTarget.dataset.id }); },
  onSearch() { wx.navigateTo({ url: "/pages/catalog/index" }); }
});
