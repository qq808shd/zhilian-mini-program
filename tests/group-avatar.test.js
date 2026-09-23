const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const view=require('../miniprogram/utils/groupView');
function setup() {
  let avatar='saved.png',authorized=true,failed=false,compressions=0;
  const writes=[];
  const data={avatarEnabled:true,group:{id:'g'},me:{id:'mine',avatarImage:''},members:[{id:'mine'},{id:'peer'}]};
  const module={exports:{}};
  const api={read:async()=>data,requestId:()=>String(writes.length),write:async(...args)=>{writes.push(args);if(failed)throw new Error('offline');}};
  const wx={compressImage:o=>{compressions++;o.success({tempFilePath:'compressed.png'});},getImageInfo:o=>o.success({type:'png'}),getFileSystemManager:()=>({readFile:o=>o.success({data:Buffer.from(avatar).toString('base64')}),unlink(){}})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/groupAvatar.js'),'utf8'),{module,require:n=>n==='./profile'?{getProfile:()=>({avatar}),DEFAULT_AVATAR:'default.svg'}:n==='./account'?{isSyncAuthorized:()=>authorized}:n==='./profileSync'?{restore:async()=>null}:api,wx,Promise,Error});
  return {helper:module.exports,data,writes,compressions:()=>compressions,setAvatar:v=>avatar=v,setAuthorized:v=>authorized=v,setFailed:v=>failed=v};
}
test('view uses shared image when present and retains built-in avatar for old server',()=>{
  const old=view.member({avatar:2,today:{state:'pending'}});assert.equal(old.avatarPath,'/assets/groups/avatar-2.svg');
  assert.equal(view.member({avatar:2,avatarImage:'data:image/png;base64,test',today:{state:'pending'}}).avatarPath,'data:image/png;base64,test');
});
test('automatically uploads profile avatar without another confirmation, skips matching image, updates after profile change',async()=>{
  const f=setup();let d=await f.helper.syncAvatar(f.data);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0][0],'/avatar');assert.equal(f.writes[0][1].membershipId,'mine');assert.equal(f.writes[0][1].nickname,undefined);assert.equal(f.writes[0][1].accepted,undefined);
  assert.equal(d.members[0].avatarImage,d.me.avatarImage);assert.equal(d.members[1].avatarImage,undefined);
  await f.helper.syncAvatar(d);assert.equal(f.writes.length,1);assert.equal(f.compressions(),1);
  f.setAvatar('new.png');const updated=await f.helper.syncAvatar(d);assert.equal(f.writes.length,2);assert.notEqual(updated.me.avatarImage,d.me.avatarImage);
});
test('default avatar, old backend, no group or revoked consent cannot upload or erase remote avatar',async()=>{
  const f=setup();f.setAvatar('default.svg');assert.equal(await f.helper.syncAvatar(f.data),f.data);
  f.setAvatar('saved.png');await f.helper.syncAvatar({...f.data,avatarEnabled:false});await f.helper.syncAvatar({group:null});
  f.setAuthorized(false);await f.helper.syncAvatar(f.data);assert.equal(f.writes.length,0);assert.equal(f.compressions(),0);
});
test('failed auto sync preserves server data and a later refresh retries successfully',async()=>{
  const f=setup();f.setFailed(true);await assert.rejects(f.helper.syncAvatar(f.data),/offline/);assert.equal(f.data.me.avatarImage,'');
  f.setFailed(false);const updated=await f.helper.syncAvatar(f.data);assert.ok(updated.me.avatarImage);assert.equal(f.writes.length,2);
});
test('avatar preparation compresses saved file, limits payload, preserves source and cleans only temporary copy',async()=>{
  let requested,removed=[],data='a'.repeat(200000);
  const fake={compressImage:o=>{requested=o;o.success({tempFilePath:'compressed.png'});},getImageInfo:o=>o.success({type:'png'}),getFileSystemManager:()=>({readFile:o=>o.success({data}),unlink:o=>removed.push(o.filePath)})};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/groupAvatar.js'),'utf8'),{module,require:()=>({getProfile:()=>({avatar:'saved.png'}),DEFAULT_AVATAR:'default.svg'}),wx:fake,Promise,Error});
  await assert.rejects(module.exports.prepareAvatar('saved.png'),/过大/);assert.equal(requested.src,'saved.png');assert.equal(requested.compressedWidth,160);assert.deepEqual(removed,['compressed.png']);
  data='cGljdHVyZQ==';assert.equal(await module.exports.prepareAvatar('saved.png'),'data:image/png;base64,'+data);assert.ok(!removed.includes('saved.png'));
});

test('group page automatically syncs after loading and keeps learning available on avatar failure',async()=>{
  let page,fail=false,calls=0;
  const data={ready:true,group:{id:'g'},me:{id:'mine'},members:[]};
  const helper={syncAvatar:async d=>{calls++;if(fail)throw new Error('offline');return {...d,synced:true};}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/pages/study-group/index.js'),'utf8'),{Page:p=>page=p,require:n=>n.endsWith('/groupApi')?{read:async()=>data,errorText:e=>e.message}:n.endsWith('/groupAvatar')?helper:n.endsWith('/groupView')?{dashboard:d=>d}:{RULES:{}},wx:{}});
  page.data={...page.data};page.setData=d=>Object.assign(page.data,d);
  await page.load();assert.equal(calls,1);assert.equal(page.data.synced,true);assert.equal(page.data.loading,false);
  fail=true;await page.load();assert.equal(page.data.error,'');assert.match(page.data.avatarSyncError,/下拉刷新/);assert.equal(page.data.group.id,'g');assert.equal(page.onAvatar,undefined);
});

test('status help opens and closes without a group write and explains actual recovery timing',()=>{
 let page;const rules=require('../miniprogram/utils/groupRules');
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/study-group/index.js','utf8'),{Page:p=>page=p,require:n=>n.endsWith('/groupRules')?rules:{},wx:{}});
 page.data={...page.data};page.setData=d=>Object.assign(page.data,d);page.onStatusHelp();
 assert.equal(page.data.sheet,'status');const rows=page.data.statusSections.flatMap(s=>s.items);
 assert.ok(rows.find(r=>r.name==='黄牌'&&r.symbol==='黄'));assert.ok(rows.find(r=>r.name==='红牌'&&r.symbol==='红'));
 assert.match(rows.find(r=>r.name==='挑战达标').description,/连续 3 天达标后，下一日/);
 page.closeSheet();assert.equal(page.data.sheet,'');
});
