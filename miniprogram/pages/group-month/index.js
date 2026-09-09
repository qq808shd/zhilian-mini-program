const api = require('../../utils/groupApi');
const view = require('../../utils/groupView');
Page({
  data: { result: null, busy: false, error: '', month: '', minMonth: '', maxMonth: '' },
  onLoad() { this.load(); },
  async load() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const d = await api.read('/month' + (this.data.month ? '?month=' + this.data.month : ''));
      this.setData({ result: { ...d, summary: view.summary(d.summary, d.group), members: d.members.map(m => ({ ...m, avatarPath: '/assets/groups/avatar-' + m.avatar + '.svg', rateText: m.rate === null ? '—' : m.rate + '%', statusText: m.status === 'formal' ? '正式席' : m.status === 'observer' ? '旁听席' : '已离席' })) },
        month: d.month, maxMonth: this.data.maxMonth || d.month, minMonth: require('../../utils/groupRules').dateKey(d.group.created_at).slice(0, 7) });
    } catch (e) { this.setData({ error: api.errorText(e) }); }
    finally { this.setData({ busy: false }); }
  },
  onMonth(e) { this.setData({ month: e.detail.value }); this.load(); }
});
