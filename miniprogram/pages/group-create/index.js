const api = require('../../utils/groupApi');
const { RULES, UNITS, maxValue, contractLines } = require('../../utils/groupRules');
Page({
  data: { name: '', studyTopic: '', baselineType: 'duration', baselineValue: '60', unitIndex: 0, units: UNITS, nickname: '', accepted: false, rules: RULES, contract: contractLines(), busy: false, error: '' },
  input(e) { this.pending = null; const key = e.currentTarget.dataset.key; if (['name','studyTopic','baselineValue','nickname'].includes(key)) this.setData({ [key]: e.detail.value, error: '' }); },
  onType(e) { this.pending = null; this.setData({ baselineType: e.currentTarget.dataset.type, baselineValue: e.currentTarget.dataset.type === 'duration' ? '60' : '20' }); },
  onUnit(e) { this.pending = null; this.setData({ unitIndex: Number(e.detail.value) }); },
  onAgree(e) { this.setData({ accepted: e.detail.value.includes('accept') }); },
  async onSubmit() {
    if (this.data.busy) return;
    const d = this.data, value = Number(d.baselineValue);
    if (!d.name.trim() || !d.studyTopic.trim() || !d.nickname.trim()) { this.setData({ error: '请填写小组名称、学习内容和组内称呼。' }); return; }
    if (!/^\d+$/.test(d.baselineValue) || !Number.isSafeInteger(value) || value <= 0 || value > maxValue(d.baselineType)) { this.setData({ error: `每日学习底线须为 1～${maxValue(d.baselineType)} 的整数。` }); return; }
    if (!d.accepted) { this.setData({ error: '请先阅读并接受学习契约。' }); return; }
    this.setData({ busy: true, error: '' });
    if (!this.pending) this.pending = { requestId: api.requestId(), name: d.name, studyTopic: d.studyTopic, baselineType: d.baselineType, baselineValue: value, baselineUnit: d.baselineType === 'duration' ? '分钟' : UNITS[d.unitIndex], nickname: d.nickname, accepted: true };
    try { await api.write('', this.pending); this.pending = null; wx.switchTab({ url: '/pages/study-group/index' }); }
    catch (e) { if (e.statusCode) this.pending = null; this.setData({ error: api.errorText(e) }); }
    finally { this.setData({ busy: false }); }
  }
});
