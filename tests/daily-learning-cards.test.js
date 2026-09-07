const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const content = require('../miniprogram/data/content');
const engine = require('../miniprogram/utils/learningEngine');
const storage = require('../miniprogram/utils/storage');
const DAY = 86400000;
const knowledge = content.getKnowledgeSet('idiom', 0).items;
let timers, navigations, modalConfirm, now;

function setup() {
  const store = new Map();
  const app = { globalData: {} };
  timers = []; navigations = []; modalConfirm = true; now = Date.now();
  global.getApp = () => app;
  global.wx = {
    getStorageSync: key => structuredClone(store.get(key)),
    setStorageSync: (key, value) => store.set(key, structuredClone(value)),
    removeStorageSync: key => store.delete(key),
    setNavigationBarTitle() {}, pageScrollTo() {}, showToast() {},
    navigateTo: options => navigations.push(options.url),
    switchTab: options => navigations.push(options.url),
    showActionSheet: () => assert.fail('familiar must open a centered modal directly'),
    showModal: options => {
      assert.ok(options.confirmText.length <= 4);
      options.success({ confirm: modalConfirm });
    }
  };
  storage.setCloudSyncScheduler(() => {});
}
function page(mode = 'new') {
  const file = path.resolve(__dirname, '../miniprogram/pages/today-study/index.js');
  let definition;
  class PageDate extends Date { static now() { return now; } }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: createRequire(file), Page: value => { definition = value; }, wx, getApp, Date: PageDate,
    setTimeout: callback => { timers.push(callback); return callback; },
    clearTimeout: callback => { timers = timers.filter(item => item !== callback); }
  }, { filename: file });
  definition.data = structuredClone(definition.data);
  definition.setData = function(values) { Object.assign(this.data, values); };
  definition.onLoad({ mode, topicId: 'idiom' });
  definition.onShow();
  return definition;
}
const ratingEvent = (page, value) => ({ currentTarget: { dataset: { taskId: page.data.task.id, value } } });
function flushTimers() { const pending = timers; timers = []; pending.forEach(callback => callback()); }
function assessments(id) { return engine.getPendingEvents().filter(event => event.kind === 'assessment' && (!id || event.knowledgeId === id)); }

test('daily cards default to hidden meanings; all three degrees save directly without duplicate or stale taps', () => {
  setup(); engine.saveStudySettings({ topicId: 'idiom', newCount: 3 }, now);
  const p = page();
  assert.equal(p.data.revealed, false);
  assert.equal(p.data.current.learned, false);
  assert.equal(p.data.current.degreeLabel, '陌生');
  const first = p.data.task.knowledgeId;
  p.onRate(ratingEvent(p, 'invalid'));
  assert.equal(assessments().length, 0);
  ['none', 'fuzzy', 'remembered'].forEach(value => {
    const id = p.data.task.knowledgeId, e = ratingEvent(p, value);
    assert.equal(p.data.revealed, false);
    if (value === 'fuzzy') {
      const pending = engine.getPendingEvents().length;
      p.onReveal(); assert.equal(engine.getPendingEvents().length, pending, 'reveal does not save a degree');
    }
    p.onRate(e); p.onRate(e);
    assert.equal(assessments(id).length, 1);
    assert.equal(engine.getKnowledgeView(id, now).learned, true);
    assert.equal(engine.getKnowledgeView(id, now).rating, value);
    assert.equal(p.data.saving, true);
    flushTimers();
    assert.equal(p.data.revealed, false, 'each next card starts hidden');
    const savedCount = assessments().length;
    p.onRate(e);
    assert.equal(assessments().length, savedCount, 'a late previous-card event cannot rate the next card');
  });
  assert.equal(engine.getKnowledgeView(first, now).rating, 'none');
  assert.equal(p.data.task, null);
  assert.equal(p.data.daily.completed, 3);
  assert.equal(p.data.daily.summary.newCount, 3);
  assert.equal(navigations.length, 0);
  assert.equal(engine.ensurePlan(now, 'new', 'idiom').tasks.every(task => task.phase === 'new'), true);
  assert.equal(engine.getPendingEvents().some(event => event.kind === 'answer'), false);
});

test('daily review can be rated from recall without revealing and finishes without exercise or retry', () => {
  setup();
  knowledge.slice(0, 3).forEach((item, index) => engine.learn(item.id, ['none', 'fuzzy', 'remembered'][index], now - 7 * DAY + index));
  const initialAssessments = assessments().length;
  const p = page('review');
  assert.equal(p.data.daily.total, 3);
  for (const value of ['none', 'fuzzy', 'remembered']) {
    assert.equal(p.data.revealed, false);
    p.onRate(ratingEvent(p, value)); flushTimers();
  }
  assert.equal(assessments().length, initialAssessments + 3);
  assert.equal(p.data.task, null);
  assert.equal(p.data.daily.completed, 3);
  assert.equal(p.data.daily.due, 0);
  assert.equal(engine.ensurePlan(now, 'review', 'idiom').tasks.every(task => task.phase === 'review'), true);
  assert.equal(engine.getPendingEvents().some(event => event.kind === 'answer'), false);
  assert.deepEqual(navigations, []);
});

test('same-day newly learned unfamiliar knowledge never enters automatic review, including a pre-created review session', () => {
  setup(); engine.saveStudySettings({ topicId: 'idiom', newCount: 1 }, now);
  const emptyReview = page('review');
  assert.equal(emptyReview.data.task, null);
  const p = page(); const id = p.data.task.knowledgeId;
  p.onReveal(); p.onRate(ratingEvent(p, 'none')); flushTimers();
  assert.equal(engine.getKnowledgeView(id, now).learned, true);
  assert.equal(engine.getKnowledgeView(id, now).due, false);
  const sameDayReview = page('review');
  assert.equal(sameDayReview.data.daily.due, 0);
  assert.equal(sameDayReview.data.daily.remaining, 0);
  assert.equal(sameDayReview.data.task, null);
  assert.equal(engine.getState(now).records[id].nextReviewAt > now, true);
});

test('leaving during saved feedback preserves completion and reopening resumes exactly at the next card', () => {
  setup(); engine.saveStudySettings({ topicId: 'idiom', newCount: 2 }, now);
  const p = page(); const id = p.data.task.knowledgeId;
  p.onReveal(); p.onRate(ratingEvent(p, 'fuzzy'));
  p.onHide();
  assert.equal(timers.length, 0);
  assert.equal(engine.getKnowledgeView(id, now).rating, 'fuzzy');
  const reopened = page();
  assert.notEqual(reopened.data.task.knowledgeId, id);
  assert.equal(reopened.data.daily.completed, 1);
  assert.equal(reopened.data.daily.remaining, 1);
  assert.equal(assessments(id).length, 1);
});

test('review reveal draft restores after leaving, while revealed browsing does not complete review', () => {
  setup(); engine.learn(knowledge[0].id, 'none', now - 2 * DAY);
  const p = page('review'); const taskId = p.data.task.id;
  p.onReveal(); p.onHide();
  const reopened = page('review');
  assert.equal(reopened.data.task.id, taskId);
  assert.equal(reopened.data.revealed, true);
  assert.equal(reopened.data.daily.completed, 0);
  assert.equal(reopened.data.daily.remaining, 1);
  assert.equal(assessments().length, 1);
});

test('restoring familiar overdue knowledge joins an existing review plan without losing completed tasks', () => {
  setup();
  const first = knowledge[0].id, restored = knowledge[1].id;
  engine.learn(first, 'none', now - 3 * DAY);
  engine.learn(restored, 'none', now - 3 * DAY + 1);
  engine.setFamiliar(restored, true, now - DAY);
  const p = page('review');
  assert.equal(p.data.daily.total, 1);
  p.onReveal(); p.onRate(ratingEvent(p, 'remembered')); flushTimers();
  assert.equal(p.data.task, null);
  assert.equal(p.data.daily.completed, 1);
  engine.setFamiliar(restored, false, now + 1);
  p.onShow();
  assert.equal(p.data.daily.due, 1);
  assert.equal(p.data.daily.remaining, 1);
  assert.equal(p.data.daily.completed, 1);
  assert.equal(p.data.task.knowledgeId, restored);
  assert.equal(p.data.revealed, false);
});

test('cancelling familiar after skipping today review keeps due count and actionable queue consistent', () => {
  setup(); const id = knowledge[0].id;
  engine.learn(id, 'none', now - 2 * DAY);
  const p = page('review');
  modalConfirm = false; p.onFamiliar();
  assert.equal(p.data.task.knowledgeId, id);
  assert.equal(engine.getKnowledgeView(id, now).excluded, false);
  modalConfirm = true; p.onFamiliar(); flushTimers();
  assert.equal(p.data.task, null);
  assert.equal(p.data.daily.due, 0);
  assert.equal(engine.getKnowledgeView(id, now).excluded, true);
  engine.setFamiliar(id, false, now + 1);
  p.onShow();
  assert.equal(engine.getKnowledgeView(id, now).excluded, false);
  assert.equal(p.data.daily.due, p.data.daily.remaining, 'a due item must be actionable after the explicit exemption is undone');
  if (p.data.daily.due) assert.equal(p.data.task.knowledgeId, id);
});

for (const mode of ['new', 'review']) test(`swiping ${mode} cards is neutral; hidden later cards and corrected earlier cards persist once`, () => {
  setup();
  if (mode === 'review') knowledge.slice(0, 3).forEach((k,i) => engine.learn(k.id,'none',now-3*DAY+i));
  engine.saveStudySettings({ topicId: 'idiom', newCount: 3 }, now);
  const p=page(mode), initial=assessments().length, first=p.data.cards[0].id, last=p.data.cards[2].id;
  p.onSwiperChange({detail:{current:2,source:'touch'}});
  assert.equal(p.data.task.id,last);assert.equal(p.data.currentIndex,2);assert.equal(p.data.revealed,false);assert.equal(assessments().length,initial);
  assert.equal(p.data.daily.completed,0);p.onRate(ratingEvent(p,'remembered'));flushTimers();
  assert.equal(p.data.daily.completed,1);assert.equal(p.data.task.id,first);assert.equal(p.data.revealed,false);
  p.onRate(ratingEvent(p,'none'));flushTimers();assert.equal(p.data.daily.completed,2);
  p.onSwiperChange({detail:{current:0,source:'touch'}});p.onRate(ratingEvent(p,'fuzzy'));flushTimers();
  assert.equal(p.data.daily.completed,2);assert.equal(engine.getKnowledgeView(p.data.cards[0].knowledgeId).rating,'fuzzy');
  assert.equal(assessments().length,initial+3);
  p.onRate(ratingEvent(p,'remembered'));flushTimers();assert.equal(p.data.task,null);assert.equal(p.data.daily.completed,3);
  if(mode==='review') assert.equal(p.data.daily.summary.reviewCount,3);
  const history=JSON.parse(JSON.stringify(engine.getPendingEvents()));
  assert.deepEqual(JSON.parse(JSON.stringify(engine.getState())),JSON.parse(JSON.stringify(engine.model.replay(history))));
});
