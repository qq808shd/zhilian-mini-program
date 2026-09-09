const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./group-fixture');
const { RULES, dateKey, weekKey, shiftDate, settleDay } = require('../../miniprogram/utils/groupRules');
const { nextSettlementAt } = require('../src/groups/scheduler');
function checkError(fn, code) { assert.throws(fn, e => e.code === code); }
function setup(t, start) { const f = fixture(start); t.after(f.close); f.a = f.user('a'); f.b = f.user('b'); f.d = f.create(f.a); f.code = f.d.group.invite_code; return f; }
test('Shanghai calendar, Monday week and 00:05 scheduler cross year correctly', () => {
  assert.equal(dateKey(Date.parse('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(weekKey('2027-01-03'), '2026-12-28');
  assert.equal(weekKey('2027-01-04'), '2027-01-04');
  assert.equal(new Date(nextSettlementAt(Date.parse('2026-09-07T16:05:00Z'))).toISOString(), '2026-09-08T16:05:00.000Z');
});
test('pure state machine preserves streak on leave; join day never assesses', () => {
  const m = { status:'formal', evaluation_start_date:'2026-09-08', week_key:'2026-09-07', weekly_miss:0, streak:18, longest_streak:18 };
  assert.equal(settleDay(m,{total_value:0},{baseline_value:60},'2026-09-07').record.daily_state,'joined');
  const result=settleDay(m,{total_value:80,is_day_off:1},{baseline_value:60},'2026-09-08');
  assert.equal(result.member.streak,18); assert.equal(result.record.daily_state,'day_off');
  assert.equal(settleDay(m,{total_value:60},{baseline_value:60},'2026-09-08').member.streak,19);
});
test('create validates all baseline and identity input without partial groups', t => {
  const f=fixture();t.after(f.close);const a=f.user('a');
  for (const invalid of [{name:''},{studyTopic:''},{nickname:''},{baselineValue:0},{baselineValue:-1},{baselineValue:1.5},{baselineValue:1441},{baselineValue:1e99},{baselineType:'task'},{baselineType:'quantity',baselineUnit:'任务'},{accepted:false},{name:'长'.repeat(21)}]) {
    assert.throws(()=>f.create(a,invalid)); assert.equal(f.service.dashboard(a).group,null);
  }
  const d=f.create(a,{baselineType:'quantity',baselineUnit:'页',baselineValue:10});assert.equal(d.group.baseline_unit,'页');
  checkError(()=>f.create(a),'ALREADY_IN_GROUP');
});
test('invite preview is read only, unique; one membership includes observers; capacity eight', t => {
  const f=setup(t);assert.equal(f.service.preview(f.b,f.code).group.count,1);
  assert.equal(f.service.dashboard(f.b).group,null);
  checkError(()=>f.service.preview(f.b,'ZZZZZZ'),'INVITE_INVALID');
  for(let i=0;i<7;i++)f.join(f.user('n'+i),f.code);
  checkError(()=>f.join(f.b,f.code),'GROUP_FULL');
  checkError(()=>f.join(f.a,f.code),'ALREADY_IN_GROUP');
  assert.equal(f.service.dashboard(f.a).group.count,8);
  const other=f.create(f.b);assert.notEqual(other.group.invite_code,f.code);
});
test('manual daily adds, correction, revision and request idempotency; join day excluded', t => {
  const f=setup(t);const data=f.request({membershipId:f.d.me.id,date:'2026-09-07',value:35});
  f.service.writeToday(f.a,data,'add');f.service.writeToday(f.a,data,'add');assert.equal(f.service.dashboard(f.a).me.today.value,35);
  checkError(()=>f.service.writeToday(f.a,{...data,value:40},'add'),'REQUEST_CONFLICT');
  for(const value of [-1,0,1441,Infinity,1.1])assert.throws(()=>f.record(f.a,value));
  f.record(f.a,0,'set');assert.equal(f.service.dashboard(f.a).me.today.value,0);
  f.record(f.a,600);f.record(f.a,60,'set');
  checkError(()=>f.service.writeToday(f.a,f.request({membershipId:f.d.me.id,date:'2026-09-07',value:40,revision:0}),'set'),'RECORD_CHANGED');
  checkError(()=>f.leave(f.a),'JOIN_DAY_NO_LEAVE');
  f.day('2026-09-08');const d=f.service.dashboard(f.a);assert.equal(d.me.streak,0);assert.equal(d.month.eligible,0);assert.equal(d.month.totalValue,60);
  checkError(()=>f.service.writeToday(f.a,f.request({membershipId:d.me.id,date:'2026-09-07',value:60}),'add'),'DAY_LOCKED');
  checkError(()=>f.service.writeToday(f.b,f.request({membershipId:d.me.id,date:d.date,value:60}),'add'),'MEMBERSHIP_CHANGED');
});
test('daytime shortfall is neutral; yellow then red only after day settlement; repeated settle exact', t => {
  const f=setup(t);f.day('2026-09-08');f.record(f.a,35);assert.equal(f.service.dashboard(f.a).me.weeklyMiss,0);
  f.day('2026-09-09');let d=f.service.dashboard(f.a);assert.equal(d.me.weeklyMiss,1);assert.equal(d.me.status,'formal');assert.equal(d.members[0].week[1].card,'yellow');
  f.day('2026-09-10');d=f.service.dashboard(f.a);assert.equal(d.me.status,'observer');assert.equal(d.me.recovery,0);assert.equal(d.members[0].week[2].card,'red');
  const logs=f.logs.length;for(let i=0;i<3;i++){f.service.settleBatch();f.service.dashboard(f.a);}assert.equal(f.logs.length,logs);
  assert.equal(d.month.eligible,2);assert.equal(d.month.unfulfilled,2);assert.equal(d.month.totalValue,35);
  checkError(()=>f.leave(f.a),'OBSERVER_NO_LEAVE');checkError(()=>f.create(f.a),'ALREADY_IN_GROUP');
});
test('day off irreversible and once per Monday week; study after leave does not refund or fulfill', t => {
  const f=setup(t);f.day('2026-09-08');f.record(f.a,60);f.day('2026-09-09');f.leave(f.a);f.leave(f.a);f.record(f.a,80);
  let d=f.service.dashboard(f.a);assert.equal(d.me.today.state,'day_off');assert.equal(d.me.leaveRemaining,0);assert.equal(d.today.eligible,0);
  f.day('2026-09-10');d=f.service.dashboard(f.a);assert.equal(d.me.streak,1);assert.equal(d.month.eligible,1);assert.equal(d.month.totalValue,140);checkError(()=>f.leave(f.a),'LEAVE_USED');
});
test('leave preserves streak through next fulfillment and week refresh does not erase history', t => {
  const f=setup(t,'2026-09-11');f.day('2026-09-12');f.record(f.a,60);f.day('2026-09-13');f.leave(f.a);f.day('2026-09-14');let d=f.service.dashboard(f.a);assert.equal(d.me.streak,1);assert.equal(d.me.leaveRemaining,1);f.record(f.a,60);f.day('2026-09-15');d=f.service.dashboard(f.a);assert.equal(d.me.streak,2);assert.equal(d.month.dayOff,1);
});
test('weekly misses reset for formal only; observer crosses Monday then recovers after exactly three days', t => {
  const f=setup(t,'2026-09-10');f.day('2026-09-11');f.record(f.a,60);f.day('2026-09-12');f.service.dashboard(f.a); // first miss Saturday
  f.day('2026-09-13');assert.equal(f.service.dashboard(f.a).me.weeklyMiss,1);
  f.day('2026-09-14');assert.equal(f.service.dashboard(f.a).me.status,'observer');
  for(const day of ['2026-09-14','2026-09-15','2026-09-16']) { f.day(day);const d=f.service.dashboard(f.a);assert.equal(d.me.status,'observer');f.record(f.a,60); }
  assert.equal(f.service.dashboard(f.a).me.status,'observer');
  f.day('2026-09-17');let d=f.service.dashboard(f.a);assert.equal(d.me.status,'formal');assert.equal(d.me.recoveredToday,true);assert.equal(d.me.weeklyMiss,0);assert.equal(d.month.totalValue,60);assert.equal(d.month.eligible,3);
  f.day('2026-09-18');d=f.service.dashboard(f.a);assert.equal(d.me.weeklyMiss,1);assert.equal(d.me.status,'formal');
});
test('Sunday single miss remains historical yellow while Monday current counter starts zero',t=>{
  const f=setup(t,'2026-09-12');f.day('2026-09-14');const d=f.service.dashboard(f.a);assert.equal(d.me.weeklyMiss,0);assert.equal(d.me.status,'formal');assert.equal(d.month.unfulfilled,1);
});
test('observer failure on third day offseats and frees slot; rejoin after system penalty is new contract',t=>{
  const f=setup(t);f.join(f.b,f.code);f.day('2026-09-10');assert.equal(f.service.dashboard(f.a).me.status,'observer');
  for(const date of ['2026-09-10','2026-09-11']) {f.day(date);f.record(f.a,60);f.record(f.b,60);}
  f.day('2026-09-12');assert.equal(f.service.dashboard(f.a).me.recovery,2);f.record(f.b,60);
  f.day('2026-09-13');assert.equal(f.service.dashboard(f.a).group,null);assert.equal(f.service.dashboard(f.b).group.count,1);
  const d=f.join(f.a,f.code);assert.equal(d.me.status,'formal');assert.equal(d.me.streak,0);assert.equal(d.me.weeklyMiss,0);
  const h=f.service.history(f.a).items;assert.equal(h.length,1);assert.equal(h[0].endReason,'system_offseat');assert.equal(h[0].fulfilled,0);
});
test('8 observers still occupy all seats; last observer failure archives and invalidates invitation',t=>{
  const f=setup(t);for(let i=0;i<7;i++)f.join(f.user('n'+i),f.code);
  f.day('2026-09-10');let d=f.service.dashboard(f.a);assert.equal(d.today.formal,0);assert.equal(d.today.observer,8);assert.equal(d.group.count,8);
  checkError(()=>f.join(f.b,f.code),'GROUP_FULL');
  f.day('2026-09-11');assert.equal(f.service.dashboard(f.a).group,null);assert.equal(f.service.preview(f.b,f.code).group.archived,true);checkError(()=>f.join(f.b,f.code),'GROUP_ARCHIVED');
});
test('initiator exits without ending group; same-week rejoin carries yellow and used leave across other groups',t=>{
  const f=setup(t);f.join(f.b,f.code);f.day('2026-09-08');f.leave(f.a);f.day('2026-09-10');assert.equal(f.service.dashboard(f.a).me.weeklyMiss,1);f.exit(f.a);
  // Keep original group's observer alive on its first challenge day.
  f.record(f.b,60);
  assert.equal(f.service.preview(f.a,f.code).group.archived,false);
  f.create(f.a,{name:'另一组'});f.exit(f.a);
  let d=f.join(f.a,f.code);assert.equal(d.me.weeklyMiss,1);assert.equal(d.me.leaveRemaining,0);assert.equal(d.me.streak,0);assert.equal(d.me.today.state,'joined');
  f.day('2026-09-11');checkError(()=>f.leave(f.a),'LEAVE_USED');f.record(f.b,60);
  f.day('2026-09-12');d=f.service.dashboard(f.a);assert.equal(d.me.status,'observer');assert.equal(f.service.history(f.a).items.length,2);
});
test('voluntary observer rejoin carries status across weeks and restarts challenge at zero',t=>{
  const f=setup(t);f.join(f.b,f.code);f.day('2026-09-10');f.record(f.a,60);f.record(f.b,60);f.day('2026-09-11');assert.equal(f.service.dashboard(f.a).me.recovery,1);f.exit(f.a);
  for (const date of ['2026-09-11','2026-09-12','2026-09-13','2026-09-14']) {f.day(date);f.record(f.b,60);}
  const d=f.join(f.a,f.code);assert.equal(d.me.status,'observer');assert.equal(d.me.recovery,0);assert.equal(d.group.count,2);
});
test('one formal plus seven observers remains full and denominators exclude observers and leave',t=>{
  const f=setup(t);for(let i=0;i<7;i++)f.join(f.user('n'+i),f.code);
  for(const date of ['2026-09-08','2026-09-09']) {f.day(date);f.record(f.a,60);}
  f.day('2026-09-10');const d=f.service.dashboard(f.a);assert.equal(d.today.formal,1);assert.equal(d.today.observer,7);assert.equal(d.today.eligible,1);
  checkError(()=>f.join(f.b,f.code),'GROUP_FULL');f.leave(f.a);assert.equal(f.service.dashboard(f.a).today.eligible,0);
});
test('foreign member details denied; current group sees history only in aggregate, user history isolated',t=>{
  const f=setup(t);f.create(f.b);const other=f.service.dashboard(f.b);checkError(()=>f.service.memberDetail(f.a,other.me.id),'MEMBER_FORBIDDEN');
  f.exit(f.a);assert.equal(f.service.history(f.b).items.length,0);assert.equal(f.service.history(f.a).items.length,1);
});
test('months exclude observer learning but include formal leave and partial actual values; immutable prior dates',t=>{
  const f=setup(t,'2026-08-30');f.record(f.a,25);f.day('2026-08-31');f.record(f.a,35);f.day('2026-09-01');f.leave(f.a);f.record(f.a,80);
  const august=f.service.monthDetail(f.a,'2026-08');assert.equal(august.summary.totalValue,60);assert.equal(august.summary.eligible,1);assert.equal(august.summary.rate,0);
  f.day('2026-09-02');const september=f.service.monthDetail(f.a,'2026-09');assert.equal(september.summary.totalValue,80);assert.equal(september.summary.eligible,0);assert.equal(september.summary.rate,null);
  checkError(()=>f.service.monthDetail(f.a,'2026-13'),'INVALID_MONTH');
});
test('migration additive, survives reopen, unique current index remains enforced',t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {createDatabase}=require('../src/database');const {DatabaseSync}=require('node:sqlite');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zhilian-group-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const dbPath=path.join(dir,'test.sqlite');
  let db=createDatabase(dbPath,{groups:{logger:()=>{}}});const u=db.getOrCreateUser('old-user','');db.groups.create(u.id,{requestId:'migration-test-request',name:'小组',studyTopic:'行测',baselineType:'duration',baselineValue:60,nickname:'同学',accepted:true});db.close();
  db=createDatabase(dbPath,{groups:{logger:()=>{}}});assert.equal(db.getUserById(u.id).id,u.id);assert.equal(db.groups.dashboard(u.id).group.name,'小组');db.close();
  const sql=new DatabaseSync(dbPath);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM group_schema_migrations').get().n,1);assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE name='question_stats'").get());
  assert.throws(()=>sql.exec("INSERT INTO group_memberships SELECT 'duplicate',group_id,user_id,nickname,avatar,status,joined_at,joined_date,evaluation_start_date,exited_at,end_reason,end_status,streak,longest_streak,week_key,weekly_miss,leave_week,weekly_leave,observer_progress,recovered_on,last_settled_date FROM group_memberships"),/UNIQUE/);sql.close();
});
