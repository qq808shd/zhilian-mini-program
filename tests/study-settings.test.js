const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const engine = require('../miniprogram/utils/learningEngine');
const model = engine.model;
const content = require('../miniprogram/data/content');
const storage = require('../miniprogram/utils/storage');
let store, navigation;
function setup() {
  store = new Map(); navigation = [];
  global.getApp = () => ({ globalData: {} });
  global.wx = { getStorageSync: k => structuredClone(store.get(k)), setStorageSync: (k,v) => store.set(k,structuredClone(v)), removeStorageSync: k=>store.delete(k),
    navigateTo: o=>navigation.push(o.url), switchTab: o=>navigation.push(o.url), navigateBack: ()=>navigation.push('back'), setNavigationBarTitle() {}, showToast() {} };
  storage.setCloudSyncScheduler(()=>{});
}
function page(name) {
  const file=path.resolve(__dirname,`../miniprogram/pages/${name}/index.js`);let p;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:createRequire(file),Page:v=>p=v,wx,Date});
  p.data=structuredClone(p.data);p.setData=function(v){Object.assign(this.data,v);};return p;
}
const choose = (topicId, newCount=10) => engine.saveStudySettings({topicId,newCount});
const dataset = v=>({currentTarget:{dataset:v}});

test('settings replace an untouched plan immediately and preserve whole-category order',()=>{
  setup();const old=engine.dailyView();choose('idiom',200);const next=engine.dailyView();
  assert.notEqual(next.planId,old.planId);assert.equal(next.fresh,200);assert.equal(next.total,200);assert.equal(next.subject,'成语');
  assert.deepEqual(engine.ensurePlan().tasks.filter(t=>t.phase==='new').map(t=>t.knowledgeId),content.knowledge.filter(k=>k.topicId==='idiom').slice(0,200).map(k=>k.id));
  const rebuilt=model.replay(engine.getPendingEvents());assert.equal(rebuilt.days[next.sessionKey].id,next.planId);
  engine.applySnapshot({learningVersion:5,learningState:rebuilt},engine.getPendingEvents().map(e=>e.id));
  assert.equal(engine.dailyView().planId,next.planId);assert.equal(engine.getStudySettings().newCount,200);
});
test('scope changes apply immediately and returning restores that scope completion and draft',()=>{
  setup();const old=engine.dailyView();engine.beginTask();engine.saveDraft(old.next,{revealed:true});
  choose('three-character-word',5);const current=engine.dailyView();
  assert.notEqual(current.sessionKey,old.sessionKey);assert.equal(current.subject,'三字词');assert.equal(current.fresh,5);assert.equal(engine.getDraft(current.next).revealed,undefined);
  engine.completeTask(current.next.id,{rating:'remembered'});const nextOther=engine.dailyView().next.id;
  choose('idiom',200);const restored=engine.dailyView();assert.equal(restored.next.id,old.next.id);assert.equal(restored.completed,0);assert.equal(engine.getDraft(restored.next).revealed,true);
  engine.completeTask(restored.next.id,{rating:'none'});assert.equal(engine.dailyView().completed,1);
  choose('three-character-word',5);assert.equal(engine.dailyView().completed,1);assert.equal(engine.dailyView().next.id,nextOther);
  const next=engine.dailyView(model.afterDays(Date.now(),1)+3600000);assert.equal(next.fresh,5);assert.equal(next.subject,'三字词');assert.equal(next.completed,0);
});
test('integer counts and category totals bound daily new learning',()=>{
  for(const count of [1,5,10,37,113]) {setup();choose('three-character-word',count);assert.equal(engine.dailyView().fresh,count);assert.equal(engine.dailyView().total,count);}
  setup();choose('poetry',2);assert.equal(engine.dailyView().fresh,2);assert.equal(engine.dailyView().total,2);
  assert.ok(engine.ensurePlan().tasks.every(t=>content.getKnowledgeById(t.knowledgeId).topicId==='poetry'));
  for(const [topic,count] of [['poetry',3],['three-character-word',114],['idiom',201],['idiom',0],['idiom',1.5],['missing',5]]) assert.throws(()=>choose(topic,count));
});
test('free learning does not silently switch daily preferences; due reviews respect the selected category',()=>{
  setup();choose('idiom',5);const other=content.knowledge.find(k=>k.topicId==='poetry');engine.learn(other.id,'none');
  const tomorrow=engine.dailyView(model.afterDays(Date.now(),1)+1000);
  assert.equal(tomorrow.subject,'成语');assert.equal(tomorrow.due,0);assert.equal(engine.getStudySettings().topicId,'idiom');
  assert.equal(engine.dailyView(model.afterDays(Date.now(),1)+1000,'review','idiom').remaining,0);
  assert.equal(engine.dailyView(model.afterDays(Date.now(),1)+1000,'review','poetry').remaining,1);assert.equal(engine.getStudySettings().topicId,'idiom');
});
test('ordered offline settings converge while preserving an already-started canonical plan',()=>{
  setup();const now=Date.now(),day=model.dayKey(now),tasks=[{id:'new:k',phase:'new',knowledgeId:'k',questionId:''}];
  const events=[{kind:'plan',id:'p',at:now,day,tasks},{kind:'begin',id:'b',at:now+1,day,planId:'p',taskId:'new:k'},
    {kind:'preferences',id:'s',at:now+2,settings:{topicId:'poetry',batchId:'',newCount:5}},
    {kind:'plan',id:'p2',at:now+3,day,tasks:[],settings:{id:'s',topicId:'poetry',batchId:'',newCount:5}}];
  const a=model.replay(events),b=model.replay(events.slice().reverse());assert.deepEqual(a,b);assert.equal(a.days[day].id,'p');assert.equal(a.studySettings.topicId,'poetry');
});
test('home preserves new and review destinations and offers optional practice; scope picker changes real categories',()=>{
  setup();const home=page('study');home.onShow();assert.equal(home.data.recent,undefined);home.onFreeStudy();assert.equal(navigation.at(-1),'/pages/free-study/index');
  home.onToday();assert.equal(navigation.at(-1),'/pages/today-study/index?mode=new');home.onReview();assert.equal(navigation.at(-1),'/pages/today-study/index?mode=review');
  home.onScope();assert.equal(navigation.at(-1),'/pages/free-study/index?mode=scope');home.onPractice();assert.equal(navigation.at(-1),'/pages/exam/index');
  home.onSettings();assert.equal(navigation.at(-1),'/pages/study-settings/index');
  const free=page('free-study');free.onShow();assert.equal(free.data.topics.length,5);
  free.onModule(dataset({id:'analysis'}));assert.equal(free.data.topics.length,7);assert.ok(free.data.topics.every(t=>t.moduleId==='analysis'));
  free.onTopic(dataset({id:free.data.topics[0].id}));assert.ok(navigation.at(-1).includes('/pages/group/index?topicId='));
  const picker=page('free-study');picker.onLoad({mode:'scope'});picker.onShow();picker.onTopic(dataset({id:'poetry'}));assert.equal(engine.getStudySettings().topicId,'poetry');assert.equal(engine.getStudySettings().newCount,2);assert.equal(navigation.at(-1),'back');
});
test('settings edit only the home scope; count changes without saving are inert',()=>{
  setup(); choose('three-character-word',10); const p=page('study-settings');p.onLoad();const before=engine.getStudySettings();
  assert.equal(p.data.topicName,'三字词');assert.equal(p.onTopic,undefined);assert.equal(p.onModule,undefined);
  p.onCount({detail:{value:37}});assert.deepEqual(engine.getStudySettings(),before);
  p.onSave();assert.equal(engine.getStudySettings().topicId,'three-character-word');assert.equal(engine.dailyView().fresh,37);assert.equal(navigation.at(-1),'back');
});
test('slider and precise steps follow current scope bounds without changing scope',()=>{
  for(const [topic,max] of [['idiom',200],['three-character-word',113],['poetry',2]]) {
    setup();choose(topic,1);const p=page('study-settings');p.onLoad();const before=engine.getStudySettings();
    assert.equal(p.data.maxCount,max);p.onChanging({detail:{value:max}});assert.equal(p.data.newCount,max);assert.equal(p.data.sliderValue,1);
    p.onCount({detail:{value:max}});assert.equal(p.data.sliderValue,max);
    p.onStep(dataset({step:1}));assert.equal(p.data.newCount,max);
    p.onCount({detail:{value:1}});p.onStep(dataset({step:-1}));assert.equal(p.data.newCount,1);
    p.onStep(dataset({step:1}));assert.equal(p.data.newCount,2);assert.deepEqual(engine.getStudySettings(),before);
  }
});
test('reset requires scoped confirmation, rejects duplicate taps and preserves other learning',()=>{
  setup();choose('poetry',1);const k=content.knowledge.find(k=>k.topicId==='poetry'),other=content.knowledge.find(k=>k.topicId==='idiom');
  engine.learn(k.id,'none');engine.setFamiliar(other.id,true);const keep=engine.getState().records[other.id];
  const p=page('study-settings');p.onLoad();let modal,calls=0;wx.showModal=o=>{modal=o;calls++;};
  p.onClear();p.onClear();assert.equal(calls,1);assert.ok(modal.title.includes(content.getTopicById('poetry').name));assert.ok(engine.getKnowledgeView(k.id).learned);
  modal.success({confirm:false});modal.complete();assert.ok(engine.getKnowledgeView(k.id).learned);
  p.onClear();modal.success({confirm:true});modal.complete();assert.equal(engine.getKnowledgeView(k.id).learned,false);
  assert.deepEqual(engine.getState().records[other.id],keep);assert.equal(engine.getStudySettings().topicId,'poetry');
  assert.equal(engine.getPendingEvents().filter(e=>e.kind==='reset-learning').length,1);
});
test('stale settings page cannot save or reset a scope silently changed by sync',()=>{
  setup();const p=page('study-settings');p.onLoad();choose('poetry',1);const before=engine.getStudySettings();p.onSave();
  assert.deepEqual(engine.getStudySettings(),before);assert.equal(p.data.topicId,'poetry');assert.equal(navigation.length,0);
  let modal;wx.showModal=o=>modal=o;p.onClear();choose('idiom',5);modal.success({confirm:true});modal.complete();
  assert.equal(engine.getPendingEvents().filter(e=>e.kind==='reset-learning').length,0);
});
test('old batch settings upgrade once into scoped plans while preserving legacy records and drafts',()=>{
  for(const started of [false,true]) {
    setup();const now=Date.now(),day=model.dayKey(now),k=content.knowledge.find(k=>k.batchId==='photo800');
    const settings={id:'old-pref',topicId:'idiom',batchId:'photo800',newCount:20};
    const tasks=[{id:`new:${k.id}`,phase:'new',knowledgeId:k.id,questionId:''}];
    const events=[{id:settings.id,kind:'preferences',at:now-3,settings},{id:'old-plan',kind:'plan',at:now-2,day,settings,tasks}];
    if(started) events.push({id:'old-begin',kind:'begin',at:now-1,day,planId:'old-plan',taskId:tasks[0].id});
    engine.applySnapshot({learningVersion:5,learningState:model.replay(events)});
    if(started) store.set('zhilian_daily_draft_v4',{day,taskId:tasks[0].id,revealed:true});
    const view=engine.dailyView();
    assert.equal(engine.getStudySettings().batchId,'');assert.equal(view.subject,'成语');
    assert.notEqual(view.planId,'old-plan');assert.equal(view.next.knowledgeId,k.id);assert.equal(view.fresh,20);assert.equal(engine.getState().days[day].id,'old-plan');
    if(started) {assert.equal(engine.getState().days[day].started[tasks[0].id],true);assert.equal(engine.getDraft(view.next).revealed,true);engine.completeTask(view.next.id,{rating:'remembered'});assert.equal(engine.dailyView().completed,1);}
    const count=engine.getPendingEvents().filter(e=>e.kind==='preferences').length;
    engine.getStudySettings();engine.dailyView();assert.equal(count,1);assert.equal(engine.getPendingEvents().filter(e=>e.kind==='preferences').length,count);
    assert.deepEqual(model.replay(engine.getPendingEvents(),model.replay(events)),engine.getState());
  }
});
test('old default plans remain available while V5 creates stable independent new sessions',()=>{
  for(const started of [false,true]) {
    setup();const now=Date.now(),day=model.dayKey(now),k=content.knowledge.find(k=>k.topicId==='idiom');
    const event={id:'old-default',kind:'plan',at:now-2,day,settings:{id:'default',topicId:'idiom',batchId:'original',newCount:10},tasks:[{id:`new:${k.id}`,phase:'new',knowledgeId:k.id,questionId:''}]};
    const events=[event];if(started) events.push({id:'begin',kind:'begin',at:now-1,day,planId:event.id,taskId:event.tasks[0].id});
    engine.applySnapshot({learningVersion:5,learningState:model.replay(events)});
    const view=engine.dailyView();assert.notEqual(view.planId,event.id);assert.equal(view.fresh,10);assert.equal(view.next.knowledgeId,k.id);
    assert.equal(engine.getState().days[day].id,event.id);if(started) assert.equal(engine.getState().days[day].started[event.tasks[0].id],true);
    assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,1);
    engine.dailyView();assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,1);
  }
});
test('200 new items complete independently of due reviews without adding practice or retries',()=>{
  setup();const now=Date.now(),items=content.knowledge.filter(k=>k.topicId==='idiom');
  for(const k of items.slice(0,10)) engine.learn(k.id,'none',now-86400000);
  choose('idiom',200);let view=engine.dailyView();assert.equal(view.total,200);assert.equal(view.due,10);assert.equal(view.fresh,200);
  let completed=0;
  while(view.next && completed<201) {
    const t=view.next;
    assert.ok(engine.completeTask(t.id,{rating:'none'}));completed++;view=engine.dailyView();
  }
  assert.equal(completed,200);assert.equal(view.remaining,0);assert.equal(view.summary.newCount,200);assert.equal(view.summary.reviewCount,0);
  assert.ok(engine.ensurePlan().tasks.every(t=>t.phase==='new'));
  let review=engine.dailyView(Date.now(),'review');assert.equal(review.remaining,10);let reviewed=0;
  while(review.next && reviewed<11) {assert.ok(engine.completeTask(review.next.id,{rating:'none'},Date.now(),'review'));reviewed++;review=engine.dailyView(Date.now(),'review');}
  assert.equal(reviewed,10);assert.equal(review.remaining,0);assert.equal(review.summary.reviewCount,10);assert.ok(engine.ensurePlan(Date.now(),'review').tasks.every(t=>t.phase==='review'));
  assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,2);
  assert.ok(Buffer.byteLength(JSON.stringify(engine.getPendingEvents().slice(0,200)))<1024*1024);
});
