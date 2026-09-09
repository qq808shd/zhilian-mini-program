const { createDatabase } = require('../src/database');
let sequence = 0;
function fixture(start = '2026-09-07') {
  let time = Date.parse(start + 'T12:00:00+08:00');
  const logs = [], database = createDatabase(':memory:', { groups: { now: () => time, logger: e => logs.push(e) } });
  const service = database.groups;
  const user = label => database.getOrCreateUser('group-test-' + label, '').id;
  const request = data => ({ ...data, requestId: 'group-test-request-' + (++sequence) });
  function create(id, data = {}) { service.create(id, request({ name: '同行学习组', studyTopic: '行测综合', baselineType: 'duration', baselineValue: 60, nickname: '同学甲', accepted: true, ...data })); return service.dashboard(id); }
  function join(id, code, nickname = '同学乙') { service.join(id, request({ code, nickname, accepted: true })); return service.dashboard(id); }
  function record(id, value, mode = 'add') { const d = service.dashboard(id); return service.writeToday(id, request({ value, date: d.date, membershipId: d.me.id, revision: d.me.today.revision }), mode); }
  function leave(id) { const d = service.dashboard(id); return service.writeToday(id, request({ date: d.date, membershipId: d.me.id }), 'day-off'); }
  function exit(id) { return service.exit(id, request({ membershipId: service.dashboard(id).me.id })); }
  return { database, service, user, request, create, join, record, leave, exit, logs,
    day(date, clock = '12:00:00') { time = Date.parse(date + 'T' + clock + '+08:00'); },
    now: () => time, close: () => database.close() };
}
module.exports = { fixture };
