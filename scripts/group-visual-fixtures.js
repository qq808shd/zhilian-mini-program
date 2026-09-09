// Deterministic synthetic accounts + real service state machine. No production network.
const { fixture } = require('../server/test/group-fixture');
function generate() {
  const fixtures = {};
  function scenario(key, count, action, type='duration') {
    const f=fixture(); const users=Array.from({length:count},(_,i)=>f.user('visual-'+i));
    const d=f.create(users[0],{name:'2027省考坚持学习伙伴同行组',studyTopic:'行测综合',nickname:'认真学习的长昵称伙伴',...(type==='quantity'?{baselineType:'quantity',baselineUnit:'题',baselineValue:100000}:{})});
    users.slice(1).forEach((u,i)=>f.join(u,d.group.invite_code,['小林','阿南','清风','柚子','小满','星河','知知'][i]));
    action(f,users);
    fixtures[key] = f.service.dashboard(users[0]);
    fixtures[key].monthDetail=f.service.monthDetail(users[0]);
    fixtures[key].memberDetail=f.service.memberDetail(users[0],fixtures[key].me.id);
    fixtures[key].preview=f.service.preview(f.user('visual-guest'),d.group.invite_code);
    f.close();
  }
  scenario('01-new-one',1,()=>{});
  scenario('02-full-eight',8,()=>{});
  scenario('03-none-completed',8,f=>f.day('2026-09-08'));
  scenario('04-some-completed',8,(f,u)=>{f.day('2026-09-08');u.slice(1,4).forEach(x=>f.record(x,75));f.record(u[0],35);});
  scenario('05-all-completed',8,(f,u)=>{f.day('2026-09-08');u.forEach(x=>f.record(x,75));});
  scenario('06-day-off',8,(f,u)=>{f.day('2026-09-08');f.leave(u[0]);});
  scenario('07-day-off-study',8,(f,u)=>{f.day('2026-09-08');f.leave(u[0]);f.record(u[0],80);});
  scenario('08-yellow',8,(f,u)=>{f.day('2026-09-09');f.record(u[1],60);});
  scenario('09-observer-zero',8,f=>f.day('2026-09-10'));
  scenario('10-observer-two',8,(f,u)=>{for(const d of ['2026-09-10','2026-09-11']){f.day(d);u.forEach(x=>f.record(x,60));}f.day('2026-09-12');});
  scenario('11-recovered',8,(f,u)=>{for(const d of ['2026-09-10','2026-09-11','2026-09-12']){f.day(d);u.forEach(x=>f.record(x,60));}f.day('2026-09-13');});
  scenario('12-seven-observers',8,(f,u)=>{for(const d of ['2026-09-08','2026-09-09']){f.day(d);f.record(u[0],60);}f.day('2026-09-10');});
  scenario('13-all-observers',8,f=>f.day('2026-09-10'));
  scenario('14-month-empty',1,f=>f.day('2026-09-08'));
  scenario('15-quantity',8,(f,u)=>{f.day('2026-09-08');f.record(u[0],99999);f.record(u[1],100000);},'quantity');
  scenario('16-duration',8,(f,u)=>{f.day('2026-09-08');f.record(u[0],1440);});
  fixtures['17-empty']={group:null,rules:require('../miniprogram/utils/groupRules').RULES,date:'2026-09-08'};
  const ended=fixture(), former=ended.user('former');
  const group=ended.create(former); ended.day('2026-09-08'); ended.record(former,60); ended.day('2026-09-09'); ended.exit(former);
  fixtures['18-archived']={...ended.service.dashboard(former),preview:ended.service.preview(ended.user('guest'),group.group.invite_code),history:ended.service.history(former)};
  ended.close();
  return fixtures;
}
if(require.main===module){const fs=require('node:fs');fs.writeFileSync(process.argv[2],JSON.stringify(generate()));}
module.exports={generate};
