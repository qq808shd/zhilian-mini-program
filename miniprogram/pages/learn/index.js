const engine = require("../../utils/learningEngine");
const { getTopicById, getModuleById, getKnowledgeSet } = require("../../data/content");
const { markGroupProgress } = require("../../utils/storage");
const { getReadingIndex, saveReadingPosition } = require("../../utils/learningView");

const RATINGS = ["none", "fuzzy", "remembered"];
function normalizeLearningText(value) {
  return String(value || "").trim().replace(/[，。；！？,.!?;]+$/g, "");
}

Page({
  data: {
    topic: null, module: null, setName: "", setIndex: 0, learningItems: [],
    currentIndex: 0, swiperCurrent: 0, total: 0, progressPercent: 0,
    groupComplete: false, showCompletion: false, saving: false, confirming: false
  },
  onLoad(options) {
    const setIndex = Number(options.setIndex || 0);
    const topic = getTopicById(options.topicId);
    const set = topic && getKnowledgeSet(topic.id, setIndex);
    if (!set || !set.count) { this.setData({ error: true }); return; }
    const currentIndex = options.index !== undefined
      ? Math.min(Math.max(Number(options.index) || 0, 0), set.count - 1)
      : getReadingIndex(topic.id, setIndex, set.count);
    wx.setNavigationBarTitle({ title: `${topic.name}学习` });
    const now = Date.now();
    this.setData({
      currentIndex, swiperCurrent: currentIndex, topic, module: getModuleById(topic.moduleId),
      setName: set.name, setIndex, total: set.count,
      learningItems: set.items.map((item) => ({
        ...item, ...engine.getKnowledgeView(item.id, now), revealed: false,
        hasSeparateDetail: normalizeLearningText(item.detail) !== normalizeLearningText(item.summary)
      }))
    });
    this.refreshAction();
    this.setData({ showCompletion: this.data.groupComplete && options.index === undefined });
    this.savePosition(currentIndex);
  },
  onShow() { if (this.data.topic) this.refreshAction(); },
  onUnload() { if (this.advanceTimer) clearTimeout(this.advanceTimer); },
  refreshAction() {
    const now = Date.now();
    const action = engine.groupAction(this.data.topic.id, this.data.setIndex, now, false);
    this.setData({
      groupAction: action, groupComplete: action.completed,
      progressPercent: Number((action.learnedCount * 100 / this.data.total).toFixed(1)),
      learningItems: this.data.learningItems.map((item) => ({ ...item, ...engine.getKnowledgeView(item.id, now) }))
    });
  },
  savePosition(index) {
    const { topic, setIndex, total } = this.data;
    markGroupProgress(topic.id, setIndex, index, total);
    saveReadingPosition(topic.id, setIndex, index);
  },
  goToIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.data.total) return;
    this.setData({ currentIndex: index, swiperCurrent: index, showCompletion: false });
    this.savePosition(index);
  },
  onReveal(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.saving || index !== this.data.currentIndex || !this.data.learningItems[index]) return;
    this.setData({ [`learningItems[${index}].revealed`]: true });
  },
  onRate(event) {
    const { index, value } = event.currentTarget.dataset;
    const currentIndex = Number(index);
    if (this.data.saving || this.data.confirming || currentIndex !== this.data.currentIndex || !RATINGS.includes(value)) return;
    const item = this.data.learningItems[currentIndex];
    if (!item || item.excluded) return;
    engine.learn(item.id, value);
    this.refreshAction();
    this.advanceAfterRating();
  },
  advanceAfterRating() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      const nextIndex = this.data.currentIndex + 1;
      if (nextIndex < this.data.total) this.goToIndex(nextIndex);
      else {
        const pendingIndex = this.data.learningItems.findIndex((item) => !item.learned);
        if (pendingIndex >= 0) this.goToIndex(pendingIndex);
        else this.setData({ showCompletion: true });
      }
      this.setData({ saving: false });
    }, 220);
  },
  onSwiperChange(event) {
    // Reading position is independent of learning; navigation never records a rating.
    if (event.detail.source && event.detail.source !== 'touch') return;
    if (!this.data.saving && !this.data.confirming) this.goToIndex(Number(event.detail.current));
  },
  onRestart() {
    this.setData({ learningItems: this.data.learningItems.map((item) => ({ ...item, revealed: false })) });
    this.goToIndex(0);
  },
  onAction() { engine.navigateAction(this.data.groupAction); },
  onFamiliar(event) {
    if (this.data.saving || this.data.confirming) return;
    const item = this.data.learningItems[this.data.currentIndex];
    const tappedIndex = event && event.currentTarget && event.currentTarget.dataset.index;
    if (!item || (tappedIndex !== undefined && Number(tappedIndex) !== this.data.currentIndex)) return;
    this.setData({ confirming: true });
    wx.showModal({
      title: item.excluded ? '取消熟知？' : '标记为熟知？',
      content: item.excluded ? '取消后，这条知识将根据记忆情况重新安排复习。' : '标记后，这条知识将不再出现在自动复习中。以后可点击星标取消熟知。',
      confirmText: '确定', cancelText: '取消', confirmColor: '#4D785B',
      success: ({ confirm }) => {
        this.setData({ confirming: false });
        if (!confirm || this.data.learningItems[this.data.currentIndex].id !== item.id) return;
        engine.setFamiliar(item.id, !item.excluded);
        this.refreshAction();
        if (!item.excluded) this.advanceAfterRating();
      },
      complete: () => this.setData({ confirming: false })
    });
  },
  onPracticeSet() { engine.practiceGroup(this.data.topic.id, this.data.setIndex); },
  onBackGroups() { wx.redirectTo({ url: `/pages/group/index?topicId=${this.data.topic.id}` }); },
  onGoStudy() { wx.switchTab({ url: "/pages/study/index" }); }
});
