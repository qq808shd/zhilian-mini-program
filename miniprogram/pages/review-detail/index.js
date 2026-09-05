const { questions, getTopicById, getModuleById, getKnowledgeById } = require("../../data/content");
const { getQuestionStats, setExamRequest } = require("../../utils/storage");
const { summarize } = require("../../utils/learningView");
function dateLabel(timestamp) {
  if (!timestamp) return "暂无时间记录";
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
Page({
  data: { topic: null, module: null, summary: {}, ranked: [], items: [], filter: "active", sort: "frequent", visibleCount: 40, total: 0, hasMore: false },
  onLoad(options) {
    const topic = getTopicById(options.topicId);
    if (!topic) return;
    wx.setNavigationBarTitle({ title: `${topic.name}复习` });
    this.setData({ topic, module: getModuleById(topic.moduleId) });
  },
  onShow() { if (this.data.topic) this.refresh(); },
  refresh() {
    const stats = getQuestionStats();
    const source = questions.filter((q) => q.topicId === this.data.topic.id && stats[q.id]);
    const grouped = {};
    this.allItems = source.filter((q) => stats[q.id].wrong > 0).map((question) => {
      const record = stats[question.id];
      const knowledge = getKnowledgeById(question.knowledgeId);
      if (record.activeWrong) {
        const key = question.knowledgeId || question.id;
        if (!grouped[key]) grouped[key] = { id: key, knowledgeId: question.knowledgeId, title: knowledge ? knowledge.title : question.stem, wrong: 0 };
        grouped[key].wrong += record.wrong;
      }
      return { id: question.id, knowledgeId: question.knowledgeId, title: knowledge ? knowledge.title : "关联知识", stem: question.stem,
        wrong: record.wrong, activeWrong: record.activeWrong, lastWrongAt: record.lastWrongAt,
        date: dateLabel(record.lastWrongAt), status: !record.activeWrong ? "已巩固 · 连续答对 2 次" : record.consecutiveCorrect === 1 ? "已答对 1 次 · 再巩固一次" : "待复习" };
    });
    this.setData({ summary: summarize(source.map((q) => stats[q.id])), ranked: Object.values(grouped).sort((a, b) => b.wrong - a.wrong).slice(0, 5) });
    this.renderItems();
  },
  renderItems() {
    const filtered = this.allItems.filter((item) => this.data.filter === "active" ? item.activeWrong : !item.activeWrong)
      .sort(this.data.sort === "recent" ? (a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0) : (a, b) => b.wrong - a.wrong || (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
    this.setData({ items: filtered.slice(0, this.data.visibleCount), total: filtered.length, hasMore: filtered.length > this.data.visibleCount });
  },
  onFilter(event) { this.setData({ filter: event.currentTarget.dataset.value, visibleCount: 40 }); this.renderItems(); },
  onSort(event) { this.setData({ sort: event.currentTarget.dataset.value, visibleCount: 40 }); this.renderItems(); },
  onMore() { this.setData({ visibleCount: this.data.visibleCount + 40 }); this.renderItems(); },
  onOpenKnowledge(event) { wx.navigateTo({ url: `/pages/detail/index?id=${event.currentTarget.dataset.id}` }); },
  onPracticeOne(event) { setExamRequest({ mode: "questionIds", questionIds: [event.currentTarget.dataset.id] }); wx.switchTab({ url: "/pages/exam/index" }); },
  onStartWrongExam() {
    if (!this.data.summary.activeWrongCount) return;
    setExamRequest({ mode: "wrong", topicId: this.data.topic.id }); wx.switchTab({ url: "/pages/exam/index" });
  },
  onStudy() { wx.navigateTo({ url: `/pages/group/index?topicId=${this.data.topic.id}` }); }
});
