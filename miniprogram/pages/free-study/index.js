const { modules, getTopicById } = require('../../data/content');
const { getLearningOverview } = require('../../utils/learningView');
const engine = require('../../utils/learningEngine');
Page({
  data: { modules, activeId: modules[0].id, activeName: modules[0].name, topics: [], scopeMode: false, selectedTopicId: '' },
  onLoad(options = {}) {
    const settings = engine.getStudySettings(), topic = getTopicById(settings.topicId), module = modules.find(m => m.id === topic.moduleId);
    this.setData({ scopeMode: options.mode === 'scope', selectedTopicId: topic.id, activeId: module.id, activeName: module.name });
    wx.setNavigationBarTitle({ title: options.mode === 'scope' ? '选择学习内容' : '学习内容' });
  },
  onShow() { this.refresh(); },
  refresh() { this.setData({ topics: getLearningOverview().topics.filter(t => t.moduleId === this.data.activeId) }); },
  onModule(event) { const item = modules.find(m => m.id === event.currentTarget.dataset.id); if (!item) return; this.setData({ activeId: item.id, activeName: item.name }); this.refresh(); },
  onTopic(event) {
    const topicId = event.currentTarget.dataset.id;
    if (!this.data.scopeMode) { wx.navigateTo({ url: '/pages/group/index?topicId=' + topicId }); return; }
    const settings = engine.getStudySettings();
    engine.saveStudySettings({ topicId, newCount: Math.min(settings.newCount, engine.studyLimit(topicId)) });
    wx.navigateBack();
  },
  onSearch() { wx.navigateTo({ url: '/pages/catalog/index' }); }
});
