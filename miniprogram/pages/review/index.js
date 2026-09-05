const { modules } = require("../../data/content");
const { getQuestionStats, setExamRequest } = require("../../utils/storage");
const { getLearningOverview, summarize } = require("../../utils/learningView");
Page({
  data: { summary: {}, moduleStats: [], weakTopics: [] },
  onShow() { this.refreshStats(); },
  refreshStats() {
    const records = Object.values(getQuestionStats());
    const view = getLearningOverview();
    this.setData({ summary: view.summary, weakTopics: view.weakTopics.slice(0, 3),
      moduleStats: modules.map((module) => {
        const stats = summarize(records.filter((record) => record.moduleId === module.id));
        return { ...module, ...stats, meta: stats.attempts ? `累计正确率 ${stats.accuracy}% · 作答 ${stats.attempts} 次` : "尚未练习，从一个专项开始",
          badge: stats.activeWrongCount ? `${stats.activeWrongCount} 道待复习` : stats.attempts ? "当前没有待复习错题" : "" };
      }) });
  },
  onOpenModule(event) { wx.navigateTo({ url: `/pages/review-topic/index?moduleId=${event.currentTarget.dataset.id}` }); },
  onOpenTopic(event) { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${event.currentTarget.dataset.id}` }); },
  onPractice() { wx.switchTab({ url: "/pages/exam/index" }); },
  onStartWrong() { setExamRequest({ mode: "wrong" }); wx.switchTab({ url: "/pages/exam/index" }); },
  onClearStats() { wx.navigateTo({ url: "/pages/settings/index" }); }
});
