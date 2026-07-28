const { getModuleById, getTopicsByModule, getKnowledgeByTopic, getSetsForTopic } = require("../../data/content");
Page({
  data: { module: null, topics: [] },
  onLoad(options) {
    const module = getModuleById(options.id);
    if (!module) return;
    const topics = getTopicsByModule(module.id).map((topic) => ({
      ...topic, knowledgeCount: getKnowledgeByTopic(topic.id).length, setCount: getSetsForTopic(topic.id).length
    }));
    wx.setNavigationBarTitle({ title: module.name });
    this.setData({ module, topics });
  },
  onOpenTopic(event) { wx.navigateTo({ url: `/pages/group/index?topicId=${event.currentTarget.dataset.id}` }); }
});
