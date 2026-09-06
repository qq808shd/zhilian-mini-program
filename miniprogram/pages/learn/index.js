const engine = require("../../utils/learningEngine");
const { getTopicById, getModuleById, getKnowledgeSet, questions } = require("../../data/content");
const { markGroupProgress, setExamRequest } = require("../../utils/storage");

const { getReadingIndex, saveReadingPosition } = require("../../utils/learningView");

function normalizeLearningText(value) {
  return String(value || "").trim().replace(/[，。；！？,.!?;]+$/g, "");
}

Page({
  data: { topic: null, module: null, setName: "", setIndex: 0, learningItems: [], currentIndex: 0, swiperCurrent: 0, total: 0, progressPercent: 0, hideDefinitionBeforeReveal: false },
  onLoad(options) {
    const setIndex = Number(options.setIndex || 0);
    const topic = getTopicById(options.topicId);
    if (!topic) { this.setData({ error: true }); return; }
    const module = getModuleById(topic.moduleId);
    const set = getKnowledgeSet(topic.id, setIndex);
    if (!set || !set.count) { this.setData({ error: true }); return; }
    engine.getState();
    const action = engine.groupAction(topic.id, setIndex, Date.now(), false);
    const currentIndex = options.index !== undefined ? Math.min(Math.max(Number(options.index) || 0, 0), set.count - 1) : getReadingIndex(topic.id, setIndex, set.count);
    wx.setNavigationBarTitle({ title: `${topic.name}学习` });
    this.setData({ currentIndex, swiperCurrent: currentIndex, topic, module, setName: set.name, setIndex, learningItems: set.items.map((item) => ({ ...item, revealed: false, hasSeparateDetail: normalizeLearningText(item.detail) !== normalizeLearningText(item.summary) })), total: set.count, progressPercent: Number(((currentIndex + 1) * 100 / set.count).toFixed(1)), hideDefinitionBeforeReveal: true, groupAction: action, groupComplete: action.completed });
    engine.startLearning(set.items[currentIndex].id);
    markGroupProgress(topic.id, setIndex, currentIndex, set.count);
    saveReadingPosition(topic.id, setIndex, currentIndex);
  },
  onShow() { if (this.data.topic) this.refreshAction(); },
  refreshAction() { const action = engine.groupAction(this.data.topic.id, this.data.setIndex, Date.now(), false); this.setData({ groupAction: action, groupComplete: action.completed && !this.relearning }); },
  completeCurrent() { const item = this.data.learningItems[this.data.currentIndex]; if (item && item.revealed && !item.saved) { engine.learn(item.id, item.rating || ""); this.setData({ [`learningItems[${this.data.currentIndex}].saved`]: true }); this.refreshAction(); } },
  onRate(event) { const index = Number(event.currentTarget.dataset.index); const item = this.data.learningItems[index]; if (!item || !item.revealed) return; const rating = event.currentTarget.dataset.value; this.setData({ [`learningItems[${index}].rating`]: rating }); engine.learn(item.id, rating); this.setData({ [`learningItems[${index}].saved`]: true }); this.refreshAction(); },
  onAction() { engine.navigateAction(this.data.groupAction); },
  onReveal(event) {
    const index = event.currentTarget.dataset.index;
    const key = `learningItems[${index}].revealed`;
    this.setData({ [key]: true });
  },
  onSwiperChange(event) {
    this.completeCurrent();
    const currentIndex = event.detail.current;
    const { topic, setIndex, total } = this.data;
    this.setData({ currentIndex, swiperCurrent: currentIndex, progressPercent: Number((((currentIndex + 1) / total) * 100).toFixed(1)) });
    engine.startLearning(this.data.learningItems[currentIndex].id);
    markGroupProgress(topic.id, setIndex, currentIndex, total);
    saveReadingPosition(topic.id, setIndex, currentIndex);
  },
  onPrevious() { if (this.data.swiperCurrent > 0) this.setData({ swiperCurrent: this.data.swiperCurrent - 1 }); },
  onNext() { const item = this.data.learningItems[this.data.currentIndex]; if (!item.revealed) { this.onReveal({ currentTarget: { dataset: { index: this.data.currentIndex } } }); return; } this.completeCurrent(); if (this.relearning && this.data.currentIndex === this.data.total - 1) { this.relearning = false; this.refreshAction(); return; } if (this.data.currentIndex < this.data.total - 1) this.setData({ swiperCurrent: this.data.currentIndex + 1 }); else if (!this.data.groupComplete) engine.navigateAction(this.data.groupAction); },
  onRestart() {
    this.relearning = true;
    this.setData({ groupComplete: false });
    saveReadingPosition(this.data.topic.id, this.data.setIndex, 0);
    this.setData({ swiperCurrent: 0, currentIndex: 0, progressPercent: Number((100 / this.data.total).toFixed(1)), learningItems: this.data.learningItems.map((item) => ({ ...item, revealed: false })) });
  },
  onPracticeSet() {
    this.completeCurrent();
    engine.practiceGroup(this.data.topic.id, this.data.setIndex);
  },
  onBackGroups() {
    wx.redirectTo({ url: `/pages/group/index?topicId=${this.data.topic.id}` });
  },
  onGoStudy() { wx.switchTab({ url: "/pages/study/index" }); }
});
