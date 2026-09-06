const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const content = require('../miniprogram/data/content');
const engine = require('../miniprogram/utils/learningEngine');
const model = require('../miniprogram/utils/learningModel');
const storage = require('../miniprogram/utils/storage');
let store, app, navigation;
function setup() {
  store = new Map(); app = { globalData: {} }; navigation = [];
  global.getApp = () => app;
  global.wx = {
    getStorageSync: (k) => structuredClone(store.get(k)), setStorageSync: (k,v) => store.set(k, structuredClone(v)), removeStorageSync: (k) => store.delete(k),
    setNavigationBarTitle() {}, pageScrollTo() {}, showToast() {},
    navigateTo: (o) => navigation.push(o.url), switchTab: (o) => navigation.push(o.url), navigateBack() {},
    showModal: (o) => o.success({ confirm: true })
  };
  storage.setCloudSyncScheduler(() => {});
}
function page(name) {
  const file = path.resolve(__dirname, `../miniprogram/pages/${name}/index.js`); let p;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require: createRequire(file), Page: (v) => { p = v; }, wx, getApp, Date, console, setTimeout: (fn) => fn(), setInterval: () => 1, clearInterval() {} });
  p.data = structuredClone(p.data);
  p.setData = function(values) { for (const [key,v] of Object.entries(values)) { const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.'); let target = this.data; for (const part of parts.slice(0,-1)) target = target[part]; target[parts.at(-1)] = v; } };
  return p;
}
const event = (dataset) => ({ currentTarget: { dataset } });
const first = content.knowledge[0];
function answer(id, correct, at) {
  const q = content.questions.find((q) => q.knowledgeId === id);
  storage.recordQuestionResult(q.id, q.moduleId, q.topicId, correct, { answeredAt: at }); return q;
}
function finishCurrent(now, incorrect = false) {
  const v = engine.dailyView(now), t = v.next;
  return engine.completeTask(t.id, t.question ? { selected: incorrect ? t.question.options.find((o) => o.id !== t.question.answer).id : t.question.answer } : { rating: 'remembered' }, now);
}

test('V4 new user gets bounded stable plan: new 10, matching practice 5, no invented outcomes', () => {
  setup(); const v = engine.dailyView(); assert.equal(v.fresh,10); assert.equal(v.practice,5); assert.equal(v.due,0); assert.equal(v.total,15);
  assert.equal(v.summary.accuracy,null); assert.equal(engine.overview().masteredCount,0); assert.equal(engine.overview().sevenDayAccuracy,null);
  assert.deepEqual(engine.dailyView(), v);
});
test('V4 resume skips completed tasks and preserves unfinished draft across page recreation', () => {
  setup(); const p = page('today-study'); p.onLoad(); p.onShow(); const id = p.data.task.id;
  p.onReveal(); p.onRate(event({value:'fuzzy'}));
  const reopened = page('today-study'); reopened.onLoad(); reopened.onShow(); assert.equal(reopened.data.task.id,id); assert.equal(reopened.data.revealed,true); assert.equal(reopened.data.rating,'fuzzy');
  reopened.onContinue(); const next = engine.dailyView().next.id; assert.notEqual(next,id);
  const home = page('study'); home.onShow(); assert.equal(home.data.daily.button,'继续今日学习'); assert.equal(home.data.daily.completed,1);
  const third = page('today-study'); third.onShow(); assert.equal(third.data.task.id,next);
});
test('V4 group unfinished -> matching direct practice -> next group, never completed final card', () => {
  setup(); const set = content.getKnowledgeSet('idiom',0);
  engine.learn(set.items[0].id); assert.equal(engine.groupAction('idiom',0).label,'继续学习');
  set.items.slice(1).forEach((k) => engine.learn(k.id));
  const action = engine.groupAction('idiom',0); assert.equal(action.type,'practice'); assert.equal(action.learnedCount,20);
  engine.navigateAction(action); const req = app.globalData.examRequest; assert.equal(req.direct,true); assert.equal(req.count,5);
  assert.ok(req.questionIds.every((id) => set.items.some((k) => content.getQuestionById(id).knowledgeId === k.id)));
  const e = page('exam'); e.onShow(); assert.equal(e.data.state,'exam'); assert.equal(e.data.examQuestions.length,5);
  e.data.examQuestions.forEach((q,i) => { e.goToQuestion(i); e.onChooseOption(event({id:q.answer})); e.onConfirm(); }); e.submitExam();
  assert.equal(engine.groupAction('idiom',0).type,'next');
});
test('V4 merely swiping cards does not mark formal learning complete', () => {
  setup(); const p=page('learn'); p.onLoad({topicId:'idiom',setIndex:'0'}); p.onSwiperChange({detail:{current:19}});
  assert.equal(engine.topicSummary('idiom').learnedCount,0); assert.equal(p.data.groupComplete,false);
  p.onReveal(event({index:19})); p.onNext(); assert.equal(engine.topicSummary('idiom').learnedCount,1);
});
test('V4 wrong -> retry once -> correct stays consolidating and is due tomorrow', () => {
  setup(); const now = Date.now(); const q=answer(first.id,false,now);
  engine.saveStudySettings({ topicId: q.topicId, batchId: "", newCount: 10 }, now);
  assert.equal(engine.reviewItems()[0].state,'due');
  const v=engine.dailyView(); assert.equal(v.next.phase,'review'); assert.equal(v.next.question.id,q.id);
  finishCurrent(Date.now(),true); assert.equal(engine.ensurePlan().tasks.filter((t)=>t.phase==='retry').length,1);
  const tomorrow=model.afterDays(Date.now(),1); answer(first.id,true,Date.now());
  const r=engine.getState().records[first.id]; assert.equal(r.reviewStage,1); assert.equal(r.nextReviewAt,tomorrow); assert.equal(model.status(r,Date.now()),'consolidating');
});
test('V4 spaced intervals are 1 / 3 / 7 days; only due cross-day correct reaches mastery; wrong resets', () => {
  let at=model.dayStart(Date.now())+12*3600000; let r;
  const apply=(correct)=> { r=model.updateRecord(r,{kind:'answer',knowledgeId:'k',moduleId:'m',topicId:'t',at,correct}); };
  apply(false); apply(true); assert.equal(r.reviewStage,1); assert.equal(r.nextReviewAt,model.afterDays(at,1));
  for(let i=0;i<5;i++) apply(true); assert.equal(r.reviewStage,1);
  at=r.nextReviewAt; apply(true); assert.equal(r.reviewStage,2); assert.equal(r.nextReviewAt,model.afterDays(at,3));
  at+=model.DAY; apply(true); assert.equal(r.reviewStage,2,'early review does not advance');
  at=r.nextReviewAt; apply(true); assert.equal(r.reviewStage,3); assert.equal(r.nextReviewAt,model.afterDays(at,7));
  at=r.nextReviewAt; apply(true); assert.equal(model.status(r,at),'mastered'); apply(false); assert.equal(r.reviewStage,0); assert.equal(model.status(r,at),'due');
});
test('V4 self ratings change schedules but remembered alone never means mastery', () => {
  setup(); const now=Date.now(); const ids=content.knowledge.slice(0,3).map(k=>k.id);
  engine.learn(ids[0],'none',now); engine.learn(ids[1],'fuzzy',now); engine.learn(ids[2],'remembered',now);
  const records=engine.getState().records;
  assert.ok(records[ids[0]].nextReviewAt<=Date.now()+5); assert.equal(records[ids[1]].nextReviewAt,model.afterDays(now,1));
  assert.equal(records[ids[2]].reviewStage,0); assert.equal(engine.overview().masteredCount,0);
});
test('V4 completed daily loop is bounded, duplicate completion is inert, next day creates new work', () => {
  setup(); let rounds=0; const now=Date.now();
  while(engine.dailyView(now).next && rounds<50) { const t=engine.dailyView(now).next; finishCurrent(now,!!t.question); rounds++; }
  const done=engine.dailyView(now); assert.ok(rounds<=35); assert.equal(done.remaining,0); assert.ok(done.summary.weakCount>0); assert.equal(done.summary.newCount,10);
  assert.equal(engine.completeTask('new:'+first.id,{},now),false); assert.equal(engine.dailyView(now).total,done.total);
  const next=engine.dailyView(model.afterDays(now,1)+3600000); assert.notEqual(next.day,done.day); assert.equal(next.next.phase,'review'); assert.equal(next.completed,0);
});
test('V4 search and detail queries leave formal state unchanged', () => {
  setup(); const before=engine.getState(); const c=page('catalog'); c.onLoad({}); c.applyFilter(first.title); c.onToggleDetail(event({id:first.id}));
  const d=page('detail'); d.onLoad({id:first.id}); d.onToggleAnswer(); assert.deepEqual(engine.getState(),before);
  assert.equal(c.data.total,1044);
});
test('V4 migration is idempotent, preserves counters, and does not manufacture mastery or seven-day history', () => {
  setup(); storage.markGroupProgress('idiom',0,19,20);
  const q=content.questions[0]; store.set('zhilian_question_stats_v3',{[q.id]:{questionId:q.id,moduleId:q.moduleId,topicId:q.topicId,attempts:9,wrong:6,correct:3,activeWrong:true}});
  const before=structuredClone(storage.getQuestionStats()); const state=engine.getState(); const count=engine.getPendingEvents().length;
  assert.equal(engine.topicSummary('idiom').learnedCount,20); assert.equal(engine.overview().masteredCount,0); assert.equal(engine.overview().sevenDayAccuracy,null);
  assert.equal(model.status(state.records[q.knowledgeId],Date.now()),'due'); engine.getState(); assert.equal(engine.getPendingEvents().length,count+1,'only the daily plan was added by overview');
  assert.deepEqual(storage.getQuestionStats(),before);
});
test('V4 cloud snapshot plus pending offline events preserves self-rating and exact next task', () => {
  setup(); finishCurrent(Date.now()); const events=engine.getPendingEvents(); const remote=model.replay(events); const next=engine.dailyView().next.id;
  finishCurrent(Date.now()); const pending=engine.getPendingEvents().filter(e=>!events.some(x=>x.id===e.id));
  engine.applySnapshot({learningVersion:4,learningState:remote},events.map(e=>e.id));
  assert.deepEqual(engine.getPendingEvents(),pending); assert.equal(engine.dailyView().completed,2); assert.notEqual(engine.dailyView().next.id,next);
  const all=engine.getPendingEvents(); assert.equal(engine.applySnapshot({}),false); assert.deepEqual(engine.getPendingEvents(),all);
});
test('V4 local learning and counters need no network and daily answers are idempotent on recovery', () => {
  setup(); wx.request=wx.login=()=>{throw Error('no network permitted');};
  while(engine.dailyView().next.phase==='new') finishCurrent(Date.now());
  const t=engine.dailyView().next; finishCurrent(Date.now()); engine.repairDailyAnswers(); engine.repairDailyAnswers();
  assert.equal(storage.getQuestionStats()[t.question.id].attempts,1); assert.ok(engine.getPendingEvents().length>0);
});
test('V4 assessment recommendation directly starts only wrong questions', () => {
  setup(); const e=page('exam'); e.setData({sessionMode:'assessment'}); const qs=content.questions.slice(0,2); e.startWithQuestions(qs);
  e.onChooseOption(event({id:qs[0].answer})); e.submitExam();
  assert.equal(e.data.recommendation.type,'retry'); assert.equal(e.data.recommendation.questionIds.length,1);
  e.onRetryWrong(); assert.equal(e.data.state,'exam'); assert.equal(e.data.sessionMode,'practice'); assert.equal(e.data.examQuestions[0].id,qs[1].id);
});
test('V4 empty bank remainder and unknown exercise references have usable summary and recall fallback', () => {
  setup(); const value=engine.getState(); content.knowledge.forEach(k=>{value.records[k.id]={knowledgeId:k.id,topicId:k.topicId,moduleId:k.moduleId,firstLearnedAt:1,reviewStage:4,nextReviewAt:0};});
  const saved=store.get('zhilian_learning_v4'); saved.state=value; store.set('zhilian_learning_v4',saved);
  const v=engine.dailyView(); assert.equal(v.total,0); assert.equal(v.progress,100); assert.equal(v.summary.accuracy,null); assert.equal(v.next,null);
});
test('V4 reset removes answer-derived weakness but preserves learned knowledge and daily completion', () => {
  setup(); while(engine.dailyView().next.phase==='new') finishCurrent(Date.now()); finishCurrent(Date.now(),true);
  const completed=engine.dailyView().completed, learned=engine.topicSummary().learnedCount;
  storage.clearQuestionStats(); engine.repairDailyAnswers();
  assert.deepEqual(storage.getQuestionStats(),{}); assert.equal(engine.dailyView().completed,completed); assert.equal(engine.topicSummary().learnedCount,learned); assert.equal(engine.overview().sevenDayAccuracy,null);
});
test('V4 original content IDs, counts, associations and strict batch order remain intact', () => {
  assert.equal(content.knowledge.length,1044); assert.equal(content.questions.length,1089); assert.equal(content.getKnowledgeByTopic('idiom').length,888);
  assert.equal(new Set(content.knowledge.map(k=>k.id)).size,1044); assert.equal(new Set(content.questions.map(q=>q.id)).size,1089);
  content.questions.forEach(q=>{assert.ok(content.getKnowledgeById(q.knowledgeId));assert.ok(q.options.some(o=>o.id===q.answer));});
  content.topics.forEach(t=>assert.deepEqual(content.getSetsForTopic(t.id).flatMap(s=>s.items.map(k=>k.id)),content.getKnowledgeByTopic(t.id).map(k=>k.id)));
  assert.equal(content.getKnowledgeSet('idiom',7).count,13); assert.equal(content.getKnowledgeSet('idiom',44).count,15);
});

test('V4 first connection on a new device imports legacy cloud records without invented history', () => {
  setup(); engine.getState();
  const q=content.questions[0];
  const remote={initialized:true,learningVersion:4,learningState:model.emptyState(),progress:{idiom_0:{topicId:'idiom',setIndex:0,maxIndex:4}},stats:{[q.id]:{questionId:q.id,activeWrong:true,wrong:3}}};
  engine.importLegacySnapshot(remote); const size=engine.getPendingEvents().length; engine.importLegacySnapshot(remote);
  assert.equal(engine.getPendingEvents().length,size); assert.equal(engine.topicSummary('idiom').learnedCount,5); assert.equal(engine.overview().sevenDayAccuracy,null);
  setup();
  const shared=content.questions.find(q=>content.questions.filter(other=>other.knowledgeId===q.knowledgeId).length>1);
  const pair=content.questions.filter(q=>q.knowledgeId===shared.knowledgeId).slice(0,2);
  storage.recordQuestionResult(shared.id,shared.moduleId,shared.topicId,true);
  engine.importLegacySnapshot({initialized:true,learningVersion:4,learningState:model.emptyState(),progress:{},stats:Object.fromEntries(pair.map((q,i)=>[q.id,{questionId:q.id,activeWrong:true,wrong:i+2}]))});
  assert.equal(engine.getState().records[shared.knowledgeId].wrongCount,5,'multiple legacy questions aggregate under their knowledge');
  assert.equal(engine.getState().records[shared.knowledgeId].reviewStage,1,'new local learning replays after the cloud legacy baseline');
});
test('V4 concurrent offline plans keep a bounded canonical plan and retain the other device learning', () => {
  const at=Date.now(), day=model.dayKey(at);
  const p1={id:'plan-a',at,kind:'plan',day,tasks:[{id:'new:a',phase:'new',knowledgeId:'a',questionId:''}]};
  const p2={id:'plan-b',at:at+10,kind:'plan',day,tasks:[{id:'new:b',phase:'new',knowledgeId:'b',questionId:''}]};
  const done={id:'done-b',at:at+20,kind:'learn',knowledgeId:'b',topicId:'t',moduleId:'m',day,planId:p2.id,taskId:'new:b',phase:'new'};
  const state=model.replay([done,p2,p1]); assert.equal(state.days[day].id,p1.id); assert.equal(state.days[day].tasks.length,1); assert.ok(state.records.b.firstLearnedAt); assert.ok(state.days[day].extraCompleted['done-b']);
});
test('V4 task without a matching question falls back to recall, and double confirm never advances twice', () => {
  setup(); const now=Date.now(), day=model.dayKey(now); const saved=store.get('zhilian_learning_v4') || {version:4,base:model.emptyState(),state:model.emptyState(),pending:[]};
  const plan={id:'recall-plan',at:now,kind:'plan',day,tasks:[{id:'review:'+first.id,phase:'review',knowledgeId:first.id,questionId:'removed-question'}]};
  saved.pending=[plan]; saved.state=model.replay([plan]); store.set('zhilian_learning_v4',saved);
  const task=engine.dailyView().next; assert.equal(task.question,null); assert.equal(engine.completeTask(task.id,{rating:'remembered'}),true); assert.equal(engine.completeTask(task.id,{rating:'remembered'}),false); assert.equal(engine.dailyView().completed,1);
});

test('V4 the same task completed on another offline plan is not repeated on the canonical plan', () => {
  const at=Date.now(),day=model.dayKey(at),task={id:'new:a',knowledgeId:'a',phase:'new',questionId:''};
  const events=[{id:'p1',kind:'plan',at,day,tasks:[task]},{id:'p2',kind:'plan',at:at+1,day,tasks:[task]},
    {id:'finish',kind:'learn',at:at+2,day,planId:'p2',taskId:task.id,phase:'new',knowledgeId:'a',moduleId:'m',topicId:'t'}];
  const state=model.replay(events); assert.ok(state.days[day].completed[task.id]); assert.equal(state.days[day].tasks.length,1);
});

test('V4 a crash between legacy counter writes is recovered before any subsequent answer', () => {
  setup(); engine.getState(); const q=content.questions[0]; const original=wx.setStorageSync; let failed=false;
  wx.setStorageSync=(key,value)=>{ if(key==='zhilian_question_stats_v3'&&!failed){failed=true;throw new Error('simulated termination');} original(key,value); };
  assert.throws(()=>storage.recordQuestionResult(q.id,q.moduleId,q.topicId,false,{eventId:'crash-one'}));
  wx.setStorageSync=original;
  storage.recordQuestionResult(q.id,q.moduleId,q.topicId,true,{eventId:'crash-two'});
  storage.recoverAnswerWrites();
  assert.equal(storage.getQuestionStats()[q.id].attempts,2); assert.equal(storage.getQuestionStats()[q.id].wrong,1);
  assert.equal(storage.getPendingAnswerEvents().length,2); assert.equal(engine.getState().records[q.knowledgeId].reviewStage,1);
});
