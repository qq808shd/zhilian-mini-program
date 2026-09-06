const engine = require("../../utils/learningEngine");
const { modules, topics, knowledge, getTopicById } = require("../../data/content");
Page({
  data: { modules, topics: [], moduleId: '', topicId: '', newCount: 10, sliderValue: 10, scopeCount: 0, maxCount: 200, sliderMax: 200, saving: false, error: '', tomorrow: false },
  onLoad() {
    const settings = engine.getStudySettings(), topic = getTopicById(settings.topicId);
    this.setData({ moduleId: topic.moduleId, topicId: topic.id, newCount: settings.newCount }); this.refresh();
  },
  refresh() {
    const scopeCount = knowledge.filter((k) => k.topicId === this.data.topicId).length;
    const maxCount = engine.studyLimit(this.data.topicId);
    const newCount = Math.min(maxCount, Math.max(1, this.data.newCount));
    this.setData({ topics: topics.filter((t) => t.moduleId === this.data.moduleId), scopeCount, maxCount,
      sliderMax: Math.max(2, maxCount), newCount, sliderValue: newCount,
      tomorrow: engine.dailyView().started, error: '' });
  },
  onModule(event) {
    const moduleId = event.currentTarget.dataset.id;
    if (moduleId === this.data.moduleId) return;
    const topic = topics.find((t) => t.moduleId === moduleId);
    if (!topic) return;
    this.setData({ moduleId, topicId: topic.id }); this.refresh();
  },
  onTopic(event) {
    const topic = topics.find((t) => t.id === event.currentTarget.dataset.id && t.moduleId === this.data.moduleId);
    if (!topic || topic.id === this.data.topicId) return;
    this.setData({ topicId: topic.id }); this.refresh();
  },
  onChanging(event) { this.updateCount(event, false); },
  onCount(event) { this.updateCount(event, true); },
  updateCount(event, settled) {
    const value = Number(event.detail.value);
    if (!Number.isFinite(value) || !this.data.maxCount) return;
    const newCount = Math.min(this.data.maxCount, Math.max(1, Math.round(value)));
    // While dragging, only refresh the label; let the native thumb follow the finger.
    this.setData({ newCount, ...(settled ? { sliderValue: newCount } : {}), error: '' });
  },
  onPlanHelp() {
    wx.showModal({
      title: '今日学习怎么安排',
      content: '上面的数量只计算新学内容。\n\n先复习：从本分类已到复习时间的旧知识里安排，最多 10 个。\n\n再新学：按你设置的数量学习新内容。\n\n后练习：用本分类的配套题检查记忆，最多 5 道。\n\n10 和 5 是当前固定上限，与新学数量无关。不足时按实际数量安排，没有对应内容就跳过。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#456F59'
    });
  },
  onSave() {
    if (this.data.saving || !this.data.maxCount) return;
    this.setData({ saving: true, error: '' });
    try {
      const result = engine.saveStudySettings(this.data);
      wx.showToast({ title: !result.changed ? '设置未改变' : result.tomorrow ? '已保存，明日生效' : '学习安排已更新', icon: 'none' });
      wx.navigateBack();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
