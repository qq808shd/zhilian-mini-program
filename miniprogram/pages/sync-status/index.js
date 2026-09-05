const { getSyncView } = require("../../utils/accountView");
const { syncCloudData } = require("../../utils/cloudSync");
const { isSyncAuthorized, isPublicationReady } = require("../../utils/account");
Page({
  data: { sync: {}, busy: false, draft: false },
  onShow() { this.refresh(); this.timer = setInterval(() => this.refresh(), 1500); },
  onHide() { clearInterval(this.timer); }, onUnload() { clearInterval(this.timer); },
  refresh() { this.setData({ sync: getSyncView(), draft: !isPublicationReady() }); },
  async onSync() {
    if (this.data.busy || this.data.sync.state === "syncing") return;
    if (!isSyncAuthorized()) { wx.navigateTo({ url: "/pages/welcome/index?consent=1" }); return; }
    this.setData({ busy: true });
    try { await syncCloudData(); this.refresh(); }
    catch (error) { wx.showToast({ title: error.message || "请重试", icon: "none" }); }
    finally { this.setData({ busy: false }); }
  }
});
