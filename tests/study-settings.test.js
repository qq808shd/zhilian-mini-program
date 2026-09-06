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
    navigateTo: o=>navigation.push(o.url), navigateBack: ()=>navigation.push('back'), showToast() {} };
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
  assert.notEqual(next.planId,old.planId);assert.equal(next.fresh,200);assert.equal(next.practice,5);assert.equal(next.subject,'成语');
  assert.deepEqual(engine.ensurePlan().tasks.filter(t=>t.phase==='new').map(t=>t.knowledgeId),content.knowledge.filter(k=>k.topicId==='idiom').slice(0,200).map(k=>k.id));
  const rebuilt=model.replay(engine.getPendingEvents());assert.equal(rebuilt.days[next.day].id,next.planId);
  engine.applySnapshot({learningVersion:4,learningState:rebuilt},engine.getPendingEvents().map(e=>e.id));
  assert.equal(engine.dailyView().planId,next.planId);assert.equal(engine.getStudySettings().newCount,200);
});
test('started plans and drafts survive settings changes; tomorrow uses the latest selection',()=>{
  setup();const old=engine.dailyView();engine.beginTask();engine.saveDraft(old.next,{revealed:true});
  choose('three-character-word',5);const current=engine.dailyView();
  assert.equal(current.planId,old.planId);assert.equal(current.settingsPending,true);assert.equal(engine.getDraft(current.next).revealed,true);
  engine.completeTask(current.next.id,{rating:'remembered'});const completed=engine.dailyView().completed;
  choose('idiom',200);assert.equal(engine.dailyView().completed,completed);
  const next=engine.dailyView(model.afterDays(Date.now(),1)+3600000);assert.equal(next.fresh,200);assert.equal(next.settingsPending,false);assert.equal(next.subject,'成语');
});
test('integer counts and category totals bound daily new learning',()=>{
  for(const count of [1,5,10,37,113]) {setup();choose('three-character-word',count);assert.equal(engine.dailyView().fresh,count);assert.equal(engine.dailyView().practice,Math.min(5,count));}
  setup();choose('poetry',2);assert.equal(engine.dailyView().fresh,2);assert.equal(engine.dailyView().practice,2);
  assert.ok(engine.ensurePlan().tasks.every(t=>content.getKnowledgeById(t.knowledgeId).topicId==='poetry'));
  for(const [topic,count] of [['poetry',3],['three-character-word',114],['idiom',201],['idiom',0],['idiom',1.5],['missing',5]]) assert.throws(()=>choose(topic,count));
});
test('free learning does not silently switch daily preferences; due reviews respect the selected category',()=>{
  setup();choose('idiom',5);const other=content.knowledge.find(k=>k.topicId==='poetry');engine.learn(other.id,'none');
  const tomorrow=engine.dailyView(model.afterDays(Date.now(),1)+1000);
  assert.equal(tomorrow.subject,'成语');assert.equal(tomorrow.due,0);assert.equal(engine.getStudySettings().topicId,'idiom');
});
test('ordered offline settings converge while preserving an already-started canonical plan',()=>{
  setup();const now=Date.now(),day=model.dayKey(now),tasks=[{id:'new:k',phase:'new',knowledgeId:'k',questionId:''}];
  const events=[{kind:'plan',id:'p',at:now,day,tasks},{kind:'begin',id:'b',at:now+1,day,planId:'p',taskId:'new:k'},
    {kind:'preferences',id:'s',at:now+2,settings:{topicId:'poetry',batchId:'',newCount:5}},
    {kind:'plan',id:'p2',at:now+3,day,tasks:[],settings:{id:'s',topicId:'poetry',batchId:'',newCount:5}}];
  const a=model.replay(events),b=model.replay(events.slice().reverse());assert.deepEqual(a,b);assert.equal(a.days[day].id,'p');assert.equal(a.studySettings.topicId,'poetry');
});
test('home has two destinations and free study exposes real module categories',()=>{
  setup();const home=page('study');home.onShow();assert.equal(home.data.recent,undefined);home.onFreeStudy();assert.equal(navigation.at(-1),'/pages/free-study/index');
  home.onSettings();assert.equal(navigation.at(-1),'/pages/study-settings/index');
  const free=page('free-study');free.onShow();assert.equal(free.data.topics.length,5);
  free.onModule(dataset({id:'analysis'}));assert.equal(free.data.topics.length,7);assert.ok(free.data.topics.every(t=>t.moduleId==='analysis'));
  free.onTopic(dataset({id:free.data.topics[0].id}));assert.ok(navigation.at(-1).includes('/pages/group/index?topicId='));
});
test('settings UI saves a selected category/count and cancellation does not mutate preferences',()=>{
  setup();const p=page('study-settings');p.onLoad();const before=engine.getStudySettings();p.onTopic(dataset({id:'three-character-word'}));p.onCount({detail:{value:37}});
  assert.deepEqual(engine.getStudySettings(),before);p.onSave();assert.equal(engine.getStudySettings().topicId,'three-character-word');assert.equal(engine.dailyView().fresh,37);assert.equal(navigation.at(-1),'back');
});

test('slider maxima follow category totals and dragging without saving is inert',()=>{
  setup();const p=page('study-settings');p.onLoad();const before=engine.getStudySettings();
  assert.equal(p.data.maxCount,200);p.onChanging({detail:{value:151}});assert.equal(p.data.newCount,151);assert.equal(p.data.sliderValue,10);p.onCount({detail:{value:200}});assert.equal(p.data.newCount,200);
  p.onTopic(dataset({id:'three-character-word'}));assert.equal(p.data.maxCount,113);assert.equal(p.data.newCount,113);
  p.onTopic(dataset({id:'poetry'}));assert.equal(p.data.maxCount,2);assert.equal(p.data.newCount,2);
  p.onCount({detail:{value:1}});assert.equal(p.data.newCount,1);
  p.onTopic(dataset({id:'idiom'}));assert.equal(p.data.maxCount,200);assert.equal(p.data.newCount,1);
  assert.deepEqual(engine.getStudySettings(),before);
});
test('old batch settings upgrade once and preserve begun tasks, drafts and completions',()=>{
  for(const started of [false,true]) {
    setup();const now=Date.now(),day=model.dayKey(now),k=content.knowledge.find(k=>k.batchId==='photo800');
    const settings={id:'old-pref',topicId:'idiom',batchId:'photo800',newCount:20};
    const tasks=[{id:`new:${k.id}`,phase:'new',knowledgeId:k.id,questionId:''}];
    const events=[{id:settings.id,kind:'preferences',at:now-3,settings},{id:'old-plan',kind:'plan',at:now-2,day,settings,tasks}];
    if(started) events.push({id:'old-begin',kind:'begin',at:now-1,day,planId:'old-plan',taskId:tasks[0].id});
    engine.applySnapshot({learningVersion:4,learningState:model.replay(events)});
    const view=engine.dailyView();
    assert.equal(engine.getStudySettings().batchId,'');assert.equal(view.subject,'成语');
    assert.equal(view.planId==='old-plan',started);
    if(started) {engine.saveDraft(view.next,{revealed:true});assert.equal(engine.getDraft(view.next).revealed,true);engine.completeTask(view.next.id,{rating:'remembered'});assert.equal(engine.dailyView().completed,1);}
    const count=engine.getPendingEvents().filter(e=>e.kind==='preferences').length;
    engine.getStudySettings();engine.dailyView();assert.equal(count,1);assert.equal(engine.getPendingEvents().filter(e=>e.kind==='preferences').length,count);
    assert.deepEqual(model.replay(engine.getPendingEvents(),model.replay(events)),engine.getState());
  }
});
test('old default plans refresh only before learning starts',()=>{
  for(const started of [false,true]) {
    setup();const now=Date.now(),day=model.dayKey(now),k=content.knowledge.find(k=>k.topicId==='idiom');
    const event={id:'old-default',kind:'plan',at:now-2,day,settings:{id:'default',topicId:'idiom',batchId:'original',newCount:10},tasks:[{id:`new:${k.id}`,phase:'new',knowledgeId:k.id,questionId:''}]};
    const events=[event];if(started) events.push({id:'begin',kind:'begin',at:now-1,day,planId:event.id,taskId:event.tasks[0].id});
    engine.applySnapshot({learningVersion:4,learningState:model.replay(events)});
    const view=engine.dailyView();assert.equal(view.planId===event.id,started);assert.equal(view.fresh,started?1:10);
    assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,started?0:1);
    engine.dailyView();assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,started?0:1);
  }
});
test('200 new items complete in order with bounded review, practice and retries',()=>{
  setup();const now=Date.now(),items=content.knowledge.filter(k=>k.topicId==='idiom');
  for(const k of items.slice(0,10)) engine.learn(k.id,'none',now-86400000);
  choose('idiom',200);let view=engine.dailyView();assert.equal(view.total,215);assert.equal(view.due,10);assert.equal(view.fresh,200);assert.equal(view.practice,5);
  let completed=0;
  while(view.next && completed<226) {
    const t=view.next;
    const selected=t.question ? t.question.options.find(o=>o.id!==t.question.answer).id : '';
    assert.ok(engine.completeTask(t.id,{selected,rating:'none'}));completed++;view=engine.dailyView();
  }
  assert.equal(completed,225);assert.equal(view.remaining,0);assert.equal(view.summary.newCount,200);assert.equal(view.summary.reviewCount,10);
  assert.equal(engine.ensurePlan().tasks.filter(t=>t.phase==='retry').length,10);
  assert.equal(engine.getPendingEvents().filter(e=>e.kind==='plan').length,1);
  assert.ok(Buffer.byteLength(JSON.stringify(engine.getPendingEvents().slice(0,200)))<1024*1024);
});
