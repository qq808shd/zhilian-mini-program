const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../miniprogram/utils/learningEngine');
const model = engine.model;
const storage = require('../miniprogram/utils/storage');
const view = require('../miniprogram/utils/learningView');
const content = require('../miniprogram/data/content');
function setup() {
  const local = new Map();
  global.wx = { getStorageSync: key => structuredClone(local.get(key)), setStorageSync: (key,value)=>local.set(key,structuredClone(value)), removeStorageSync:key=>local.delete(key) };
  global.getApp=()=>({globalData:{}});storage.setCloudSyncScheduler(()=>{});return local;
}
const json = value => JSON.parse(JSON.stringify(value));
const assessment = (id,topic,at,rating='none') => ({ id:`${id}:${at}`,kind:'assessment',learningVersion:5,knowledgeId:id,topicId:topic,moduleId:'verbal',at,rating });
test('scoped reset clears learning, exemption, due plans, drafts and cursors while retaining other scopes and question statistics',()=>{
  setup();const now=Date.now();engine.saveStudySettings({topicId:'three-character-word',newCount:3},now-1000);
  const first=engine.dailyView(now-900);engine.saveDraft(first.next,{revealed:true});engine.completeTask(first.next.id,{rating:'none'},now-800);
  const second=engine.dailyView(now-700);engine.completeTask(second.next.id,{excluded:true},now-600);
  const third=engine.dailyView(now-500);engine.saveDraft(third.next,{revealed:true});
  const other=content.knowledge.find(k=>k.topicId==='poetry');engine.setFamiliar(other.id,true,now-400);
  storage.markGroupProgress('three-character-word',0,2,10);view.saveReadingPosition('three-character-word',0,2);
  storage.markGroupProgress('poetry',0,1,2);view.saveReadingPosition('poetry',0,1);
  const q=content.questions[0];storage.recordQuestionResult(q.id,q.moduleId,q.topicId,false);
  const stats=storage.getQuestionStats(),keep=engine.getState().records[other.id],settings=engine.getStudySettings();
  const reset=engine.resetLearning('three-character-word');
  assert.equal(engine.topicSummary('three-character-word').learnedCount,0);assert.equal(engine.reviewItems('three-character-word').length,0);
  assert.equal(engine.getKnowledgeView(second.next.knowledgeId).excluded,false);
  assert.deepEqual(engine.getState().records[other.id],keep);assert.deepEqual(storage.getQuestionStats(),stats);assert.deepEqual(engine.getStudySettings(),settings);
  assert.equal(view.getReadingIndex('three-character-word',0,10),0);assert.equal(storage.getStudyProgress()['three-character-word_0'],undefined);
  assert.equal(view.getReadingIndex('poetry',0,2),1);assert.ok(storage.getStudyProgress().poetry_0);
  const fresh=engine.dailyView();assert.equal(fresh.completed,0);assert.equal(fresh.fresh,3);assert.equal(fresh.next.id,first.next.id);assert.notEqual(fresh.planId,first.planId);
  assert.deepEqual(engine.getDraft(fresh.next),{});assert.deepEqual(engine.getDraft(third.next),{});
  engine.saveDraft(fresh.next,{revealed:true});assert.equal(engine.getDraft(fresh.next).revealed,true);
  assert.ok(engine.completeTask(fresh.next.id,{rating:'remembered'}));assert.equal(engine.topicSummary('three-character-word').learnedCount,1);
  storage.markGroupProgress('three-character-word',0,0,10);view.saveReadingPosition('three-character-word',0,0);
  assert.equal(storage.getStudyProgress()['three-character-word_0'].maxIndex,0);
  assert.ok(engine.getPendingEvents().some(e=>e.id===reset.id));
  const state=model.replay(engine.getPendingEvents());assert.deepEqual(state,engine.getState());
  assert.equal(engine.applySnapshot({learningVersion:5,learningState:state,learningResetVersion:1},engine.getPendingEvents().map(e=>e.id)),true);
  assert.equal(engine.getPendingEvents().length,0);assert.equal(engine.topicSummary('three-character-word').learnedCount,1);
});
test('reset tombstones reject delayed learning and seeds; duplicate reset preserves later learning',()=>{
  const now=Date.now(),old=assessment('k','idiom',now-100),other=assessment('o','poetry',now-100),reset={id:'clear',kind:'reset-learning',learningVersion:5,topicId:'idiom',knowledgeIds:['k'],at:now-50};
  const cleared=model.replay([old,other,reset]);
  const delayed={...old,id:'late-copy'},seed={...old,id:'seed',kind:'seed',learned:true,at:1};
  assert.deepEqual(json(model.replay([delayed,seed],cleared)),json(cleared));
  const fresh=assessment('k','idiom',now-10,'fuzzy');const relearned=model.replay([fresh],cleared);
  assert.equal(relearned.records.k.firstLearnedAt,fresh.at);
  assert.deepEqual(json(model.replay([reset,delayed],relearned)),json(relearned));
  assert.deepEqual(model.replay([fresh,reset,other,old]),model.replay([old,other,reset,fresh]));
});
test('pending reset over a newer cloud snapshot preserves later explicit learning with fresh memory',()=>{
  const now=Date.now(),old=assessment('k','idiom',now-10000,'remembered'),reset={id:'clear',kind:'reset-learning',learningVersion:5,topicId:'idiom',knowledgeIds:['k'],at:now-100},fresh=assessment('k','idiom',now-10,'none');
  const state=model.replay([reset],model.replay([old,fresh]));
  assert.equal(state.records.k.firstLearnedAt,fresh.at);assert.equal(state.records.k.selfRating,'none');
  assert.deepEqual(state.records.k.memory,model.replay([fresh]).records.k.memory);
});
test('old snapshots cannot erase an offline reset; stale cloud progress cannot resurrect it',()=>{
  setup();const k=content.knowledge.find(k=>k.topicId==='idiom');engine.learn(k.id,'remembered');storage.markGroupProgress('idiom',0,8,10);
  const old={learningVersion:5,learningState:structuredClone(engine.getState()),progress:storage.getStudyProgress(),stats:{}};
  const reset=engine.resetLearning('idiom');assert.equal(engine.applySnapshot(old,[reset.id]),false);assert.ok(engine.getPendingEvents().some(e=>e.id===reset.id));
  storage.applyCloudSnapshot(old,[]);assert.equal(storage.getStudyProgress().idiom_0,undefined);assert.equal(engine.getKnowledgeView(k.id).learned,false);
  engine.learn(k.id,'fuzzy');storage.markGroupProgress('idiom',0,0,10);storage.applyCloudSnapshot(old,[]);
  assert.equal(storage.getStudyProgress().idiom_0.maxIndex,0);assert.equal(engine.getKnowledgeView(k.id).learned,true);
});
