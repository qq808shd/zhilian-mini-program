const { modules, getTopicsByModule, getKnowledgeByTopic } = require("../../data/content");

Page({
  data: { moduleCards: [] },
  onLoad() { this.refresh(); },
  onShow() { this.refresh(); },
  refresh() {
    this.setData({
      moduleCards: modules.map((module) => {
        const topicItems = getTopicsByModule(module.id);
        return {
          ...module,
          topicCount: topicItems.length,
          knowledgeCount: topicItems.reduce((sum, topic) => sum + getKnowledgeByTopic(topic.id).length, 0)
        };
      })
    });
  },
  onOpenModule(event) {
    wx.navigateTo({ url: `/pages/module/index?id=${event.currentTarget.dataset.id}` });
  }
});
