const api = require('../../utils/groupApi');
const view = require('../../utils/groupView');
const { RULES, maxValue } = require('../../utils/groupRules');
Page({
  data: { ready: false, group: null, loading: false, error: '', sheet: '', input: '', busy: false, sheetError: '', recordMode: 'add', weekdays: ['一','二','三','四','五','六','日'], rules: RULES },
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) { bar.refresh(); bar.setData({ hidden: !!this.data.sheet }); } this.load(); },
  onHide() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setData({ hidden: false }); },
  onUnload() { this.disposed = true; this.onHide(); },
  showSheet(values) { this.setData(values); const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setData({ hidden: !!values.sheet }); },
  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try { const data = await api.read(); if (!this.disposed) this.setData({ ...view.dashboard(data), loading: false }); }
    catch (error) { if (!this.disposed) this.setData({ error: api.errorText(error), loading: false }); }
  },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh(); },
  onCreate() { wx.navigateTo({ url: '/pages/group-create/index' }); },
  onJoin() { wx.navigateTo({ url: '/pages/group-join/index' }); },
  onHistory() { wx.navigateTo({ url: '/pages/group-history/index' }); },
  onMonth() { wx.navigateTo({ url: '/pages/group-month/index' }); },
  onRules() { this.showSheet({ sheet: 'rules', sheetError: '' }); },
  onInvite() { this.showSheet({ sheet: 'invite', sheetError: '' }); },
  onMembers() { this.showSheet({ sheet: 'members', sheetError: '' }); },
  onCopy() { wx.setClipboardData({ data: this.data.group.invite_code }); },
  onShareAppMessage() { return this.data.group ? { title: '一起守住学习底线 · ' + this.data.group.name, path: '/pages/group-join/index?code=' + this.data.group.invite_code } : { title: '知练学习小组', path: '/pages/study-group/index' }; },
  closeSheet() { if (!this.data.busy) { this.showSheet({ sheet: '', sheetError: '' }); this.pending = null; } },
  noop() {},
  onRecord() { this.pending = null; this.showSheet({ sheet: 'record', sheetError: '', recordMode: 'add', input: '' }); },
  onRecordMode(e) { this.pending = null; const mode = e.currentTarget.dataset.mode; this.setData({ recordMode: mode, input: mode === 'set' ? String(this.data.me.today.value) : '', sheetError: '' }); },
  onInput(e) { this.pending = null; this.setData({ input: e.detail.value, sheetError: '' }); },
  async mutate(path, data, method = 'POST') {
    if (this.data.busy) return false;
    this.setData({ busy: true, sheetError: '' });
    if (!this.pending) this.pending = { ...data, requestId: api.requestId() };
    try { await api.write(path, this.pending, method); this.pending = null; this.showSheet({ sheet: '', busy: false }); await this.load(); return true; }
    catch (error) {
      if (error.statusCode) this.pending = null;
      this.setData({ busy: false, sheetError: api.errorText(error) });
      if (['DAY_LOCKED', 'RECORD_CHANGED', 'MEMBERSHIP_CHANGED'].includes(error.code)) { this.pending = null; await this.load(); }
      return false;
    }
  },
  onSaveRecord() {
    const value = Number(this.data.input), min = this.data.recordMode === 'set' ? 0 : 1, max = maxValue(this.data.group.baseline_type);
    if (!/^\d+$/.test(this.data.input) || !Number.isSafeInteger(value) || value < min || value > max) { this.setData({ sheetError: `请输入 ${min}～${max} 的整数` }); return; }
    return this.mutate('/today', { value, date: this.data.date, membershipId: this.data.me.id, revision: this.data.me.today.revision }, this.data.recordMode === 'set' ? 'PATCH' : 'POST');
  },
  onDayOff() {
    if (!this.data.canLeave || this.data.busy) return;
    this.pending = null;
    wx.showModal({ title: '确认今日请假？', content: '确认后不能取消，请假机会不会返还。今天仍然可以记录学习。', confirmColor: '#4D785B', success: async r => {
      if (!r.confirm) return;
      this.showSheet({ sheet: 'feedback' }); await this.mutate('/day-off', { date: this.data.date, membershipId: this.data.me.id });
    } });
  },
  onExit() {
    this.pending = null;
    wx.showModal({ title: '退出学习小组？', content: '退出后，本次连续守约记录将结束。重新加入原组仍会保留未完成的处罚状态。', confirmText: '确认退出', confirmColor: '#AD5146', success: async r => {
      if (!r.confirm) return;
      this.showSheet({ sheet: 'feedback' }); await this.mutate('/exit', { membershipId: this.data.me.id });
    } });
  },
  async onMember(e) {
    this.showSheet({ sheet: 'member', memberDetail: null, sheetError: '' });
    try { const d = await api.read('/members/' + e.currentTarget.dataset.id); if (this.data.sheet === 'member') this.setData({ memberDetail: { ...d, member: view.member(d.member), week: view.summary(d.week, d.group), month: view.summary(d.month, d.group) } }); }
    catch (e) { this.setData({ sheetError: api.errorText(e) }); }
  }
});
