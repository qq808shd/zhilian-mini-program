const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApiServer } = require('../src/api');
const { fixture } = require('./group-fixture');
async function start(t) {
  const f=fixture(), server=createApiServer({ database:f.database, config:{sessionSecret:'groups-test-secret-at-least-32-characters',sessionTtlSeconds:3600},exchangeCode:async code=>({openid:'group-test-'+code,unionid:''}) });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.close();await once(server,'close');f.close();});
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path, token, method='GET', data) {const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,body:await r.json()};}
  async function login(name) {return (await call('/v1/auth/wechat',null,'POST',{code:name})).body.token;}
  return {...f,call,login};
}
test('authenticated real HTTP: concurrent last slot, idempotent daily writes, authorization and archive',async t=>{
  const f=await start(t),a=await f.login('a'), b=await f.login('b');
  assert.equal((await f.call('/v1/groups')).status,401);
  const payload=f.request({name:'伙伴组',studyTopic:'行测',baselineType:'quantity',baselineValue:20,baselineUnit:'题',nickname:'甲',accepted:true,user_id:'forged'});
  const created=await f.call('/v1/groups',a,'POST',payload);assert.equal(created.status,200);
  assert.deepEqual((await f.call('/v1/groups',a,'POST',payload)).body,created.body);
  const d=(await f.call('/v1/groups',a)).body, code=d.group.invite_code;
  const preview=(await f.call('/v1/groups/preview?code='+code,b)).body;assert.equal(preview.group.count,1);assert.equal(preview.members,undefined);
  assert.equal((await f.call('/v1/groups',b)).body.group,null);
  const tokens=[a];for(let i=1;i<7;i++){const token=await f.login('u'+i);tokens.push(token);assert.equal((await f.call('/v1/groups/join',token,'POST',f.request({code,nickname:'伙伴'+i,accepted:true}))).status,200);}
  const c=await f.login('c');const joins=await Promise.all([b,c].map(token=>f.call('/v1/groups/join',token,'POST',f.request({code,nickname:'最后席位',accepted:true}))));
  assert.deepEqual(joins.map(r=>r.status).sort(),[200,409]);assert.equal((await f.call('/v1/groups',a)).body.group.count,8);
  const outsider=joins[0].status===409?b:c;
  assert.equal((await f.call('/v1/groups/members/'+d.me.id,outsider)).status,409);
  const sameGroup=joins[0].status===200?b:c;
  assert.equal((await f.call('/v1/groups/members/'+d.me.id,sameGroup)).status,200);
  f.day('2026-09-08');const record=f.request({membershipId:d.me.id,date:'2026-09-08',value:15});
  const writes=await Promise.all([f.call('/v1/groups/today',a,'POST',record),f.call('/v1/groups/today',a,'POST',record)]);assert.ok(writes.every(r=>r.status===200));
  let today=(await f.call('/v1/groups',a)).body;assert.equal(today.me.today.value,15);
  assert.equal((await f.call('/v1/groups/today',outsider,'POST',f.request({...record}))).status,409);
  assert.equal((await f.call('/v1/groups/today',a,'PATCH',f.request({membershipId:d.me.id,date:'2026-09-08',value:20,revision:today.me.today.revision}))).status,200);
  assert.equal((await f.call('/v1/groups/day-off',a,'POST',f.request({membershipId:d.me.id,date:'2026-09-08'}))).status,200);
  assert.equal((await f.call('/v1/groups/day-off',a,'DELETE',{})).status,404);
  f.day('2026-09-09');assert.equal((await f.call('/v1/groups/day-off',a,'POST',f.request({membershipId:d.me.id,date:'2026-09-08'}))).body.code,'DAY_LOCKED');
  assert.equal((await f.call('/v1/groups/day-off',a,'POST',f.request({membershipId:d.me.id,date:'2026-09-09'}))).body.code,'LEAVE_USED');
  assert.equal((await f.call('/v1/groups/month',a)).body.summary.dayOff,1);
  assert.equal((await f.call('/v1/groups/rules',a)).body.rules.maxMembers,8);
  const before=f.logs.length;await f.call('/v1/groups',a);await f.call('/v1/groups',a);assert.equal(f.logs.length,before);
  assert.equal((await f.call('/v1/groups',a,'PATCH',f.request({baselineValue:100}))).status,404);
});
test('HTTP system offseat, rejoin and voluntary exits preserve isolated history and archive last seat',async t=>{
  const f=await start(t),a=await f.login('a'),b=await f.login('b');
  const d=f.create(f.user('a'));f.join(f.user('b'),d.group.invite_code);
  f.day('2026-09-10');f.record(f.user('b'),60);f.day('2026-09-11');assert.equal((await f.call('/v1/groups',a)).body.group,null);
  const joined=await f.call('/v1/groups/join',a,'POST',f.request({code:d.group.invite_code,nickname:'重来',accepted:true}));assert.equal(joined.status,200);
  const mine=(await f.call('/v1/groups',a)).body;assert.equal(mine.me.status,'formal');assert.equal(mine.me.weeklyMiss,0);
  assert.equal((await f.call('/v1/groups/history',a)).body.items[0].endReason,'system_offseat');
  assert.equal((await f.call('/v1/groups/history',b)).body.items.length,0);
  await f.call('/v1/groups/exit',a,'POST',f.request({membershipId:mine.me.id}));
  const peer=(await f.call('/v1/groups',b)).body;await f.call('/v1/groups/exit',b,'POST',f.request({membershipId:peer.me.id}));
  assert.equal((await f.call('/v1/groups/preview?code='+d.group.invite_code,a)).body.group.archived,true);
  assert.equal((await f.call('/v1/groups/join',a,'POST',f.request({code:d.group.invite_code,nickname:'再次',accepted:true}))).body.code,'GROUP_ARCHIVED');
});

test('group avatar requires owner, is shared only within group, and is removed on exit',async t=>{
  const f=await start(t),a=await f.login('avatar-a'),b=await f.login('avatar-b'),c=await f.login('avatar-c');
  const uid=f.user('avatar-a'),d=f.create(uid),peer=f.join(f.user('avatar-b'),d.group.invite_code);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6uAAAAAASUVORK5CYII=';
  const payload=f.request({membershipId:d.me.id,image,accepted:true});
  assert.equal((await f.call('/v1/groups/avatar',null,'POST',payload)).status,401);
  assert.equal((await f.call('/v1/groups/avatar',b,'POST',payload)).body.code,'MEMBERSHIP_CHANGED');
  assert.equal((await f.call('/v1/groups/avatar',a,'POST',f.request({membershipId:d.me.id,image}))).status,200);
  for(const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/avatar.png',image.slice(0,-3),'data:image/png;base64,'+'a'.repeat(180000)]) {
    assert.equal((await f.call('/v1/groups/avatar',a,'POST',f.request({membershipId:d.me.id,image:bad,accepted:true}))).body.code,'INVALID_AVATAR');
  }
  assert.equal((await f.call('/v1/groups/avatar',a,'POST',payload)).status,200);
  assert.equal((await f.call('/v1/groups/avatar',a,'POST',payload)).status,200);
  const others=(await f.call('/v1/groups',b)).body;
  assert.equal(others.members.find(x=>x.id===d.me.id).avatarImage,image);
  assert.equal(others.avatarEnabled,true);
  assert.equal((await f.call('/v1/groups/members/'+d.me.id,b)).body.member.avatarImage,image);
  assert.equal((await f.call('/v1/groups/members/'+d.me.id,c)).status,409);
  assert.ok(!JSON.stringify((await f.call('/v1/groups/preview?code='+d.group.invite_code,c)).body).includes(image));
  await f.call('/v1/groups/avatar',a,'POST',f.request({membershipId:d.me.id,image:''}));
  assert.equal((await f.call('/v1/groups',a)).body.me.avatarImage,'');
  await f.call('/v1/groups/avatar',a,'POST',f.request({membershipId:d.me.id,image,accepted:true}));
  f.exit(uid);
  assert.ok(!JSON.stringify(f.service.monthDetail(f.user('avatar-b'))).includes(image));
  const again=f.join(uid,d.group.invite_code);
  assert.equal(again.me.avatarImage,'');
  assert.equal((await f.call('/v1/groups/avatar',a,'POST',f.request({...payload}))).body.code,'MEMBERSHIP_CHANGED');
});

test('unified profile preserves identity, isolates users, detects conflicts and drives existing and new group display',async t=>{
 const f=await start(t),a=await f.login('profile-a'),b=await f.login('profile-b');
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6uAAAAAASUVORK5CYII=';
 const group=f.create(f.user('profile-a'));f.join(f.user('profile-b'),group.group.invite_code);
 assert.equal((await f.call('/v1/profile',null)).status,401);
 const initial=(await f.call('/v1/profile',a)).body;assert.equal(initial.revision,0);
 const data={nickname:'统一昵称',image,revision:0,userId:f.user('profile-b')};
 const saved=await f.call('/v1/profile',a,'PUT',data);assert.equal(saved.status,200);assert.equal(saved.body.userId,initial.userId);
 assert.equal((await f.call('/v1/profile',b)).body.nickname,'');
 assert.equal((await f.call('/v1/profile',a,'PUT',data)).body.revision,1);
 assert.equal((await f.call('/v1/profile',a,'PUT',{...data,nickname:'冲突'})).status,409);
 assert.equal((await f.call('/v1/profile',a,'PUT',{...data,nickname:'',revision:1})).status,400);
 const dashboard=(await f.call('/v1/groups',b)).body;assert.equal(dashboard.members.find(m=>m.id===group.me.id).nickname,'统一昵称');assert.equal(dashboard.members.find(m=>m.id===group.me.id).avatarImage,image);
 await f.call('/v1/profile',a,'PUT',{...data,nickname:'新的统一昵称',revision:1});
 assert.equal((await f.call('/v1/groups/members/'+group.me.id,b)).body.member.nickname,'新的统一昵称');
 await f.call('/v1/groups/exit',a,'POST',f.request({membershipId:group.me.id}));
 assert.equal((await f.call('/v1/profile',a)).body.nickname,'新的统一昵称');
 const rejoin=await f.call('/v1/groups/join',a,'POST',f.request({code:group.group.invite_code,nickname:'旧称呼',accepted:true}));assert.equal(rejoin.status,200);assert.equal((await f.call('/v1/groups',a)).body.me.nickname,'新的统一昵称');
});
