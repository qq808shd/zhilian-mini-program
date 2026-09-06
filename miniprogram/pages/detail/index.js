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
    relatedCount: 0
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

  onRecall(event) { if (!this.data.recallMode || !this.data.answerVisible || this.data.recallDone) return; engine.recall(this.data.item.id, event.currentTarget.dataset.value); this.setData({ recallDone: true }); wx.showToast({ title: "已安排下次复习", icon: "none" }); },
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
