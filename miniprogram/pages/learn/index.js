const { getTopicById, getModuleById, getKnowledgeSet } = require("../../data/content");
const { markGroupProgress } = require("../../utils/storage");

function normalizeLearningText(value) {
  return String(value || "").trim().replace(/[，。；！？,.!?;]+$/g, "");
}

Page({
  data: { topic: null, module: null, setName: "", setIndex: 0, learningItems: [], currentIndex: 0, swiperCurrent: 0, total: 0, progressPercent: 0, hideDefinitionBeforeReveal: false },
  onLoad(options) {
    const setIndex = Number(options.setIndex || 0);
    const topic = getTopicById(options.topicId);
    if (!topic) return;
    const module = getModuleById(topic.moduleId);
    const set = getKnowledgeSet(topic.id, setIndex);
    if (!set) return;
    wx.setNavigationBarTitle({ title: `${topic.name}学习` });
    this.setData({ topic, module, setName: set.name, setIndex, learningItems: set.items.map((item) => ({ ...item, revealed: false, hasSeparateDetail: normalizeLearningText(item.detail) !== normalizeLearningText(item.summary) })), total: set.count, progressPercent: Number((100 / set.count).toFixed(1)), hideDefinitionBeforeReveal: ["idiom", "word", "three-character-word"].includes(topic.id) });
    markGroupProgress(topic.id, setIndex, 0, set.count);
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
  },
  onPrevious() { if (this.data.swiperCurrent > 0) this.setData({ swiperCurrent: this.data.swiperCurrent - 1 }); },
  onNext() { if (this.data.swiperCurrent < this.data.total - 1) this.setData({ swiperCurrent: this.data.swiperCurrent + 1 }); },
  onRestart() {
    this.setData({ swiperCurrent: 0, currentIndex: 0, progressPercent: Number((100 / this.data.total).toFixed(1)), learningItems: this.data.learningItems.map((item) => ({ ...item, revealed: false })) });
  },
  onBackGroups() { wx.navigateBack(); }
});
