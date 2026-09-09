const api = require('../../utils/groupApi');
const { RULES } = require('../../utils/groupRules');
Page({
  data: { code: '', nickname: '', accepted: false, preview: null, busy: false, error: '', errorCode: '', rules: RULES },
  onLoad(options = {}) { if (options.code) { this.setData({ code: String(options.code).toUpperCase() }); this.onPreview(); } },
  onCode(e) { this.pending = null; this.setData({ code: e.detail.value.trim().toUpperCase(), preview: null, accepted: false, error: '', errorCode: '' }); },
  onNickname(e) { this.pending = null; this.setData({ nickname: e.detail.value }); },
  onAgree(e) { this.setData({ accepted: e.detail.value.includes('accept') }); },
  async onPreview() {
    if (this.data.busy) return;
    if (!/^[A-Z2-9]{6}$/.test(this.data.code)) { this.setData({ error: '请输入 6 位邀请码。', errorCode: 'INVITE_INVALID' }); return; }
    this.setData({ busy: true, error: '', errorCode: '', preview: null });
    try { const preview = await api.read('/preview?code=' + encodeURIComponent(this.data.code)); this.setData({ preview, accepted: false }); }
    catch (e) { this.setData({ error: api.errorText(e), errorCode: e.code || 'NETWORK' }); }
    finally { this.setData({ busy: false }); }
  },
  async onJoin() {
    if (this.data.busy || !this.data.preview) return;
    if (!this.data.accepted || !this.data.nickname.trim()) { this.setData({ error: '请填写组内称呼，并接受学习契约。' }); return; }
    this.setData({ busy: true, error: '' });
    if (!this.pending) this.pending = { requestId: api.requestId(), code: this.data.code, nickname: this.data.nickname, accepted: true };
    try { await api.write('/join', this.pending); this.pending = null; wx.switchTab({ url: '/pages/study-group/index' }); }
    catch (e) { if (e.statusCode) this.pending = null; this.setData({ error: api.errorText(e), errorCode: e.code || 'NETWORK' }); }
    finally { this.setData({ busy: false }); }
  },
  onCurrent() { wx.switchTab({ url: '/pages/study-group/index' }); }
});
