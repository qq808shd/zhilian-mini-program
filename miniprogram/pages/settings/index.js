const { getSyncView } = require("../../utils/accountView");
const { deleteProfile } = require("../../utils/profile");
const { clearQuestionStats, getQuestionStats } = require("../../utils/storage");
const { openPrivacyContract } = require("../../utils/productActions");
const { openLegal } = require("../../utils/accountNavigation");
Page({
  data: { sync: {}, hasAnswers: false },
  onShow() { this.refresh(); },
  refresh() { this.setData({ sync: getSyncView(), hasAnswers: Object.keys(getQuestionStats()).length > 0 }); },
  onOpen(event) { wx.navigateTo({ url: "/pages/" + event.currentTarget.dataset.page + "/index" }); },
  onLegal: openLegal, onPrivacy: openPrivacyContract,
  onClear() {
    if (!this.data.hasAnswers) { wx.showToast({ title: "暂无答题记录", icon: "none" }); return; }
    wx.showModal({ title: "清空答题记录？", content: "作答统计和错题将清空，学习进度保留。若开启同步，清空指令也会同步到云端；未开启时会保留指令，恢复同步后处理。此操作不可恢复。", confirmText: "确认清空", confirmColor: "#AD5146",
      success: (result) => { if (result.confirm) {
        try { clearQuestionStats(); this.refresh(); wx.showToast({ title: "答题记录已清空", icon: "success" }); }
        catch (_) { wx.showToast({ title: "清空失败，请重试", icon: "none" }); }
      } } });
  },
  onDeleteProfile() {
    wx.showModal({ title: "删除本机个人资料？", content: "只删除此设备的头像和昵称，恢复默认资料。不会删除学习进度、答题记录或云端学习数据。", confirmText: "删除资料", confirmColor: "#AD5146",
      success(result) { if (result.confirm) {
        try { deleteProfile(); wx.showToast({ title: "已恢复默认资料", icon: "success" }); }
        catch (_) { wx.showToast({ title: "删除失败，请重试", icon: "none" }); }
      } } });
  }
});
