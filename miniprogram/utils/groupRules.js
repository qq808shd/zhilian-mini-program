// 小组独立规则；禁止引用学习引擎、题库或答题统计。
const RULES = Object.freeze({ version: 1, maxMembers: 8, weeklyDayOffLimit: 1, weeklyMissToObserver: 2,
  recoveryDays: 3, timezone: 'Asia/Shanghai', maxMinutes: 1440, maxQuantity: 100000, nameMax: 20, topicMax: 40, nicknameMax: 12 });
const UNITS = ['题', '个', '页', '节', '套'];
const DAY = 86400000;
function dateKey(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
function shiftDate(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10); }
function weekKey(date) { const day = new Date(date + 'T00:00:00Z').getUTCDay(); return shiftDate(date, -(day || 7) + 1); }
function validDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && shiftDate(date, 0) === date; }
function maxValue(type) { return type === 'duration' ? RULES.maxMinutes : RULES.maxQuantity; }
function contractLines() { return [
  `每人同时一份契约；正式席与旁听席合计最多 ${RULES.maxMembers} 人。`,
  '学习在哪里进行都可以，全部由你主动记录，小组不会读取知练学习或答题数据。',
  '加入当天不考核，次日开始。每日学习底线创建后锁定。',
  `北京时间周一至周日，每周可自行请假 ${RULES.weeklyDayOffLimit} 次；仅限当天，确认后不可取消。请假仍可记录学习。`,
  `已履约增加连续守约，请假保留连续守约；未履约归零。同周首次未履约黄牌，第 ${RULES.weeklyMissToObserver} 次红牌并进入旁听席。`,
  `旁听次日起连续 ${RULES.recoveryDays} 个自然日达标，下一日恢复正式席；任何一天未达标则系统离席。旁听占席位且不能请假。`,
  '记录只可当天新增或修正，跨日锁定。每日结算后生成黄牌、红牌与回归结果。',
  '主动退出同周重入原组，未履约与请假用量保留；旁听退出重入仍旁听，挑战从零开始。系统离席后可开启新契约。',
  '组内称呼、今日记录、连续守约、请假和处罚状态对当前同组成员可见。所有人均可邀请，发起人没有管理特权。',
  '最后一人离席后小组归档、邀请码失效；每一轮契约历史保留。'
]; }
// 纯日结状态机。调用方按日顺序、事务持久化；不读取时钟与数据库。
function settleDay(member, record, group, date) {
  const m = { ...member }, week = weekKey(date), events = [];
  if (m.week_key !== week && m.status === 'formal') { m.week_key = week; m.weekly_miss = 0; }
  const role = m.status;
  let state, card = '';
  if (date < m.evaluation_start_date) state = 'joined';
  else if (role === 'observer') {
    if (record.total_value >= group.baseline_value) {
      m.observer_progress += 1; state = 'observer_met'; events.push('observer_progress');
      if (m.observer_progress >= RULES.recoveryDays) {
        m.status = 'formal'; m.weekly_miss = 0; m.week_key = weekKey(shiftDate(date, 1));
        m.recovered_on = shiftDate(date, 1); events.push('recovered');
      }
    } else { state = 'observer_missed'; m.status = 'ended'; m.end_reason = 'system_offseat'; m.end_status = 'observer'; m.streak = 0; events.push('system_offseat'); }
  } else if (record.is_day_off) { state = 'day_off'; }
  else if (record.total_value >= group.baseline_value) {
    state = 'fulfilled'; m.streak += 1; m.longest_streak = Math.max(m.longest_streak, m.streak); events.push('fulfilled');
  } else {
    state = 'unfulfilled'; m.streak = 0; m.weekly_miss += 1;
    card = m.weekly_miss >= RULES.weeklyMissToObserver ? 'red' : 'yellow'; events.push(card + '_card');
    if (card === 'red') { m.status = 'observer'; m.observer_progress = 0; events.push('entered_observer'); }
  }
  m.last_settled_date = date;
  return { member: m, record: { ...record, seat: role, daily_state: state, card_result: card, settled: 1 }, events };
}
module.exports = { RULES, UNITS, dateKey, shiftDate, weekKey, validDate, maxValue, contractLines, settleDay };
