const { modules } = require("../../data/content");
const { getLearningOverview } = require("../../utils/learningView");
Page({
  data: { moduleCards: [], recent: [], resume: null, weakTopic: null, summary: {}, greeting: "" },
  onShow() { this.refresh(); },
  refresh() {
    const view = getLearningOverview();
    const hour = new Date().getHours();
    this.setData({ greeting: hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好",
      summary: view.summary, recent: view.recent, resume: view.recent[0] || null, weakTopic: view.weakTopics[0] || null,
      moduleCards: modules.map((module) => {
        const topics = view.topics.filter((topic) => topic.moduleId === module.id);
        const count = topics.reduce((sum, topic) => sum + topic.knowledgeCount, 0);
        const learned = topics.reduce((sum, topic) => sum + topic.learnedCount, 0);
        return { ...module, meta: `${topics.length} 个分类 · 已浏览 ${learned} / ${count} 条` };
      }) });
  },
  onResume() {
    const item = this.data.resume;
    wx.navigateTo({ url: item ? `/pages/learn/index?topicId=${item.topicId}&setIndex=${item.setIndex}` : "/pages/group/index?topicId=idiom" });
  },
  onOpenRecent(event) {
    const item = this.data.recent[event.currentTarget.dataset.index];
    wx.navigateTo({ url: `/pages/learn/index?topicId=${item.topicId}&setIndex=${item.setIndex}` });
  },
  onOpenModule(event) { wx.navigateTo({ url: `/pages/module/index?id=${event.currentTarget.dataset.id}` }); },
  onPractice() { wx.switchTab({ url: "/pages/exam/index" }); },
  onReview() { wx.switchTab({ url: "/pages/review/index" }); },
  onWeakTopic() { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${this.data.weakTopic.id}` }); }
});
