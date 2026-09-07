const engine = require("../../utils/learningEngine");
const {
  questions,
  getModuleName,
  getTopicName,
  getKnowledgeById
} = require("../../data/content");
const { setExamRequest } = require("../../utils/storage");

Page({
  data: {
    item: null,
    answerVisible: false,
    relatedCount: 0,
    learning: null,
    recallDone: false, confirming: false
  },

  onLoad(options) {
    const item = getKnowledgeById(options.id);
    if (!item) {
      wx.showToast({
        title: "知识内容不存在",
        icon: "none"
      });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData({
      recallMode: options.recall === "1",
      answerVisible: false,
      recallDone: false,
      learning: engine.getKnowledgeView(item.id),
      item: {
        ...item,
        moduleName: getModuleName(item.moduleId),
        topicName: getTopicName(item.topicId)
      },
      relatedCount: questions.filter(
        (question) => question.knowledgeId === item.id
      ).length
    });
  },

  onShow() { if (this.data.item) this.refreshLearning(); },
  refreshLearning() { this.setData({ learning: engine.getKnowledgeView(this.data.item.id) }); },
  onRecall(event) {
    if (!this.data.item || this.data.confirming || this.data.learning.excluded) return;
    const rating = event.currentTarget.dataset.value;
    if (!["none", "fuzzy", "remembered"].includes(rating)) return;
    if (this.data.recallMode) engine.recall(this.data.item.id, rating);
    else engine.learn(this.data.item.id, rating);
    this.setData({ recallDone: true });
    this.refreshLearning();
    wx.showToast({ title: "已保存学习程度", icon: "none" });
  },
  onFamiliar() {
    if (!this.data.item || this.data.confirming) return;
    const { item, learning } = this.data;
    this.setData({ confirming: true });
    wx.showModal({
      title: learning.excluded ? '取消熟知？' : '标记为熟知？',
      content: learning.excluded ? '取消后，这条知识将根据记忆情况重新安排复习。' : '标记后，这条知识将不再出现在自动复习中。以后可点击星标取消熟知。',
      confirmText: '确定', cancelText: '取消', confirmColor: '#4D785B',
      success: ({ confirm }) => {
        this.setData({ confirming: false });
        if (!confirm || this.data.item.id !== item.id) return;
        engine.setFamiliar(item.id, !learning.excluded); this.refreshLearning();
      },
      complete: () => this.setData({ confirming: false })
    });
  },
  onToggleAnswer() {
    this.setData({
      answerVisible: !this.data.answerVisible
    });
  },

  onStartRelatedExam() {
    const relatedIds = questions
      .filter((question) => question.knowledgeId === this.data.item.id)
      .map((question) => question.id);

    if (!relatedIds.length) {
      wx.showToast({
        title: "该知识点暂时没有关联题目",
        icon: "none"
      });
      return;
    }

    setExamRequest({
      mode: "questionIds", direct: true,
      questionIds: relatedIds
    });
    wx.switchTab({
      url: "/pages/exam/index"
    });
  }
});
