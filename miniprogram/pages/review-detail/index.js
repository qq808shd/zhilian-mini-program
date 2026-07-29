const {
  questions,
  getTopicById,
  getModuleById,
  getKnowledgeById
} = require("../../data/content");
const { getQuestionStats, setExamRequest } = require("../../utils/storage");

Page({
  data: {
    topic: null,
    module: null,
    summary: { attempts: 0, accuracy: 0, activeWrongCount: 0 },
    ranked: []
  },

  onLoad(options) {
    const topic = getTopicById(options.topicId);
    if (!topic) return;

    const module = getModuleById(topic.moduleId);
    const stats = getQuestionStats();
    const source = questions.filter((question) => question.topicId === topic.id);
    const answeredQuestions = source
      .map((question) => ({ question, record: stats[question.id] }))
      .filter((item) => item.record);
    const records = answeredQuestions.map((item) => item.record);
    const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
    const correct = records.reduce((sum, item) => sum + item.correct, 0);
    const grouped = {};

    answeredQuestions.forEach(({ question, record }) => {
      if (!record.activeWrong) return;
      const key = question.knowledgeId || question.id;
      if (!grouped[key]) {
        const knowledge = getKnowledgeById(question.knowledgeId);
        grouped[key] = {
          id: key,
          knowledgeId: question.knowledgeId,
          title: knowledge ? knowledge.title : question.stem,
          wrong: 0,
          attempts: 0,
          activeWrongCount: 0
        };
      }
      grouped[key].wrong += record.wrong;
      grouped[key].attempts += record.attempts;
      grouped[key].activeWrongCount += 1;
    });

    const ranked = Object.values(grouped)
      .map((item) => ({
        ...item,
        errorRate: item.attempts
          ? Number(((item.wrong / item.attempts) * 100).toFixed(1))
          : 0
      }))
      .sort((a, b) => b.wrong - a.wrong || b.errorRate - a.errorRate)
      .slice(0, 5);

    wx.setNavigationBarTitle({ title: `${topic.name}错题` });
    this.setData({
      topic,
      module,
      summary: {
        attempts,
        accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
        activeWrongCount: records.filter((item) => item.activeWrong).length
      },
      ranked
    });
  },

  onOpenKnowledge(event) {
    wx.navigateTo({
      url: `/pages/detail/index?id=${event.currentTarget.dataset.id}`
    });
  },

  onStartWrongExam() {
    if (!this.data.summary.activeWrongCount) {
      wx.showToast({ title: "这个分类暂时没有待复习错题", icon: "none" });
      return;
    }
    setExamRequest({ mode: "wrong", topicId: this.data.topic.id });
    wx.switchTab({ url: "/pages/exam/index" });
  }
});
