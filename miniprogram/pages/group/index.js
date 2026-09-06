const engine = require("../../utils/learningEngine");
const { getTopicById, getModuleById, getSetsForTopic } = require("../../data/content");
const { getGroupProgress, setExamRequest } = require("../../utils/storage");

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
      const action = engine.groupAction(topicId, set.index);
      const progress = getGroupProgress(topicId, set.index);
      const learnedCount = action.learnedCount;
      const completed = Boolean(progress && progress.total === set.count && progress.maxIndex >= set.count - 1);
      return {
        ...setSummary, preview: items.slice(0, 3).map((i) => i.title).join("、"),
        learnedCount,
        progress: Math.round(learnedCount / set.count * 100),
        status: action.label, action
      };
    });
    wx.setNavigationBarTitle({ title: topic.name });
    const suggested = sets.find((s) => !s.action.completed || s.action.type === "practice" || s.action.type === "review") || sets[sets.length - 1];
    this.setData({ topic, module, sets, suggested: suggested && suggested.action, metrics: engine.topicSummary(topicId), total: sets.reduce((sum, set) => sum + set.count, 0) });
  },
  onOpenSet(event) {
    const { index } = event.currentTarget.dataset;
    engine.navigateAction(engine.groupAction(this.data.topic.id, Number(index)));
  },
  onContinue() { engine.navigateAction(this.data.suggested); },
  onWeak() { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${this.data.topic.id}` }); },
  onPractice() {
    setExamRequest({ mode: "topic", topicId: this.data.topic.id });
    wx.switchTab({ url: "/pages/exam/index" });
  },
  onOpenCatalog() {
    wx.navigateTo({ url: `/pages/catalog/index?topicId=${this.data.topic.id}` });
  }
});
