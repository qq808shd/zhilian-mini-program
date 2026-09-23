const { getProfile, saveProfile, normalizeNickname, DEFAULT_AVATAR } = require("../../utils/profile");
const { finishOnboarding } = require("../../utils/accountNavigation");
Page({
  data: { avatar: DEFAULT_AVATAR, nickname: "", onboarding: false, saving: false, error: "", reviewPending: false, supported: true, nicknameFocus: false, complete: false },
  onLoad(options) {
    const saved = getProfile();
    this.savedNickname = saved.nickname === "知练同学" && !saved.customized ? "" : saved.nickname;
    this.approvedNickname = this.savedNickname;
    this.canReview = !!(wx.canIUse && wx.canIUse("input.bindnicknamereview"));
    this.setData({ avatar: saved.avatar, nickname: this.savedNickname, onboarding: options.onboarding === "1",
      supported: !!(wx.canIUse && wx.canIUse("button.open-type.chooseAvatar") && wx.canIUse("input.type.nickname")) });
  },
  async onShow() {
    try {
      this.remoteProfile = await require('../../utils/profileSync').restore();
      if (this.remoteProfile && !this.edited && this.remoteProfile.revision) {
        const p = getProfile(); this.savedNickname = p.nickname; this.approvedNickname = p.nickname;
        this.setData({ avatar: p.avatar, nickname: p.nickname });
      }
      this.updateComplete();
    } catch (e) { this.setData({ error: e.message }); }
  },
  updateComplete() {
    const name = normalizeNickname(this.data.nickname);
    this.setData({ complete: this.data.avatar !== DEFAULT_AVATAR && !!this.data.avatar && !!name && Array.from(name).length <= 24 && !/[\u0000-\u001f\u007f]/.test(name) && !this.data.reviewPending && (!this.canReview || name === this.approvedNickname) });
  },
  onUnload() { clearTimeout(this.reviewTimer); },
  onChooseAvatar(event) { if (event.detail.avatarUrl) { this.edited = true; this.setData({ avatar: event.detail.avatarUrl, error: "", nicknameFocus: false }); this.updateComplete(); wx.nextTick(() => this.setData({ nicknameFocus: true })); } },
  onNicknameInput(event) {
    this.edited = true;
    clearTimeout(this.reviewTimer);
    const nickname = event.detail.value;
    this.setData({ nickname, error: "", reviewPending: this.canReview && normalizeNickname(nickname) !== this.approvedNickname });
    this.updateComplete();
  },
  onNicknameFocus() { this.setData({ nicknameFocus: true }); },
  onNicknameBlur(event) {
    this.reviewCandidate = normalizeNickname(event.detail.value);
    if (this.reviewCandidate !== this.savedNickname) this.edited = true;
    this.setData({ nickname: event.detail.value, nicknameFocus: false, error: "",
      reviewPending: this.canReview && this.reviewCandidate !== this.approvedNickname });
    if (!this.canReview) this.approvedNickname = this.reviewCandidate;
    clearTimeout(this.reviewTimer);
    if (this.data.reviewPending) {
      const candidate = this.reviewCandidate;
      this.reviewTimer = setTimeout(() => {
        if (candidate !== normalizeNickname(this.data.nickname) || !this.data.reviewPending) return;
        this.approvedNickname = null;
        this.setData({ reviewPending: false, error: "微信未返回昵称校验结果，请重试或换一个表情、昵称" });
        this.updateComplete();
      }, 8000);
    }
    this.updateComplete();
  },
  onNicknameReview(event) {
    const candidate = this.reviewCandidate;
    if (candidate !== normalizeNickname(this.data.nickname)) return;
    clearTimeout(this.reviewTimer);
    if (event.detail.pass) {
      this.approvedNickname = candidate; this.setData({ reviewPending: false, error: "" });
      this.updateComplete();
    } else {
      const error = event.detail.timeout ? "微信昵称校验超时，请稍后重试" : "昵称未通过微信校验；若含表情，请换一个表情或昵称";
      this.setData({ reviewPending: false, error }); this.approvedNickname = null; this.updateComplete();
    }
  },
  onAvatarError() { this.setData({ avatar: DEFAULT_AVATAR }); this.updateComplete(); },
  async onSave(event) {
    if (this.data.saving) return;
    const submitted = event && event.detail && event.detail.value && event.detail.value.nickname;
    const nickname = normalizeNickname(typeof submitted === "string" ? submitted : this.data.nickname);
    if (!this.data.avatar || this.data.avatar === DEFAULT_AVATAR) { this.setData({ error: "请先选择头像" }); return; }
    if (!nickname) { this.setData({ error: "请输入昵称" }); return; }
    if (Array.from(nickname).length > 24) { this.setData({ error: "昵称最多 24 个字符，表情也计入长度" }); return; }
    if (/[\u0000-\u001f\u007f]/.test(nickname)) { this.setData({ error: "昵称含有不支持的字符，请修改" }); return; }
    if (nickname && this.canReview && nickname !== this.approvedNickname) {
      this.setData({ error: this.data.reviewPending ? "昵称正在微信校验，请收起键盘稍候" : "昵称未通过微信校验，请更换表情或昵称" });
      if (this.data.reviewPending && wx.hideKeyboard) wx.hideKeyboard();
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
      this.remoteProfile = await require('../../utils/profileSync').save(this.remoteProfile);
      if (this.data.onboarding) finishOnboarding();
      else { wx.showToast({ title: "资料已保存", icon: "success" }); wx.navigateBack(); }
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  },
  onSkip() { if (!this.data.saving) { if (this.data.onboarding) finishOnboarding(); else wx.navigateBack(); } }
});
