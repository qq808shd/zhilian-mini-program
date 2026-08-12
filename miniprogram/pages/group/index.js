const { getTopicById, getModuleById, getSetsForTopic } = require("../../data/content");
const { getGroupProgress } = require("../../utils/storage");

Page({
  data: { topic: null, module: null, sets: [], total: 0 },
  onLoad(options) { this.loadTopic(options.topicId); },
  onShow() { if (this.data.topic) this.loadTopic(this.data.topic.id); },
  loadTopic(topicId) {
    const topic = getTopicById(topicId);
    if (!topic) return;
    const module = getModuleById(topic.moduleId);
    const sets = getSetsForTopic(topicId).map((set) => {
      const { items, ...setSummary } = set;
      const progress = getGroupProgress(topicId, set.index);
      const learnedCount = progress ? Math.min((progress.maxIndex || 0) + 1, set.count) : 0;
      const completed = Boolean(progress && progress.total === set.count && progress.maxIndex >= set.count - 1);
      return {
        ...setSummary,
        learnedCount,
        status: completed ? "已学完 · 可重新学习" : learnedCount ? `已学习 ${learnedCount} 条 · 继续学习` : "开始学习"
      };
    });
    wx.setNavigationBarTitle({ title: topic.name });
    this.setData({ topic, module, sets, total: sets.reduce((sum, set) => sum + set.count, 0) });
  },
  onOpenSet(event) {
    const { index } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/learn/index?topicId=${this.data.topic.id}&setIndex=${index}` });
  },
  onOpenCatalog() {
    wx.navigateTo({ url: `/pages/catalog/index?topicId=${this.data.topic.id}` });
  }
});
