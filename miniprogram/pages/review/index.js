const engine = require("../../utils/learningEngine");
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
        const topics = view.topics.filter((t) => t.moduleId === module.id);
        const due = topics.reduce((n,t) => n + t.dueCount, 0);
        stats.activeWrongCount = topics.reduce((n,t) => n + t.consolidatingCount, 0);
        return { ...module, ...stats, meta: `到期 ${due} 项 · 待巩固 ${stats.activeWrongCount} 项`,
          badge: stats.activeWrongCount ? `${stats.activeWrongCount} 项待巩固` : stats.attempts ? "当前没有待复习错题" : "" };
      }) });
  },
  onOpenModule(event) { wx.navigateTo({ url: `/pages/review-topic/index?moduleId=${event.currentTarget.dataset.id}` }); },
  onOpenTopic(event) { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${event.currentTarget.dataset.id}` }); },
  onPractice() { wx.switchTab({ url: "/pages/exam/index" }); },
  onStartWrong() { wx.navigateTo({ url: "/pages/today-study/index" }); },
  onClearStats() { wx.navigateTo({ url: "/pages/settings/index" }); }
});
