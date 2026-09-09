const { RULES } = require('./groupRules');
const STATES = {
  fulfilled: ['已履约', '✓', 'success'], pending: ['未完成', '○', 'neutral'], day_off: ['请假', '休', 'leave'],
  joined: ['今日加入', '+', 'neutral'], observer: ['旁听', '听', 'observer'], observer_met: ['旁听 · 达标', '回', 'observer'],
  observer_missed: ['系统离席', '离', 'danger'], unfulfilled: ['未履约', '×', 'warning'],
  exited: ['已离席', '—', 'neutral'], none: ['无考核', '·', 'empty']
};
function status(item) {
  const [label, symbol, tone] = STATES[item.state] || STATES.none;
  return { ...item, label: item.card === 'red' ? '红牌' : item.card === 'yellow' ? '黄牌' : label,
    symbol: item.card === 'red' || item.card === 'yellow' ? '!' : symbol,
    tone: item.card === 'red' ? 'danger' : item.card === 'yellow' ? 'warning' : tone };
}
function number(value) { return Number(value || 0).toLocaleString('en-US'); }
function summary(value, group) {
  return { ...value, displayValue: group.baseline_type === 'duration' ? number(Math.round(value.totalValue / 60 * 10) / 10) : number(value.totalValue),
    unit: group.baseline_type === 'duration' ? '小时' : group.baseline_unit, rateText: value.rate === null ? '—' : value.rate + '%' };
}
function member(value) {
  return { ...value, avatarPath: '/assets/groups/avatar-' + value.avatar + '.svg', today: status(value.today),
    week: (value.week || []).map(status), statusText: value.status === 'observer' ? '旁听席' : value.status === 'ended' ? '已离席' : '正式席' };
}
function dashboard(data) {
  if (!data.group) return { ...data, ready: true };
  const me = member(data.me), g = data.group, rules = data.rules || RULES;
  let title = '今日学习', hint = `还差 ${Math.max(0, g.baseline_value - me.today.value)} ${g.baseline_unit}守住今日学习底线`;
  if (me.today.state === 'fulfilled') { title = '今日已履约'; hint = '今天的学习底线已守住，记录仍可继续。'; }
  if (me.today.state === 'day_off') { title = '今日请假'; hint = me.today.value ? `今天仍学习了 ${me.today.value} ${g.baseline_unit}` : '给自己留一点空间，明天继续。'; }
  if (me.status === 'observer') { title = '当前处于旁听席'; hint = `回归挑战 ${me.recovery} / ${rules.recoveryDays} · 连续达标后回到正式席`; }
  if (me.today.state === 'joined') { title = me.status === 'observer' ? '今日加入 · 旁听席' : '今日加入'; hint = me.status === 'observer' ? '原旁听状态已保留，回归挑战从明天重新开始。' : '正式学习契约将从明天开始。'; }
  return { ...data, ready: true, me, members: data.members.map(member), cardTitle: title, cardHint: hint,
    progress: me.today.value >= g.baseline_value ? 100 : Math.floor(me.today.value / g.baseline_value * 100),
    canLeave: me.status === 'formal' && me.today.state !== 'joined' && me.today.state !== 'day_off' && me.leaveRemaining > 0,
    month: summary(data.month, g), week: summary(data.week, g) };
}
module.exports = { dashboard, member, summary, status, number };
