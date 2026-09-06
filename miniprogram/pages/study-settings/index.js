const engine = require("../../utils/learningEngine");
const { modules, topics, knowledge, getTopicById } = require("../../data/content");
Page({
  data: { modules, topics: [], batches: [], counts: [5, 10, 20], moduleId: '', topicId: '', batchId: '', newCount: 10, scopeCount: 0, saving: false, error: '', tomorrow: false },
  onLoad() {
    const settings = engine.getStudySettings(), topic = getTopicById(settings.topicId);
    this.setData({ moduleId: topic.moduleId, topicId: topic.id, batchId: settings.batchId, newCount: settings.newCount }); this.refresh();
  },
  refresh() {
    const topic = getTopicById(this.data.topicId), day = engine.dailyView();
    this.setData({ topics: topics.filter((t) => t.moduleId === this.data.moduleId),
      batches: [{ id: '', label: '全部' }].concat(topic.groupBatches || []),
      scopeCount: knowledge.filter((k) => k.topicId === topic.id && (!this.data.batchId || k.batchId === this.data.batchId)).length,
      tomorrow: day.started, error: '' });
  },
  onModule(event) {
    const moduleId = event.currentTarget.dataset.id;
    if (moduleId === this.data.moduleId) return;
    const topic = topics.find((t) => t.moduleId === moduleId);
    if (!topic) return;
    this.setData({ moduleId, topicId: topic.id, batchId: '' }); this.refresh();
  },
  onTopic(event) {
    const topic = topics.find((t) => t.id === event.currentTarget.dataset.id && t.moduleId === this.data.moduleId);
    if (!topic || topic.id === this.data.topicId) return;
    this.setData({ topicId: topic.id, batchId: '' }); this.refresh();
  },
  onBatch(event) { this.setData({ batchId: event.currentTarget.dataset.id }); this.refresh(); },
  onCount(event) { this.setData({ newCount: Number(event.currentTarget.dataset.count), error: '' }); },
  onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true, error: '' });
    try {
      const result = engine.saveStudySettings(this.data);
      wx.showToast({ title: !result.changed ? '设置未改变' : result.tomorrow ? '已保存，明日生效' : '学习安排已更新', icon: 'none' });
      wx.navigateBack();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
