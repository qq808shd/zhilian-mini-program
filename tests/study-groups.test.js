const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {fixture}=require('../server/test/group-fixture');
const view=require('../miniprogram/utils/groupView');
function page(name, api, wx={}) {
  const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/index.js');let p;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>p=d,require:n=>n==='../../utils/groupApi'?api:createRequire(file)(n),wx,console,Date,Math,setTimeout,clearTimeout});
  p.data=structuredClone(p.data);p.setData=data=>Object.assign(p.data,data);return p;
}
function fixturePage(t, type='duration') {
  const f=fixture();t.after(f.close);const user=f.user('front');let d=f.create(user,type==='quantity'?{baselineType:'quantity',baselineUnit:'题',baselineValue:20}:{});
  const writes=[],nav=[];let error=null;
  const api={requestId:()=>f.request({}).requestId,read:async()=>f.service.dashboard(user),errorText:e=>e.message,write:async(p,data,method)=>{writes.push({p,data,method});if(error)throw error;if(p==='/today')return f.service.writeToday(user,data,method==='PATCH'?'set':'add');}};
  const p=page('study-group',api,{navigateTo:d=>nav.push(d.url),setClipboardData(){},showModal(){},stopPullDownRefresh(){}});
  p.setData(view.dashboard(d));return {f,p,api,writes,nav,user,error:e=>{error=e;}};
}
test('frontend empty state is real no-membership response, never network failure',async t=>{
  const p=page('study-group',{read:async()=>({group:null,rules:{maxMembers:8},date:'2026-09-07'}),errorText:e=>e.message});await p.load();assert.equal(p.data.ready,true);assert.equal(p.data.group,null);
  const q=page('study-group',{read:async()=>{throw new Error('network');},errorText:e=>e.message});await q.load();assert.equal(q.data.ready,false);assert.equal(q.data.error,'network');
});
test('join day, quantity, fulfilled, day off and observer present independent contract states',async t=>{
  const {f,p,user}=fixturePage(t,'quantity');assert.equal(p.data.cardTitle,'今日加入');assert.equal(p.data.canLeave,false);
  f.day('2026-09-08');await p.load();assert.equal(p.data.canLeave,true);assert.match(p.data.cardHint,/20 题/);
  f.record(user,20);await p.load();assert.equal(p.data.cardTitle,'今日已履约');assert.equal(p.data.progress,100);
  f.leave(user);f.record(user,10);await p.load();assert.equal(p.data.cardTitle,'今日请假');assert.equal(p.data.canLeave,false);assert.match(p.data.cardHint,/30 题/);
  f.day('2026-09-11');await p.load();assert.equal(p.data.me.status,'observer');assert.equal(p.data.cardTitle,'当前处于旁听席');assert.equal(p.data.canLeave,false);
});
test('bottom sheet adds then corrects cumulative daily value; validation rejects bad inputs',async t=>{
  const {p,f,user,writes}=fixturePage(t);p.onRecord();assert.equal(p.data.sheet,'record');
  for(const input of ['', '0','-1','1.5','1441']){p.onInput({detail:{value:input}});await p.onSaveRecord();assert.ok(p.data.sheetError);}
  assert.equal(writes.length,0);p.onInput({detail:{value:'600'}});await p.onSaveRecord();assert.equal(f.service.dashboard(user).me.today.value,600);
  p.onRecord();p.onRecordMode({currentTarget:{dataset:{mode:'set'}}});p.onInput({detail:{value:'60'}});await p.onSaveRecord();assert.equal(writes.at(-1).method,'PATCH');assert.equal(f.service.dashboard(user).me.today.value,60);
  p.onRecord();p.onRecordMode({currentTarget:{dataset:{mode:'set'}}});p.onInput({detail:{value:'0'}});await p.onSaveRecord();assert.equal(f.service.dashboard(user).me.today.value,0);
});
test('network uncertain retry reuses operation id and is not shown as success',async t=>{
  const {p,writes,error}=fixturePage(t);error(new Error('网络中断'));p.onRecord();p.onInput({detail:{value:'40'}});await p.onSaveRecord();assert.equal(p.data.sheet,'record');assert.match(p.data.sheetError,/网络/);
  await p.onSaveRecord();assert.equal(writes[0].data.requestId,writes[1].data.requestId);
  error(null);await p.onSaveRecord();assert.equal(p.data.sheet,'');assert.equal(p.data.me.today.value,40);
});
test('sheet cancel does not write; share targets contract preview; group invite preserved at welcome',t=>{
  const {p,writes,nav}=fixturePage(t);p.onRecord();p.closeSheet();assert.equal(writes.length,0);assert.match(p.onShareAppMessage().path,/pages\/group-join\/index\?code=/);p.onJoin();assert.equal(nav[0],'/pages/group-join/index');
  const navigation=fs.readFileSync(path.resolve(__dirname,'../miniprogram/utils/accountNavigation.js'),'utf8');assert.ok(navigation.includes('"group-join"'));
});
test('creation validation, immutable configuration, acceptance and request retry',async()=>{
  const writes=[],nav=[];const api={requestId:()=> 'front-test-request',write:async(...args)=>writes.push(args),errorText:e=>e.message};
  const p=page('group-create',api,{switchTab:d=>nav.push(d.url)});await p.onSubmit();assert.ok(p.data.error);assert.equal(writes.length,0);
  p.setData({name:'组',studyTopic:'行测',nickname:'同学',baselineValue:'0',accepted:true});await p.onSubmit();assert.equal(writes.length,0);
  p.setData({baselineValue:'60',accepted:false});await p.onSubmit();assert.equal(writes.length,0);
  p.setData({accepted:true});await p.onSubmit();assert.equal(writes[0][1].baselineValue,60);assert.equal(nav[0],'/pages/study-group/index');
});
test('invite requires preview and acceptance; preview does not join automatically',async()=>{
  let writes=0;const api={requestId:()=> 'front-test-request',errorText:e=>e.message,read:async()=>({group:{name:'组',count:1},rules:{maxMembers:8}}),write:async()=>writes++};
  const p=page('group-join',api,{switchTab(){}});p.setData({code:'ABC234'});await p.onPreview();assert.ok(p.data.preview);assert.equal(writes,0);await p.onJoin();assert.equal(writes,0);
  p.setData({accepted:true,nickname:'同学'});await p.onJoin();assert.equal(writes,1);
});
test('group data boundary does not import learning, content, personal profile or user-supplied auth',()=>{
  for(const file of ['groupRules','groupView','groupApi'])assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname,'../miniprogram/utils/'+file+'.js'),'utf8'),/require\(['"].*(learningEngine|storage|data\/content|profile)['"]\)/);
});
test('bottom sheets hide native custom tab layer and restore it on close or leaving page',t=>{
  const {p}=fixturePage(t);const bar={data:{hidden:false},setData(d){Object.assign(this.data,d);}};p.getTabBar=()=>bar;
  p.onRecord();assert.equal(bar.data.hidden,true);p.closeSheet();assert.equal(bar.data.hidden,false);
  p.onRules();assert.equal(bar.data.hidden,true);p.onHide();assert.equal(bar.data.hidden,false);
});
test('nearly complete quantity does not display a full progress bar',t=>{
  const {f,user}=fixturePage(t,'quantity');f.day('2026-09-08');f.record(user,19);const d=view.dashboard(f.service.dashboard(user));assert.equal(d.progress,95);assert.equal(d.cardTitle,'今日学习');
});
test('group errors distinguish WeChat domain blocking, timeout and undeployed service',()=>{
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../miniprogram/utils/groupApi.js'),'utf8'),{module,require:()=>({requestAuthenticated(){throw new Error('No network in presentation test');}})});
  const format=module.exports.errorText;
  assert.match(format({errMsg:'request:fail url not in domain list'}),/合法域名校验拦截/);
  assert.match(format({errMsg:'request:fail timeout'}),/超时/);
  assert.match(format({statusCode:404,code:'NOT_FOUND',message:'接口不存在'}),/服务暂未开放/);
  assert.equal(format({message:'本周请假机会已使用'}),'本周请假机会已使用');
  assert.match(format({code:'SYNC_STOPPED'}),/同意当前协议/);
  assert.match(format({errMsg:'request:fail disconnected'}),/检查网络/);
});
