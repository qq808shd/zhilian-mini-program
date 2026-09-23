const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const memory=new Map(),calls=[];let remote={userId:'a',revision:0},fail=false,allowed=true,restored;
 const local={getProfile:()=>({nickname:'同学',avatar:'saved.png'}),restoreProfile:p=>restored=p};
 const request=async o=>{calls.push(o);if(o.method==='PUT'){if(fail)throw Error('offline');remote={...remote,...o.data,revision:1};}return remote;};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync('miniprogram/utils/profileSync.js','utf8'),{module:m,require:n=>n==='./cloudSync'?{requestAuthenticated:request}:n==='./profile'?local:n==='./account'?{isSyncAuthorized:()=>allowed}:{prepareAvatar:async()=> 'data:image/png;base64,test'},wx:{getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,v),removeStorageSync:k=>memory.delete(k)},Promise,Error});
 return {sync:m.exports,calls,memory,remote:()=>remote,restored:()=>restored,setFail:v=>fail=v,setAllowed:v=>allowed=v,setRemote:v=>remote=v};
}
test('profile save uploads one unified name and image and restore recovers them',async()=>{const f=setup();await f.sync.save();assert.equal(f.calls.find(c=>c.method==='PUT').data.nickname,'同学');assert.equal(f.calls.find(c=>c.method==='PUT').data.revision,0);await f.sync.restore();assert.equal(f.restored().nickname,'同学');});
test('pending profile survives offline error and retries after restoring access',async()=>{const f=setup();f.setFail(true);await assert.rejects(f.sync.save(),/offline/);assert.equal(f.memory.size,1);f.setFail(false);await f.sync.restore();assert.equal(f.memory.size,0);assert.equal(f.restored().nickname,'同学');});
test('pending profile is never sent as another user and no requests occur without consent',async()=>{const f=setup();f.setFail(true);await assert.rejects(f.sync.save());f.setRemote({userId:'b',revision:0});f.setFail(false);const before=f.calls.length;await f.sync.restore();assert.equal(f.calls.length,before+1);f.setAllowed(false);await f.sync.restore();assert.equal(f.calls.length,before+1);});
