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
    const currentIndex = getReadingIndex(topic.id, setIndex, set.count);
    wx.setNavigationBarTitle({ title: `${topic.name}学习` });
    this.setData({ currentIndex, swiperCurrent: currentIndex, topic, module, setName: set.name, setIndex, learningItems: set.items.map((item) => ({ ...item, revealed: false, hasSeparateDetail: normalizeLearningText(item.detail) !== normalizeLearningText(item.summary) })), total: set.count, progressPercent: Number(((currentIndex + 1) * 100 / set.count).toFixed(1)), hideDefinitionBeforeReveal: ["idiom", "word", "three-character-word"].includes(topic.id) });
    markGroupProgress(topic.id, setIndex, currentIndex, set.count);
    saveReadingPosition(topic.id, setIndex, currentIndex);
  },
  onReveal(event) {
    const index = event.currentTarget.dataset.index;
    const key = `learningItems[${index}].revealed`;
    this.setData({ [key]: true });
  },
  onSwiperChange(event) {
    const currentIndex = event.detail.current;
    const { topic, setIndex, total } = this.data;
    this.setData({ currentIndex, swiperCurrent: currentIndex, progressPercent: Number((((currentIndex + 1) / total) * 100).toFixed(1)) });
    markGroupProgress(topic.id, setIndex, currentIndex, total);
    saveReadingPosition(topic.id, setIndex, currentIndex);
  },
  onPrevious() { if (this.data.swiperCurrent > 0) this.setData({ swiperCurrent: this.data.swiperCurrent - 1 }); },
  onNext() { if (this.data.swiperCurrent < this.data.total - 1) this.setData({ swiperCurrent: this.data.swiperCurrent + 1 }); },
  onRestart() {
    saveReadingPosition(this.data.topic.id, this.data.setIndex, 0);
    this.setData({ swiperCurrent: 0, currentIndex: 0, progressPercent: Number((100 / this.data.total).toFixed(1)), learningItems: this.data.learningItems.map((item) => ({ ...item, revealed: false })) });
  },
  onPracticeSet() {
    const ids = new Set(this.data.learningItems.map((item) => item.id));
    const questionIds = questions.filter((question) => ids.has(question.knowledgeId)).map((question) => question.id);
    setExamRequest({ mode: "questionIds", questionIds, title: this.data.topic.name + " · " + this.data.setName, sessionMode: "practice" });
    wx.switchTab({ url: "/pages/exam/index" });
  },
  onBackGroups() {
    wx.redirectTo({ url: `/pages/group/index?topicId=${this.data.topic.id}` });
  },
  onGoStudy() { wx.switchTab({ url: "/pages/study/index" }); }
});
