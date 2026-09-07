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
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require: createRequire(file), Page: (v) => { p = v; }, wx, getApp, Date, console, setTimeout: (fn) => fn(), clearTimeout() {}, setInterval: () => 1, clearInterval() {} });
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
function finishCurrent(now, rating = 'remembered') {
  const v = engine.dailyView(now), t = v.next;
  return engine.completeTask(t.id, { rating }, now);
}

test('V5 new user gets a stable ten-item new-learning plan and a separate empty review session', () => {
  setup(); const v = engine.dailyView(); assert.equal(v.fresh,10); assert.equal(v.due,0); assert.equal(v.total,10);
  assert.ok(engine.ensurePlan().tasks.every(t => t.phase === 'new'));
  assert.equal(engine.dailyView(Date.now(),'review').total,0);
  assert.equal(engine.overview().masteredCount,0); assert.equal(engine.overview().sevenDayAccuracy,null);
  assert.deepEqual(engine.dailyView(), v);
});
test('V5 rating saves and advances immediately; reopening skips the completed knowledge', () => {
  setup(); const p = page('today-study'); p.onLoad(); p.onShow(); const id = p.data.task.id;
  assert.equal(p.data.revealed,false); p.onReveal(); p.onRate(event({value:'fuzzy'})); const next=engine.dailyView().next.id; assert.notEqual(next,id);
  const reopened = page('today-study'); reopened.onLoad(); reopened.onShow(); assert.equal(reopened.data.task.id,next); assert.equal(reopened.data.revealed,false);
  const home = page('study'); home.onShow(); assert.equal(home.data.daily.completed,1); assert.equal(home.data.scope.understoodCount,1);
});
test('V5 unfinished review keeps its revealed draft across page recreation without recording an assessment', () => {
  setup(); engine.learn(first.id,'none',model.afterDays(Date.now(),-1)+1000);
  const p=page('today-study');p.onLoad({mode:'review',topicId:first.topicId});p.onShow();const id=p.data.task.id;
  assert.equal(p.data.revealed,false);p.onReveal();const count=engine.getPendingEvents().length;
  const reopened=page('today-study');reopened.onLoad({mode:'review',topicId:first.topicId});reopened.onShow();
  assert.equal(reopened.data.task.id,id);assert.equal(reopened.data.revealed,true);assert.equal(engine.getPendingEvents().length,count);
});
test('V5 completed groups lead to the next group; matching practice remains an explicit action', () => {
  setup(); const set = content.getKnowledgeSet('idiom',0);
  engine.learn(set.items[0].id,'none'); assert.equal(engine.groupAction('idiom',0).label,'继续学习');
  set.items.slice(1).forEach((k) => engine.learn(k.id,'fuzzy'));
  const action = engine.groupAction('idiom',0); assert.equal(action.type,'next'); assert.equal(action.learnedCount,20);assert.equal(app.globalData.examRequest,undefined);
  engine.practiceGroup('idiom',0); const req = app.globalData.examRequest; assert.equal(req.direct,true); assert.equal(req.count,5);
  assert.ok(req.questionIds.every((id) => set.items.some((k) => content.getQuestionById(id).knowledgeId === k.id)));
  const e = page('exam'); e.onShow(); assert.equal(e.data.state,'exam'); assert.equal(e.data.examQuestions.length,5);
  e.data.examQuestions.forEach((q,i) => { e.goToQuestion(i); e.onChooseOption(event({id:q.answer})); e.onConfirm(); }); e.submitExam();
  assert.equal(engine.groupAction('idiom',0).type,'next');
});
test('V5 merely swiping cards does not mark learning complete; an unfamiliar rating does', () => {
  setup(); const p=page('learn'); p.onLoad({topicId:'idiom',setIndex:'0'}); p.onSwiperChange({detail:{current:19}});
  assert.equal(engine.topicSummary('idiom').learnedCount,0); assert.equal(p.data.groupComplete,false);
  p.onReveal(event({index:19})); p.onRate(event({index:19,value:'none'})); assert.equal(engine.topicSummary('idiom').learnedCount,1);assert.equal(p.data.currentIndex,0);
});
test('V5 practice does not formally learn unseen knowledge or change an explicit proficiency', () => {
  setup(); const now = Date.now(); const q=answer(first.id,false,now);
  assert.equal(engine.getState().records[first.id].firstLearnedAt,0);assert.equal(engine.reviewItems().length,0);
  engine.learn(first.id,'remembered',now+1);answer(first.id,false,now+2);
  const r=engine.getState().records[first.id];assert.equal(r.selfRating,'remembered');assert.equal(r.wrongCount,2);
  assert.ok(r.nextReviewAt>=model.afterDays(now,1));assert.equal(engine.dailyView(now+3,'review',q.topicId).remaining,0);
  assert.ok(engine.dailyView(r.nextReviewAt,'review',q.topicId).next);
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
test('V5 all three ratings count as learned and mastered remains eligible for future review', () => {
  setup(); const now=Date.now(); const ids=content.knowledge.slice(0,3).map(k=>k.id);
  engine.learn(ids[0],'none',now); engine.learn(ids[1],'fuzzy',now); engine.learn(ids[2],'remembered',now);
  const records=engine.getState().records;
  ids.forEach(id=>{assert.ok(records[id].firstLearnedAt);assert.ok(records[id].nextReviewAt>=model.afterDays(now,1));assert.equal(model.isDue(records[id],now),false);});
  assert.ok(records[ids[0]].nextReviewAt<=records[ids[1]].nextReviewAt);assert.ok(records[ids[1]].nextReviewAt<=records[ids[2]].nextReviewAt);
  assert.equal(engine.overview().masteredCount,1);assert.equal(engine.overview().learnedCount,3);
  assert.equal(model.isDue(records[ids[2]],records[ids[2]].nextReviewAt),true);
});
test('V5 daily new learning ends after ten assessments and next-day review is an independent session', () => {
  setup(); let rounds=0; const now=Date.now();
  while(engine.dailyView(now).next && rounds<50) { finishCurrent(now,'none'); rounds++; }
  const done=engine.dailyView(now); assert.equal(rounds,10); assert.equal(done.remaining,0); assert.equal(done.summary.newCount,10);
  assert.equal(engine.completeTask('new:'+first.id,{},now),false); assert.equal(engine.dailyView(now).total,done.total);
  assert.equal(engine.dailyView(now,'review').remaining,0);
  const tomorrow=model.afterDays(now,1)+3600000,next=engine.dailyView(tomorrow); assert.notEqual(next.day,done.day); assert.equal(next.next.phase,'new'); assert.equal(next.completed,0);
  const review=engine.dailyView(tomorrow,'review');assert.equal(review.remaining,10);assert.equal(review.next.phase,'review');
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
  assert.equal(model.status(state.records[content.getKnowledgeSet('idiom',0).items[0].id],Date.now()),'due');
  assert.equal(state.records[q.knowledgeId].wrongCount,6);assert.equal(state.records[q.knowledgeId].firstLearnedAt,0,'wrong-only legacy knowledge stays unlearned');
  engine.getState(); assert.equal(engine.getPendingEvents().length,count+1,'only the daily plan was added by overview');
  assert.deepEqual(storage.getQuestionStats(),before);
});
test('V5 cloud snapshot plus pending offline events preserves self-rating and exact next task', () => {
  setup(); finishCurrent(Date.now()); const events=engine.getPendingEvents(); const remote=model.replay(events); const next=engine.dailyView().next.id;
  finishCurrent(Date.now()); const pending=engine.getPendingEvents().filter(e=>!events.some(x=>x.id===e.id));
  engine.applySnapshot({learningVersion:5,learningState:remote},events.map(e=>e.id));
  assert.deepEqual(engine.getPendingEvents(),pending); assert.equal(engine.dailyView().completed,2); assert.notEqual(engine.dailyView().next.id,next);
  const all=engine.getPendingEvents(); assert.equal(engine.applySnapshot({}),false); assert.deepEqual(engine.getPendingEvents(),all);
});
test('legacy pending daily answers recover exactly once without a network connection after V5 upgrade', () => {
  setup(); wx.request=wx.login=()=>{throw Error('no network permitted');};
  const q=content.questions[0],now=Date.now(),day=model.dayKey(now),task={id:'practice:'+q.knowledgeId,phase:'practice',knowledgeId:q.knowledgeId,questionId:q.id};
  const events=[{id:'old-plan',kind:'plan',at:now-2,day,tasks:[task]},
    {id:'old-answer',kind:'answer',at:now-1,day,planId:'old-plan',taskId:task.id,phase:'practice',knowledgeId:q.knowledgeId,topicId:q.topicId,moduleId:q.moduleId,questionId:q.id,correct:false}];
  store.set('zhilian_learning_v4',{version:4,base:{...model.emptyState(),version:4},state:model.replay(events),pending:events});
  engine.repairDailyAnswers();engine.repairDailyAnswers();
  assert.equal(storage.getQuestionStats()[q.id].attempts,1);assert.equal(storage.getPendingAnswerEvents().length,1);assert.ok(engine.getPendingEvents().some(e=>e.id==='old-answer'));
});
test('V4 assessment recommendation directly starts only wrong questions', () => {
  setup(); const e=page('exam'); e.setData({sessionMode:'assessment'}); const qs=content.questions.slice(0,2); e.startWithQuestions(qs);
  e.onChooseOption(event({id:qs[0].answer})); e.submitExam();
  assert.equal(e.data.recommendation.type,'retry'); assert.equal(e.data.recommendation.questionIds.length,1);
  e.onRetryWrong(); assert.equal(e.data.state,'exam'); assert.equal(e.data.sessionMode,'practice'); assert.equal(e.data.examQuestions[0].id,qs[1].id);
});
test('a fully learned knowledge bank has a usable empty new-learning summary', () => {
  setup(); const value=engine.getState(); content.knowledge.forEach(k=>{value.records[k.id]={knowledgeId:k.id,topicId:k.topicId,moduleId:k.moduleId,firstLearnedAt:1,reviewStage:4,nextReviewAt:0};});
  const saved=store.get('zhilian_learning_v4'); saved.state=value; store.set('zhilian_learning_v4',saved);
  const v=engine.dailyView(); assert.equal(v.total,0); assert.ok(Number.isFinite(v.progress)); assert.equal(v.next,null);assert.equal(v.summary.unlearnedCount,0);
});
test('V5 reset removes answer-derived weakness but preserves learned knowledge and daily completion', () => {
  setup(); finishCurrent(Date.now());finishCurrent(Date.now(),'fuzzy');answer(engine.ensurePlan().tasks[0].knowledgeId,false,Date.now());
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

test('V5 first connection imports legacy cloud records without invented learning or answer history', () => {
  setup(); engine.getState();
  const q=content.questions[0];
  const remote={initialized:true,learningVersion:5,learningState:model.emptyState(),progress:{idiom_0:{topicId:'idiom',setIndex:0,maxIndex:4}},stats:{[q.id]:{questionId:q.id,activeWrong:true,wrong:3}}};
  engine.importLegacySnapshot(remote); const size=engine.getPendingEvents().length; engine.importLegacySnapshot(remote);
  assert.equal(engine.getPendingEvents().length,size); assert.equal(engine.topicSummary('idiom').learnedCount,5); assert.equal(engine.overview().sevenDayAccuracy,null);
  setup();
  const shared=content.questions.find(q=>content.questions.filter(other=>other.knowledgeId===q.knowledgeId).length>1);
  const pair=content.questions.filter(q=>q.knowledgeId===shared.knowledgeId).slice(0,2);
  storage.recordQuestionResult(shared.id,shared.moduleId,shared.topicId,true);
  engine.importLegacySnapshot({initialized:true,learningVersion:5,learningState:model.emptyState(),progress:{},stats:Object.fromEntries(pair.map((q,i)=>[q.id,{questionId:q.id,activeWrong:true,wrong:i+2}]))});
  assert.equal(engine.getState().records[shared.knowledgeId].wrongCount,5,'multiple legacy questions aggregate under their knowledge');
  assert.equal(engine.getState().records[shared.knowledgeId].firstLearnedAt,0,'answer-only history never manufactures formal learning');
  assert.equal(engine.getState().records[shared.knowledgeId].correctStreak,1,'new local answer replays after the cloud legacy baseline');
});
test('V4 concurrent offline plans keep a bounded canonical plan and retain the other device learning', () => {
  const at=Date.now(), day=model.dayKey(at);
  const p1={id:'plan-a',at,kind:'plan',day,tasks:[{id:'new:a',phase:'new',knowledgeId:'a',questionId:''}]};
  const p2={id:'plan-b',at:at+10,kind:'plan',day,tasks:[{id:'new:b',phase:'new',knowledgeId:'b',questionId:''}]};
  const done={id:'done-b',at:at+20,kind:'learn',knowledgeId:'b',topicId:'t',moduleId:'m',day,planId:p2.id,taskId:'new:b',phase:'new'};
  const state=model.replay([done,p2,p1]); assert.equal(state.days[day].id,p1.id); assert.equal(state.days[day].tasks.length,1); assert.ok(state.records.b.firstLearnedAt); assert.ok(state.days[day].extraCompleted['done-b']);
});
test('V5 review uses knowledge self-assessment and double confirmation never advances twice', () => {
  setup();const now=Date.now();engine.learn(first.id,'none',model.afterDays(now,-1)+1000);
  const task=engine.dailyView(now,'review',first.topicId).next;assert.equal(task.questionId,'');
  assert.equal(engine.completeTask(task.id,{rating:'remembered'},now,'review',first.topicId),true);
  const pending=engine.getPendingEvents().length;
  assert.equal(engine.completeTask(task.id,{rating:'remembered'},now,'review',first.topicId),false);
  assert.equal(engine.getPendingEvents().length,pending);assert.equal(engine.dailyView(now,'review',first.topicId).completed,1);
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
  assert.equal(storage.getPendingAnswerEvents().length,2); assert.equal(engine.getState().records[q.knowledgeId].correctStreak,1);assert.equal(engine.getState().records[q.knowledgeId].firstLearnedAt,0);
});
