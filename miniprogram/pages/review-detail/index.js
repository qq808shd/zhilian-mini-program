const { getTopicById, getModuleById } = require('../../data/content');
const engine = require('../../utils/learningEngine');
const filters = [{ value: 'due', label: '今日待复习' }, { value: 'all', label: '全部已学' }, { value: 'none', label: '陌生' }, { value: 'fuzzy', label: '了解' }, { value: 'remembered', label: '掌握' }, { value: 'known', label: '熟知' }];
Page({
  data: { topic: null, module: null, summary: {}, items: [], filter: 'due', filters, filterIndex: 0, visibleCount: 40, total: 0, hasMore: false },
  onLoad(options) {
    const topic = getTopicById(options.topicId); if (!topic) return;
    const filterIndex = Math.max(0, filters.findIndex(f => f.value === options.filter));
    wx.setNavigationBarTitle({ title: topic.name + ' · 已学内容' });
    this.setData({ topic, module: getModuleById(topic.moduleId), filter: filters[filterIndex].value, filterIndex });
  },
  onShow() { if (this.data.topic) this.refresh(); },
  refresh() { this.allItems = engine.reviewItems(this.data.topic.id); this.setData({ summary: engine.topicSummary(this.data.topic.id) }); this.renderItems(); },
  renderItems() {
    const filter = this.data.filter;
    const filtered = this.allItems.filter(r => filter === 'all' || (filter === 'due' ? r.due : filter === 'known' ? r.excluded : !r.excluded && r.rating === filter));
    this.setData({ items: filtered.slice(0, this.data.visibleCount), total: filtered.length, hasMore: filtered.length > this.data.visibleCount });
  },
  onFilter(e) { const filterIndex = Number(e.detail.value); if (!filters[filterIndex]) return; this.setData({ filter: filters[filterIndex].value, filterIndex, visibleCount: 40 }); this.renderItems(); },
  onMore() { this.setData({ visibleCount: this.data.visibleCount + 40 }); this.renderItems(); },
  onOpenKnowledge(e) { wx.navigateTo({ url: '/pages/detail/index?id=' + e.currentTarget.dataset.id }); },
  onPracticeOne(e) { wx.navigateTo({ url: '/pages/detail/index?id=' + e.currentTarget.dataset.id + '&recall=1' }); },
  onToday() { wx.navigateTo({ url: '/pages/today-study/index?mode=review&topicId=' + this.data.topic.id }); },
  onStudy() { wx.navigateTo({ url: '/pages/group/index?topicId=' + this.data.topic.id }); }
});
