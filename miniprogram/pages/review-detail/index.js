const { getTopicById, getModuleById } = require('../../data/content');
const { setExamRequest } = require('../../utils/storage');
const engine = require('../../utils/learningEngine');
Page({
  data: { topic: null, module: null, summary: {}, ranked: [], items: [], filter: 'active', sort: 'frequent', visibleCount: 40, total: 0, hasMore: false },
  onLoad(options) { const topic = getTopicById(options.topicId); if (!topic) return; wx.setNavigationBarTitle({ title: `${topic.name}复习` }); this.setData({ topic, module: getModuleById(topic.moduleId) }); },
  onShow() { if (this.data.topic) this.refresh(); },
  refresh() {
    this.allItems = engine.reviewItems(this.data.topic.id);
    const summary = engine.topicSummary(this.data.topic.id);
    this.setData({ summary: { ...summary, activeWrongCount: summary.consolidatingCount }, ranked: this.allItems.filter((r) => r.wrongCount > 0 && r.state !== 'mastered').sort((a,b) => b.wrongCount - a.wrongCount).slice(0,5) });
    this.renderItems();
  },
  renderItems() {
    const filtered = this.allItems.filter((r) => this.data.filter === 'active' ? ['due','consolidating'].includes(r.state) : r.state === this.data.filter)
      .sort(this.data.sort === 'recent' ? (a,b) => (b.lastReviewedAt || 0) - (a.lastReviewedAt || 0) : (a,b) => b.wrongCount - a.wrongCount || a.nextReviewAt - b.nextReviewAt);
    this.setData({ items: filtered.slice(0,this.data.visibleCount), total: filtered.length, hasMore: filtered.length > this.data.visibleCount });
  },
  onFilter(e) { this.setData({ filter: e.currentTarget.dataset.value, visibleCount: 40 }); this.renderItems(); },
  onSort(e) { this.setData({ sort: e.currentTarget.dataset.value, visibleCount: 40 }); this.renderItems(); },
  onMore() { this.setData({ visibleCount: this.data.visibleCount + 40 }); this.renderItems(); },
  onOpenKnowledge(e) { wx.navigateTo({ url: `/pages/detail/index?id=${e.currentTarget.dataset.id}` }); },
  onPracticeOne(e) {
    const item = this.allItems.find((r) => r.id === e.currentTarget.dataset.id); if (!item) return;
    if (!item.questionId) { wx.navigateTo({ url: `/pages/detail/index?id=${item.id}&recall=1` }); return; }
    setExamRequest({ mode: 'questionIds', questionIds: [item.questionId], direct: true }); wx.switchTab({ url: '/pages/exam/index' });
  },
  onStartWrongExam() {
    const questionIds = this.allItems.filter((r) => ['due','consolidating'].includes(r.state) && r.questionId).map((r) => r.questionId);
    if (!questionIds.length) { wx.navigateTo({ url: '/pages/today-study/index' }); return; }
    setExamRequest({ mode: 'questionIds', questionIds, direct: true, count: 10, title: '薄弱知识巩固' }); wx.switchTab({ url: '/pages/exam/index' });
  },
  onToday() { wx.navigateTo({ url: '/pages/today-study/index' }); },
  onStudy() { wx.navigateTo({ url: `/pages/group/index?topicId=${this.data.topic.id}` }); }
});
