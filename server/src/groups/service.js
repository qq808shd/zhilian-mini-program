const { randomUUID, randomInt, createHash } = require('node:crypto');
const { migrate } = require('./schema');
const { RULES, UNITS, dateKey, shiftDate, weekKey, validDate, maxValue, contractLines, settleDay } = require('../../../miniprogram/utils/groupRules');
function fail(code, message, statusCode = 400) { const e = new Error(message); Object.assign(e, { code, statusCode }); throw e; }
function textField(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max || /[\x00-\x1f]/.test(value)) fail('INVALID_INPUT', `${label}须为 1～${max} 个字符`);
  return value.trim();
}
function integer(value, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_VALUE', `请输入 ${min}～${max} 的整数`); return value; }
function createGroupService(db, { now = Date.now, logger = entry => console.info(JSON.stringify(entry)) } = {}) {
  migrate(db);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  let logs = [];
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE'); logs = [];
    let result;
    try { result = work(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); logs = []; throw e; }
    const committed = logs; logs = [];
    committed.forEach(entry => { try { logger(entry); } catch (_) { /* Logging cannot turn a committed write into a failed request. */ } });
    return result;
  }
  function event(m, date, kind, at) {
    if (run('INSERT OR IGNORE INTO group_events(group_id,membership_id,business_date,kind,created_at) VALUES(?,?,?,?,?)', m.group_id, m.id, date, kind, at).changes) {
      logs.push({ scope: 'study_groups', kind, groupId: m.group_id, membershipId: m.id, date });
    }
  }
  function current(userId) { return one("SELECT * FROM group_memberships WHERE user_id=? AND status!='ended'", userId); }
  function group(id) { const g = one('SELECT * FROM study_groups WHERE id=?', id); if (!g) fail('GROUP_NOT_FOUND', '小组不存在', 404); return g; }
  function size(id) { return one("SELECT COUNT(*) AS n FROM group_memberships WHERE group_id=? AND status!='ended'", id).n; }
  function archiveIfEmpty(id, at) {
    if (!size(id) && run('UPDATE study_groups SET archived_at=? WHERE id=? AND archived_at IS NULL', at, id).changes) logs.push({ scope: 'study_groups', kind: 'group_archived', groupId: id });
  }
  function saveMember(m) {
    run(`UPDATE group_memberships SET status=?,exited_at=?,end_reason=?,end_status=?,streak=?,longest_streak=?,
      week_key=?,weekly_miss=?,leave_week=?,weekly_leave=?,observer_progress=?,recovered_on=?,last_settled_date=? WHERE id=?`,
    m.status, m.exited_at || null, m.end_reason || null, m.end_status || null, m.streak, m.longest_streak,
    m.week_key, m.weekly_miss, m.leave_week, m.weekly_leave, m.observer_progress, m.recovered_on || null, m.last_settled_date, m.id);
  }
  function ensureRecord(m, date, at) {
    run(`INSERT OR IGNORE INTO group_daily_records(membership_id,business_date,seat,created_at,updated_at)
      VALUES(?,?,?,?,?)`, m.id, date, m.status, at, at);
    return one('SELECT * FROM group_daily_records WHERE membership_id=? AND business_date=?', m.id, date);
  }
  function settleMember(id, today, at) {
    let m = one('SELECT * FROM group_memberships WHERE id=?', id);
    if (!m || m.status === 'ended') return;
    const g = group(m.group_id);
    for (let date = shiftDate(m.last_settled_date, 1); date < today && m.status !== 'ended'; date = shiftDate(date, 1)) {
      const record = ensureRecord(m, date, at);
      if (record.settled) throw new Error('Membership settlement cursor is inconsistent');
      const result = settleDay(m, record, g, date); m = result.member;
      if (m.status === 'ended') m.exited_at = Date.parse(shiftDate(date, 1) + 'T00:00:00+08:00');
      run(`UPDATE group_daily_records SET seat=?,daily_state=?,card_result=?,settled=1,settled_at=?,updated_at=?
        WHERE membership_id=? AND business_date=?`, result.record.seat, result.record.daily_state, result.record.card_result, at, at, id, date);
      saveMember(m); result.events.forEach(kind => event(m, date, kind, at));
    }
    archiveIfEmpty(g.id, at);
  }
  function catchUpGroup(id, at = now()) {
    transaction(() => all("SELECT id FROM group_memberships WHERE group_id=? AND status!='ended'", id).forEach(m => settleMember(m.id, dateKey(at), at)));
  }
  function prepareUser(userId, at = now()) { const m = current(userId); if (m) catchUpGroup(m.group_id, at); }
  function requireCurrent(userId, expectedId) {
    const m = current(userId); if (!m || (expectedId && m.id !== expectedId)) fail('MEMBERSHIP_CHANGED', '当前契约已变化，请刷新后重试', 409); return m;
  }
  function publicGroup(g) { return { id: g.id, name: g.name, study_topic: g.study_topic, baseline_type: g.baseline_type, baseline_value: g.baseline_value,
    baseline_unit: g.baseline_unit, invite_code: g.invite_code, created_at: g.created_at, archived: !!g.archived_at, count: size(g.id) }; }
  function byCode(code) {
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}$/.test(code.toUpperCase())) fail('INVITE_INVALID', '邀请码无效，请核对后再试', 404);
    const g = one('SELECT * FROM study_groups WHERE invite_code=?', code.toUpperCase());
    if (!g) fail('INVITE_INVALID', '邀请码无效，请核对后再试', 404); return g;
  }
  function carry(userId, groupId, today) {
    const previous = one('SELECT * FROM group_memberships WHERE user_id=? AND group_id=? ORDER BY joined_at DESC,rowid DESC LIMIT 1', userId, groupId);
    if (!previous || previous.end_reason !== 'voluntary_exit') return { status: 'formal', misses: 0, leaves: 0 };
    return { status: previous.end_status === 'observer' ? 'observer' : 'formal',
      misses: previous.week_key === weekKey(today) ? previous.weekly_miss : 0,
      leaves: previous.leave_week === weekKey(today) ? previous.weekly_leave : 0 };
  }
  function addMember(userId, g, data, at) {
    if (current(userId)) fail('ALREADY_IN_GROUP', '你已有进行中的学习契约，请先退出当前小组', 409);
    if (g.archived_at) fail('GROUP_ARCHIVED', '小组已归档，邀请码已失效', 410);
    if (size(g.id) >= RULES.maxMembers) fail('GROUP_FULL', '小组已满，正式席与旁听席合计最多八人', 409);
    if (data.accepted !== true) fail('CONTRACT_REQUIRED', '请先接受学习契约');
    const nickname = textField(data.nickname, RULES.nicknameMax, '组内称呼');
    const today = dateKey(at), inherited = carry(userId, g.id, today), id = randomUUID();
    run(`INSERT INTO group_memberships(id,group_id,user_id,nickname,avatar,status,joined_at,joined_date,evaluation_start_date,
      week_key,weekly_miss,leave_week,weekly_leave,last_settled_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, g.id, userId, nickname, randomInt(4), inherited.status, at, today, shiftDate(today, 1), weekKey(today), inherited.misses, weekKey(today), inherited.leaves, shiftDate(today, -1));
    const m = current(userId); ensureRecord(m, today, at); event(m, today, 'joined', at);
    return { membershipId: id, groupId: g.id };
  }
  function mutation(userId, action, data, work) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.requestId !== 'string' || !/^[a-zA-Z0-9:_-]{12,100}$/.test(data.requestId)) fail('REQUEST_ID_REQUIRED', '缺少有效操作标识，请刷新重试');
    const fingerprint = createHash('sha256').update(JSON.stringify([action, data])).digest('hex');
    return transaction(() => {
      const cached = one('SELECT * FROM group_requests WHERE user_id=? AND request_id=?', userId, data.requestId);
      if (cached) { if (cached.fingerprint !== fingerprint) fail('REQUEST_CONFLICT', '操作标识已使用，请刷新后重试', 409); return JSON.parse(cached.response); }
      const response = work();
      run('INSERT INTO group_requests VALUES(?,?,?,?,?)', userId, data.requestId, fingerprint, JSON.stringify(response), now());
      return response;
    });
  }
  function create(userId, data) {
    const at = now(); prepareUser(userId, at);
    return mutation(userId, 'create', data, () => {
      const name = textField(data.name, RULES.nameMax, '小组名称'), topic = textField(data.studyTopic, RULES.topicMax, '学习内容');
      if (!['duration', 'quantity'].includes(data.baselineType)) fail('INVALID_BASELINE', '请选择时长型或数量型');
      const value = integer(data.baselineValue, 1, maxValue(data.baselineType));
      const unit = data.baselineType === 'duration' ? '分钟' : data.baselineUnit;
      if (data.baselineType === 'quantity' && !UNITS.includes(unit)) fail('INVALID_UNIT', '请选择支持的数量单位');
      const id = randomUUID(); let code;
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (one('SELECT id FROM study_groups WHERE invite_code=?', code));
      run('INSERT INTO study_groups(id,name,study_topic,baseline_type,baseline_value,baseline_unit,invite_code,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, name, topic, data.baselineType, value, unit, code, userId, at);
      const result = addMember(userId, group(id), data, at);
      logs.push({ scope: 'study_groups', kind: 'create_group', groupId: id }); return result;
    });
  }
  function preview(userId, code) {
    const at = now(); prepareUser(userId, at); const g = byCode(code); catchUpGroup(g.id, at);
    const refreshed = group(g.id), inherited = carry(userId, g.id, dateKey(at)), mine = current(userId);
    return { group: publicGroup(refreshed), rules: RULES, contract: contractLines(), carry: inherited,
      alreadyCurrent: !!mine, sameGroup: !!mine && mine.group_id === g.id };
  }
  function join(userId, data) {
    const at = now(); prepareUser(userId, at); const g = byCode(data.code); catchUpGroup(g.id, at);
    return mutation(userId, 'join', data, () => addMember(userId, group(g.id), data, at));
  }
  function exit(userId, data) {
    const at = now(); prepareUser(userId, at);
    return mutation(userId, 'exit', data, () => {
      if (!data.membershipId) fail('MEMBERSHIP_REQUIRED', '缺少当前契约标识');
      const m = requireCurrent(userId, data.membershipId), date = dateKey(at), r = ensureRecord(m, date, at);
      // Leaving ends today's obligation; keep actual study and leave history, but no early daily penalty.
      run(`UPDATE group_daily_records SET daily_state=?,settled=1,settled_at=?,updated_at=? WHERE membership_id=? AND business_date=?`, r.is_day_off ? 'day_off' : 'exited', at, at, m.id, date);
      m.end_status = m.status; m.status = 'ended'; m.end_reason = 'voluntary_exit'; m.exited_at = at; m.streak = 0;
      saveMember(m); event(m, date, 'voluntary_exit', at); archiveIfEmpty(m.group_id, at); return { ended: true };
    });
  }
  function writeToday(userId, data, mode) {
    const at = now(); prepareUser(userId, at);
    return mutation(userId, mode, data, () => {
      if (!data.membershipId) fail('MEMBERSHIP_REQUIRED', '缺少当前契约标识');
      const m = requireCurrent(userId, data.membershipId), today = dateKey(at), g = group(m.group_id);
      if (!validDate(data.date) || data.date !== today) fail('DAY_LOCKED', '只能操作北京时间当天的记录，跨日后请刷新', 409);
      const r = ensureRecord(m, today, at);
      if (r.settled) fail('DAY_LOCKED', '当日记录已经锁定', 409);
      if (mode === 'day-off') {
        if (r.is_day_off) return { saved: true, date: today };
        if (m.status !== 'formal') fail('OBSERVER_NO_LEAVE', '旁听席不能请假');
        if (today < m.evaluation_start_date) fail('JOIN_DAY_NO_LEAVE', '加入日不考核，无需请假');
        if (m.leave_week !== weekKey(today)) { m.leave_week = weekKey(today); m.weekly_leave = 0; }
        if (m.weekly_leave >= RULES.weeklyDayOffLimit) fail('LEAVE_USED', '本周请假机会已使用');
        m.weekly_leave += 1; saveMember(m);
        run('UPDATE group_daily_records SET is_day_off=1,updated_at=? WHERE membership_id=? AND business_date=?', at, m.id, today);
        event(m, today, 'day_off', at);
      } else {
        const value = integer(data.value, mode === 'add' ? 1 : 0, maxValue(g.baseline_type));
        if (mode === 'set' && data.revision !== r.revision) fail('RECORD_CHANGED', '今日记录已在其他操作中更新，请刷新后修正', 409);
        const total = mode === 'add' ? r.total_value + value : value;
        integer(total, 0, maxValue(g.baseline_type));
        run('UPDATE group_daily_records SET total_value=?,revision=revision+1,updated_at=? WHERE membership_id=? AND business_date=?', total, at, m.id, today);
      }
      return { saved: true, date: today };
    });
  }
  function recordView(m, r, date, today, g) {
    let state = r && r.daily_state;
    if (!r || !r.settled) {
      if (date > today || date < m.joined_date || (m.exited_at && date > dateKey(m.exited_at))) state = 'none';
      else if (date < m.evaluation_start_date) state = 'joined';
      else if (r && r.is_day_off) state = 'day_off';
      else if (m.status === 'observer') state = r && r.total_value >= g.baseline_value ? 'observer_met' : 'observer';
      else state = r && r.total_value >= g.baseline_value ? 'fulfilled' : 'pending';
    }
    return { date, state, card: r ? r.card_result : '', value: r ? r.total_value : 0, settled: !!(r && r.settled), revision: r ? r.revision : 0 };
  }
  function aggregate(records) {
    const result = { fulfilled: 0, unfulfilled: 0, dayOff: 0, totalValue: 0, eligible: 0, rate: null };
    records.forEach(r => {
      if (r.seat === 'observer') return;
      result.totalValue += r.total_value;
      if (r.is_day_off) result.dayOff += 1;
      if (r.settled && ['fulfilled', 'unfulfilled'].includes(r.daily_state)) {
        result.eligible += 1; if (r.daily_state === 'fulfilled') result.fulfilled += 1; else result.unfulfilled += 1;
      }
    });
    if (result.eligible) result.rate = Math.round(result.fulfilled / result.eligible * 100);
    return result;
  }
  function recordsForGroup(id, from, until) {
    return all(`SELECT r.* FROM group_daily_records r JOIN group_memberships m ON m.id=r.membership_id
      WHERE m.group_id=? AND r.business_date>=? AND r.business_date<=?`, id, from, until);
  }
  function memberView(m, g, today, record) {
    return { id: m.id, nickname: m.nickname, avatar: m.avatar, status: m.status, isInitiator: m.user_id === g.created_by,
      streak: m.streak, longestStreak: m.longest_streak, joinedDate: m.joined_date, evaluationStart: m.evaluation_start_date,
      weeklyMiss: m.week_key === weekKey(today) ? m.weekly_miss : 0,
      leaveRemaining: m.leave_week === weekKey(today) ? Math.max(0, RULES.weeklyDayOffLimit - m.weekly_leave) : RULES.weeklyDayOffLimit,
      recovery: m.status === 'observer' ? m.observer_progress : 0, recoveredToday: m.recovered_on === today,
      today: recordView(m, record, today, today, g) };
  }
  function dashboard(userId) {
    const at = now(); prepareUser(userId, at); const m = current(userId), today = dateKey(at);
    if (!m) return { group: null, rules: RULES, date: today };
    const g = group(m.group_id), members = all("SELECT * FROM group_memberships WHERE group_id=? AND status!='ended' ORDER BY joined_at,rowid", g.id);
    const from = weekKey(today), records = recordsForGroup(g.id, from, shiftDate(from, 6));
    const byRecord = new Map(records.map(r => [r.membership_id + r.business_date, r]));
    const views = members.map(person => ({ ...memberView(person, g, today, byRecord.get(person.id + today)), week: Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(from, i); return recordView(person, byRecord.get(person.id + date), date, today, g);
    }) }));
    const eligible = views.filter(v => v.status === 'formal' && v.today.state !== 'joined' && v.today.state !== 'day_off');
    return { date: today, group: publicGroup(g), rules: RULES, contract: contractLines(), me: views.find(v => v.id === m.id), members: views,
      today: { fulfilled: eligible.filter(v => v.today.state === 'fulfilled').length, eligible: eligible.length,
        formal: views.filter(v => v.status === 'formal').length, observer: views.filter(v => v.status === 'observer').length },
      week: { start: from, ...aggregate(records.filter(r => r.business_date <= today)) },
      month: { month: today.slice(0, 7), ...aggregate(recordsForGroup(g.id, today.slice(0, 7) + '-01', today)) } };
  }
  function monthDetail(userId, month) {
    const at = now(); prepareUser(userId, at); const m = requireCurrent(userId), g = group(m.group_id), today = dateKey(at);
    month = month || today.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7) || month < dateKey(g.created_at).slice(0, 7)) fail('INVALID_MONTH', '请选择小组成立至今的月份');
    const records = recordsForGroup(g.id, month + '-01', month + '-31');
    const memberships = all('SELECT * FROM group_memberships WHERE group_id=? AND joined_date<=? AND (exited_at IS NULL OR exited_at>=?) ORDER BY joined_at,rowid', g.id, month + '-31', Date.parse(month + '-01T00:00:00+08:00'));
    return { group: publicGroup(g), month, summary: aggregate(records), members: memberships.map(person => ({
      id: person.id, nickname: person.nickname, avatar: person.avatar, status: person.status, streak: person.streak,
      ...aggregate(records.filter(r => r.membership_id === person.id)) })) };
  }
  function memberDetail(userId, id) {
    const at = now(); prepareUser(userId, at); const mine = requireCurrent(userId), today = dateKey(at), g = group(mine.group_id);
    const m = one("SELECT * FROM group_memberships WHERE id=? AND group_id=? AND status!='ended'", id, mine.group_id);
    if (!m) fail('MEMBER_FORBIDDEN', '只能查看当前同组成员的契约资料', 403);
    const records = all('SELECT * FROM group_daily_records WHERE membership_id=? AND business_date>=? AND business_date<=?', id, shiftDate(today.slice(0, 7) + '-01', -7), today);
    return { group: publicGroup(g), member: memberView(m, g, today, records.find(r => r.business_date === today)), week: aggregate(records.filter(r => r.business_date >= weekKey(today))), month: aggregate(records.filter(r => r.business_date.slice(0, 7) === today.slice(0, 7))) };
  }
  function history(userId, before = '') {
    prepareUser(userId); if (before && !/^\d+$/.test(before)) fail('INVALID_CURSOR', '历史页码无效');
    const rows = all(`SELECT m.*,m.rowid AS cursor,g.name,g.baseline_unit FROM group_memberships m JOIN study_groups g ON g.id=m.group_id
      WHERE m.user_id=? AND m.status='ended' AND m.rowid<? ORDER BY m.rowid DESC LIMIT 21`, userId, before ? Number(before) : Number.MAX_SAFE_INTEGER);
    const page = rows.slice(0, 20);
    const records = page.length ? all(`SELECT * FROM group_daily_records WHERE membership_id IN (${page.map(() => '?').join(',')})`, ...page.map(m => m.id)) : [];
    return { items: page.map(m => {
      return { id: m.id, name: m.name, joinedDate: m.joined_date, exitedDate: dateKey(m.exited_at), endReason: m.end_reason,
        days: Math.max(1, Math.round((Date.parse(dateKey(m.exited_at)) - Date.parse(m.joined_date)) / 86400000) + 1),
        longestStreak: m.longest_streak, ...aggregate(records.filter(r => r.membership_id === m.id)) };
    }), nextCursor: rows.length > 20 ? String(page[page.length - 1].cursor) : '' };
  }
  function settleBatch(after = '', limit = 32) {
    const at = now(), ids = all("SELECT id FROM group_memberships WHERE status!='ended' AND id>? ORDER BY id LIMIT ?", after, limit);
    ids.forEach(m => transaction(() => settleMember(m.id, dateKey(at), at)));
    return { count: ids.length, cursor: ids.length === limit ? ids[ids.length - 1].id : null };
  }
  return { create, preview, join, exit, dashboard, monthDetail, memberDetail, history, writeToday, settleBatch, catchUpGroup,
    rules: () => ({ rules: RULES, contract: contractLines() }) };
}
module.exports = { createGroupService };
