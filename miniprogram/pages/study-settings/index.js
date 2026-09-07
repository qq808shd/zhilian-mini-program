const engine = require('../../utils/learningEngine');
const { knowledge, getTopicById } = require('../../data/content');
Page({
  data: { topicId: '', topicName: '', newCount: 10, sliderValue: 10, scopeCount: 0, maxCount: 200, sliderMax: 200, saving: false, clearing: false, error: '' },
  onLoad() {
    const settings = engine.getStudySettings(), topic = getTopicById(settings.topicId);
    const scopeCount = knowledge.filter(k => k.topicId === topic.id).length;
    const maxCount = engine.studyLimit(topic.id);
    this.setData({ topicId: topic.id, topicName: topic.name, newCount: settings.newCount, sliderValue: settings.newCount,
      scopeCount, maxCount, sliderMax: Math.max(2, maxCount), error: '' });
  },
  onChanging(event) { this.updateCount(event, false); },
  onCount(event) { this.updateCount(event, true); },
  onStep(event) { this.updateCount({ detail: { value: this.data.newCount + Number(event.currentTarget.dataset.step) } }, true); },
  updateCount(event, settled) {
    const value = Number(event.detail.value);
    if (!Number.isFinite(value) || !this.data.maxCount) return;
    const newCount = Math.min(this.data.maxCount, Math.max(1, Math.round(value)));
    this.setData({ newCount, ...(settled ? { sliderValue: newCount } : {}), error: '' });
  },
  scopeIsCurrent() {
    if (engine.getStudySettings().topicId === this.data.topicId) return true;
    this.onLoad();
    wx.showToast({ title: '学习范围已更新，请重新操作', icon: 'none' });
    return false;
  },
  onClear() {
    if (this.data.clearing || this.data.saving || !this.scopeIsCurrent()) return;
    const { topicId, topicName } = this.data;
    this.setData({ clearing: true, error: '' });
    wx.showModal({
      title: `清空「${topicName}」的学习记录？`,
      content: '该范围的学习进度、程度标记（含熟知）、复习安排和阅读位置将全部重置。\n其他范围和答题统计不受影响。此操作无法撤销。',
      confirmText: '确认清空', cancelText: '取消', confirmColor: '#AA6557',
      success: result => {
        if (!result.confirm || !this.scopeIsCurrent()) return;
        try {
          engine.resetLearning(topicId);
          wx.showToast({ title: '该范围学习记录已清空', icon: 'none' });
        } catch (error) { this.setData({ error: error.message || '清空失败，请重试' }); }
      },
      fail: () => this.setData({ error: '暂时无法打开确认弹窗，请重试' }),
      complete: () => this.setData({ clearing: false })
    });
  },
  onSave() {
    if (this.data.saving || this.data.clearing || !this.data.maxCount || !this.scopeIsCurrent()) return;
    this.setData({ saving: true, error: '' });
    try {
      const result = engine.saveStudySettings({ topicId: this.data.topicId, newCount: this.data.newCount });
      wx.showToast({ title: !result.changed ? '设置未改变' : '学习安排已更新', icon: 'none' });
      wx.navigateBack();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
