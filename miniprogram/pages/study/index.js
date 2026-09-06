const engine = require("../../utils/learningEngine");
Page({
  data: { daily: {}, greeting: "" },
  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.refresh(); this.refresh(); },
  refresh() {
    const hour = new Date().getHours();
    this.setData({ greeting: hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好", daily: engine.dailyView() });
  },
  onToday() { wx.navigateTo({ url: "/pages/today-study/index" }); },
  onSettings() { wx.navigateTo({ url: "/pages/study-settings/index" }); },
  onFreeStudy() { wx.navigateTo({ url: "/pages/free-study/index" }); }
});
