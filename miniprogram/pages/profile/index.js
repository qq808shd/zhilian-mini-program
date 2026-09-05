const { getProfile, saveProfile, normalizeNickname, DEFAULT_AVATAR } = require("../../utils/profile");
const { finishOnboarding } = require("../../utils/accountNavigation");
Page({
  data: { avatar: DEFAULT_AVATAR, nickname: "", onboarding: false, saving: false, error: "", reviewPending: false, supported: true },
  onLoad(options) {
    const saved = getProfile();
    this.savedNickname = saved.nickname === "知练同学" && !saved.customized ? "" : saved.nickname;
    this.approvedNickname = this.savedNickname;
    this.canReview = !!(wx.canIUse && wx.canIUse("input.bindnicknamereview"));
    this.setData({ avatar: saved.avatar, nickname: this.savedNickname, onboarding: options.onboarding === "1",
      supported: !!(wx.canIUse && wx.canIUse("button.open-type.chooseAvatar") && wx.canIUse("input.type.nickname")) });
  },
  onUnload() { clearTimeout(this.reviewTimer); this.pendingProfile = null; },
  onChooseAvatar(event) { if (event.detail.avatarUrl) this.setData({ avatar: event.detail.avatarUrl, error: "" }); },
  onNicknameInput(event) {
    const nickname = event.detail.value;
    this.setData({ nickname, error: "", reviewPending: this.canReview && normalizeNickname(nickname) !== this.approvedNickname });
  },
  onNicknameBlur(event) {
    this.reviewCandidate = normalizeNickname(event.detail.value);
    this.setData({ nickname: event.detail.value });
    if (!this.canReview) this.approvedNickname = this.reviewCandidate;
  },
  onNicknameReview(event) {
    const candidate = this.reviewCandidate;
    if (candidate !== normalizeNickname(this.data.nickname)) return;
    clearTimeout(this.reviewTimer);
    if (event.detail.pass) {
      this.approvedNickname = candidate; this.setData({ reviewPending: false, error: "" });
      if (this.pendingProfile && this.pendingProfile.nickname === candidate) {
        const profile = this.pendingProfile; this.pendingProfile = null; this.commitProfile(profile);
      }
    } else {
      this.pendingProfile = null;
      this.setData({ reviewPending: false, saving: false, error: "这个昵称未通过微信校验，请换一个" }); this.approvedNickname = null;
    }
  },
  onAvatarError() { this.setData({ avatar: DEFAULT_AVATAR }); },
  async onSave(event) {
    if (this.data.saving) return;
    const nickname = normalizeNickname(event.detail.value.nickname);
    if (nickname && this.canReview && nickname !== this.approvedNickname) {
      this.pendingProfile = { nickname, avatar: this.data.avatar };
      this.setData({ saving: true, reviewPending: true, error: "" });
      if (wx.hideKeyboard) wx.hideKeyboard();
      this.reviewTimer = setTimeout(() => {
        this.pendingProfile = null; this.setData({ saving: false, reviewPending: false, error: "昵称校验暂未完成，请重试" });
      }, 8000);
      return;
    }
    if (nickname && !this.canReview && nickname !== this.savedNickname) {
      this.setData({ error: "当前微信不支持昵称校验，请更新微信或先跳过" }); return;
    }
    await this.commitProfile({ nickname, avatar: this.data.avatar });
  },
  async commitProfile(profile) {
    this.setData({ saving: true, error: "" });
    try {
      await saveProfile(profile);
      if (this.data.onboarding) finishOnboarding();
      else { wx.showToast({ title: "资料已保存", icon: "success" }); wx.navigateBack(); }
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  },
  onSkip() { if (!this.data.saving) { if (this.data.onboarding) finishOnboarding(); else wx.navigateBack(); } }
});
