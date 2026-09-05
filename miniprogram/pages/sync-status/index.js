const { getSyncView } = require("../../utils/accountView");
const { syncCloudData, stopCloudSync } = require("../../utils/cloudSync");
const { hasCurrentConsent, enableSyncPreference, isPublicationReady } = require("../../utils/account");
Page({
  data: { sync: {}, busy: false, draft: false },
  onShow() { this.refresh(); this.timer = setInterval(() => this.refresh(), 1500); },
  onHide() { clearInterval(this.timer); }, onUnload() { clearInterval(this.timer); },
  refresh() { this.setData({ sync: getSyncView(), draft: !isPublicationReady() }); },
  async onSync() {
    if (this.data.busy) return;
    if (!hasCurrentConsent()) { wx.navigateTo({ url: "/pages/welcome/index?enable=1" }); return; }
    this.setData({ busy: true });
    try { enableSyncPreference(); await syncCloudData(); this.refresh(); }
    catch (error) { wx.showToast({ title: error.message || "请重试", icon: "none" }); }
    finally { this.setData({ busy: false }); }
  },
  onStop() {
    wx.showModal({ title: "停止学习数据同步？", content: "此后停止登录、上传与自动重试。本机和已有云端记录都会保留，已发出的请求无法撤回。可以随时重新开启。", confirmText: "停止同步", success: (result) => {
      if (result.confirm) { try { stopCloudSync(); this.refresh(); } catch (_) { wx.showToast({ title: "停止失败，请重试", icon: "none" }); } }
    } });
  }
});
