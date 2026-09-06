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
const choose = (topicId, newCount=10, batchId='') => engine.saveStudySettings({topicId,newCount,batchId});
const dataset = v=>({currentTarget:{dataset:v}});

test('settings replace an untouched plan immediately, persist and restrict all tasks to the chosen batch',()=>{
  setup();const old=engine.dailyView();choose('idiom',20,'photo800');const next=engine.dailyView();
  assert.notEqual(next.planId,old.planId);assert.equal(next.fresh,20);assert.equal(next.practice,5);assert.equal(next.subject,'成语 · 800词补充');
  assert.ok(engine.ensurePlan().tasks.every(t=>content.getKnowledgeById(t.knowledgeId).batchId==='photo800'));
  const rebuilt=model.replay(engine.getPendingEvents());assert.equal(rebuilt.days[next.day].id,next.planId);
  engine.applySnapshot({learningVersion:4,learningState:rebuilt},engine.getPendingEvents().map(e=>e.id));
  assert.equal(engine.dailyView().planId,next.planId);assert.equal(engine.getStudySettings().newCount,20);
});
test('started plans and drafts survive settings changes; tomorrow uses the latest selection',()=>{
  setup();const old=engine.dailyView();engine.beginTask();engine.saveDraft(old.next,{revealed:true});
  choose('three-character-word',5);const current=engine.dailyView();
  assert.equal(current.planId,old.planId);assert.equal(current.settingsPending,true);assert.equal(engine.getDraft(current.next).revealed,true);
  engine.completeTask(current.next.id,{rating:'remembered'});const completed=engine.dailyView().completed;
  choose('idiom',20,'photo800');assert.equal(engine.dailyView().completed,completed);
  const next=engine.dailyView(model.afterDays(Date.now(),1)+3600000);assert.equal(next.fresh,20);assert.equal(next.settingsPending,false);assert.equal(next.subject,'成语 · 800词补充');
});
test('count choices are bounded; small categories never fill with unrelated knowledge',()=>{
  for(const count of [5,10,20]) {setup();choose('three-character-word',count);assert.equal(engine.dailyView().fresh,count);assert.equal(engine.dailyView().practice,5);}
  setup();choose('poetry',20);assert.equal(engine.dailyView().fresh,2);assert.equal(engine.dailyView().practice,2);
  assert.ok(engine.ensurePlan().tasks.every(t=>content.getKnowledgeById(t.knowledgeId).topicId==='poetry'));
  assert.throws(()=>choose('poetry',100));assert.throws(()=>choose('poetry',5,'photo800'));assert.throws(()=>choose('missing',5));
});
test('free learning does not silently switch daily preferences; due reviews respect the selected range',()=>{
  setup();choose('idiom',5,'original');const other=content.knowledge.find(k=>k.topicId==='poetry');engine.learn(other.id,'none');
  const tomorrow=engine.dailyView(model.afterDays(Date.now(),1)+1000);
  assert.equal(tomorrow.subject,'成语 · 原有高频词库');assert.equal(tomorrow.due,0);assert.equal(engine.getStudySettings().topicId,'idiom');
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
  setup();const p=page('study-settings');p.onLoad();const before=engine.getStudySettings();p.onTopic(dataset({id:'three-character-word'}));p.onCount(dataset({count:5}));
  assert.deepEqual(engine.getStudySettings(),before);p.onSave();assert.equal(engine.getStudySettings().topicId,'three-character-word');assert.equal(engine.dailyView().fresh,5);assert.equal(navigation.at(-1),'back');
});
