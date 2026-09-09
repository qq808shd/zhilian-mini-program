const api = require('../../utils/groupApi');
Page({
  data: { items: [], nextCursor: '', loaded: false, busy: false, error: '' },
  onLoad() { this.load(); },
  async load() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { const d = await api.read('/history' + (this.data.nextCursor ? '?before=' + this.data.nextCursor : ''));
      const labels = { voluntary_exit: '主动退出', system_offseat: '系统离席', group_archived: '小组结束' };
      this.setData({ items: this.data.items.concat(d.items.map(m => ({ ...m, endText: labels[m.endReason] || '契约结束' }))), nextCursor: d.nextCursor, loaded: true });
    } catch (e) { this.setData({ error: api.errorText(e) }); }
    finally { this.setData({ busy: false }); }
  },
  onGroup() { wx.switchTab({ url: '/pages/study-group/index' }); }
});
