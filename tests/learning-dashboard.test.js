const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const content = require('../miniprogram/data/content');
const engine = require('../miniprogram/utils/learningEngine');
const storage = require('../miniprogram/utils/storage');
const dashboard = require('../miniprogram/utils/learningDashboard');
const guide = require('../miniprogram/utils/learningGuide');
const model = engine.model;
const now = Date.parse('2026-09-09T04:00:00Z');
const ks = content.getKnowledgeByTopic('idiom');
function setup() {
  const store = new Map(), app = { globalData: {} };
  global.wx = { getStorageSync: k => structuredClone(store.get(k)), setStorageSync: (k, v) => store.set(k, structuredClone(v)), removeStorageSync: k => store.delete(k),
    pageScrollTo() {}, showToast() {}, switchTab() {}, navigateTo() {} };
  global.getApp = () => app;
  storage.setCloudSyncScheduler(() => {});
  return store;
}
function view(at = now) { return dashboard.buildDashboard(engine.getState(at), engine.getStudySettings(at), storage.getQuestionStats(), at); }
function page(name) {
  let p; const file = path.resolve(__dirname, '../miniprogram/pages/' + name + '/index.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require: createRequire(file), Page: d => { p = d; }, wx, getApp, Date, setInterval: () => 1, clearInterval() {} });
  p.data = structuredClone(p.data); p.setData = function(v) { Object.assign(this.data, v); }; return p;
}
test('today priorities cover empty, new, review, both partial completions, complete and fully learned', () => {
  setup();
  assert.equal(view().action.type, 'new'); assert.equal(view().action.primaryCount, 10);
  engine.learn(ks[0].id, 'none', now - 3 * model.DAY);
  assert.equal(view().action.type, 'review'); assert.equal(view().daily.fresh, 10);
  const review = engine.dailyView(now, 'review'); engine.completeTask(review.next.id, { rating: 'remembered' }, now, 'review');
  assert.equal(view().action.type, 'new'); assert.equal(view().action.reviewCompleted, 1);
  engine.saveStudySettings({ topicId: 'idiom', newCount: 1 }, now + 1);
  engine.learn(ks[1].id, 'none', now + 2);
  assert.equal(view(now + 10).action.type, 'complete');
  setup(); engine.learn(ks[0].id, 'none', now - 3 * model.DAY);
  engine.saveStudySettings({ topicId: 'idiom', newCount: 1 }, now);
  engine.learn(ks[1].id, 'remembered', now + 1);
  assert.equal(view(now + 10).action.type, 'review'); assert.equal(view(now + 10).action.newRemaining, 0);
  const empty = dashboard.getTodayRecommendation({ topic: null, goal: 10, scope: {}, today: {} }); assert.equal(empty.type, 'scope');
  const complete = dashboard.getTodayRecommendation({ topic: { id: 'idiom' }, goal: 200, scope: { total: 888, unlearnedCount: 0, dueCount: 0 }, today: { newCount: 0, reviewCount: 0, completed: 0 } });
  assert.equal(complete.title, '这个分类已学完'); assert.equal(complete.button, '');
});
test('counts honor user goal, remaining bank and completed new learning without mutation', () => {
  setup();
  for (const count of [1, 10, 200]) {
    engine.saveStudySettings({ topicId: 'idiom', newCount: count }, now);
    assert.equal(view().action.primaryCount, count);
  }
  ks.slice(0, 7).forEach((k, i) => engine.learn(k.id, 'fuzzy', now + i));
  engine.saveStudySettings({ topicId: 'idiom', newCount: 1 }, now + 20);
  const before = JSON.stringify(engine.getState()), pending = JSON.stringify(engine.getPendingEvents());
  const d = view(now + 30); assert.equal(d.daily.fresh, 0); assert.equal(d.learning.today.newCount, 7);
  assert.equal(JSON.stringify(engine.getState()), before); assert.equal(JSON.stringify(engine.getPendingEvents()), pending);
});
test('completed review counts actual tasks once, excluding practice and ordinary self-assessment changes', () => {
  setup(); engine.learn(ks[0].id, 'none', now - 3 * model.DAY); engine.learn(ks[1].id, 'none', now - 3 * model.DAY + 1);
  engine.setFamiliar(ks[1].id, true, now - model.DAY);
  engine.setFamiliar(ks[1].id, false, now);
  engine.learn(ks[1].id, 'remembered', now + 1);
  assert.equal(view(now + 2).learning.today.completed, 0);
  const v = engine.dailyView(now + 2, 'review'); engine.completeTask(v.next.id, { rating: 'fuzzy' }, now + 3, 'review');
  engine.learn(ks[0].id, 'remembered', now + 4);
  assert.equal(view(now + 5).learning.today.reviewCount, 1);
  assert.equal(view(now + model.DAY).learning.today.completed, 0);
});
test('practice recommendations filter stale IDs, cap count and use only formally learned related questions', () => {
  setup(); const state = engine.getState(now), topic = content.getTopicById('idiom');
  assert.equal(dashboard.getPracticeRecommendation(state, { missing: { activeWrong: true } }, topic).type, 'free');
  engine.learn(ks[0].id, 'none', now);
  const learned = dashboard.getPracticeRecommendation(engine.getState(now), {}, topic);
  assert.equal(learned.type, 'learned'); assert.equal(learned.count, 1);
  assert.ok(learned.questionIds.every(id => content.getQuestionById(id).knowledgeId === ks[0].id));
  const stats = Object.fromEntries(content.questions.slice(0, 50).map(q => [q.id, { activeWrong: true }])); stats.missing = { activeWrong: true };
  const wrong = dashboard.getPracticeRecommendation(state, stats, topic);
  assert.equal(wrong.type, 'wrong'); assert.equal(wrong.count, 20); assert.ok(!wrong.questionIds.includes('missing'));
  assert.equal(dashboard.getPracticeRecommendation(model.emptyState(), {}, null).type, 'free');
});
test('actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates', () => {
  setup();
  const questions = ks.slice(0, 3).map(k => content.questions.find(q => q.knowledgeId === k.id));
  engine.learn(ks[1].id, 'fuzzy', now - model.DAY); engine.learn(ks[2].id, 'remembered', now - model.DAY); engine.setFamiliar(ks[2].id, true, now - 1000);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i], previous = engine.getState(now).records[q.knowledgeId];
    const before = dashboard.scheduleEvidence(previous), rating = previous && previous.selfRating;
    storage.recordQuestionResult(q.id, q.moduleId, q.topicId, false, { answeredAt: now });
    const after = engine.getState(now).records[q.knowledgeId];
    assert.equal(dashboard.didUpdateSchedule(before, after), i === 1);
    if (rating) assert.equal(after.selfRating, rating);
    if (i === 0) assert.equal(after.firstLearnedAt, 0);
    if (i === 2) { assert.equal(after.excludedFromReview, true); assert.equal(after.nextReviewAt, 0); }
  }
});
test('guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues', () => {
  const store = setup();
  engine.learn(ks[0].id, 'fuzzy', now - model.DAY); engine.setFamiliar(ks[1].id, true, now - model.DAY);
  const q = content.questions[0]; storage.recordQuestionResult(q.id, q.moduleId, q.topicId, false, { answeredAt: now });
  const v = engine.dailyView(now); engine.beginTask(now); engine.saveDraft(v.next, { revealed: true });
  storage.markGroupProgress('idiom', 0, 3, 20);
  const old = new Map([...store].map(([k, v]) => [k, JSON.stringify(v)]));
  view(); assert.equal(guide.read().completed, false); guide.finish(); assert.equal(guide.read().completed, true);
  assert.equal(guide.takeHint('due'), true); assert.equal(guide.takeHint('due'), false);
  for (const [key, value] of old) assert.equal(JSON.stringify(store.get(key)), value, key);
  assert.equal(engine.getState().version, 5);
});
test('result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts', () => {
  setup(); const q = content.questions.find(q => q.knowledgeId === ks[0].id);
  engine.learn(q.knowledgeId, 'fuzzy', Date.now() - model.DAY);
  const p = page('exam'); p.startWithQuestions([q]); p.data.answers[q.id] = q.answer;
  p.submitExam(); assert.equal(p.data.scheduleUpdated, 1); assert.equal(p.data.resultSummary.correctCount, 1);
  p.submitExam(); assert.equal(storage.getQuestionStats()[q.id].attempts, 1);
  engine.setFamiliar(q.knowledgeId, true); p.startWithQuestions([q]); p.submitExam();
  assert.equal(p.data.scheduleUpdated, 0); assert.equal(engine.getKnowledgeView(q.knowledgeId).excluded, true);
});
test('onboarding hides and restores TabBar and can be skipped without changing learning data', () => {
  setup(); const p = page('study'), bar = { data: {}, refresh() {}, setData(v) { Object.assign(this.data, v); } };
  p.getTabBar = () => bar; p.onShow(); assert.equal(p.data.guideOpen, true); assert.equal(bar.data.hidden, true);
  const before = JSON.stringify(engine.getState()); guide.finish(); p.onGuideClose(); assert.equal(bar.data.hidden, false);
  p.onHide(); p.onShow(); assert.equal(p.data.guideOpen, false); assert.equal(JSON.stringify(engine.getState()), before);
});
