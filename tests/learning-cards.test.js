const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const content = require("../miniprogram/data/content");
const engine = require("../miniprogram/utils/learningEngine");
const storage = require("../miniprogram/utils/storage");
const learningView = require("../miniprogram/utils/learningView");
let timers, navigation, modalConfirm, actionIndex;

function setup() {
  const store = new Map();
  const app = { globalData: {} };
  timers = []; navigation = []; modalConfirm = true; actionIndex = 0;
  global.getApp = () => app;
  global.wx = {
    getStorageSync: (key) => structuredClone(store.get(key)),
    setStorageSync: (key, value) => store.set(key, structuredClone(value)),
    removeStorageSync: (key) => store.delete(key),
    setNavigationBarTitle() {}, showToast() {}, navigateBack() {},
    navigateTo: (options) => navigation.push(options.url),
    redirectTo: (options) => navigation.push(options.url),
    switchTab: (options) => navigation.push(options.url),
    showActionSheet: () => assert.fail("familiar must open a centered modal directly"),
    showModal: (options) => {
      assert.ok(options.confirmText.length <= 4);
      options.success({ confirm: modalConfirm });
    }
  };
  storage.setCloudSyncScheduler(() => {});
}
function page(name) {
  const file = path.resolve(__dirname, `../miniprogram/pages/${name}/index.js`);
  let definition;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    require: createRequire(file), Page: (value) => { definition = value; }, wx, getApp, Date, console,
    setTimeout: (callback) => { timers.push(callback); return callback; },
    clearTimeout: (callback) => { timers = timers.filter((item) => item !== callback); }
  }, { filename: file });
  definition.data = structuredClone(definition.data);
  definition.setData = function(values) {
    for (const [key, value] of Object.entries(values)) {
      const parts = key.replace(/\[(\d+)\]/g, ".$1").split(".");
      let target = this.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = value;
    }
  };
  return definition;
}
function flushTimers() { const pending = timers; timers = []; pending.forEach((callback) => callback()); }
const event = (dataset) => ({ currentTarget: { dataset } });
const group = content.getKnowledgeSet("idiom", 0);
function learnPage() { const p = page("learn"); p.onLoad({ topicId: "idiom", setIndex: "0" }); return p; }

test("learning cards hide explanations by default; browsing and revealing remain neutral", () => {
  setup();
  const p = learnPage();
  assert.equal(p.data.learningItems[0].revealed, false);
  assert.equal(p.data.learningItems[0].learned, false);
  assert.equal(p.data.progressPercent, 0);
  const pending = engine.getPendingEvents().length;
  assert.equal(p.data.currentIndex, 0);
  p.onReveal(event({ index: 0 }));
  assert.equal(p.data.learningItems[0].revealed, true);
  assert.equal(engine.getPendingEvents().length, pending, "revealing alone does not save a degree");
  p.onSwiperChange({ detail: { current: 3 } });
  assert.equal(p.data.learningItems[3].revealed, false);
  p.onReveal(event({ index: 0 }));
  assert.equal(p.data.learningItems[3].revealed, false, "stale reveal events do not reveal another card");
  assert.equal(engine.getKnowledgeView(group.items[0].id).learned, false);
  assert.equal(engine.getKnowledgeView(group.items[3].id).learned, false);
  assert.equal(engine.getPendingEvents().length, pending);
  assert.equal(learningView.getReadingIndex("idiom", 0, group.count), 3);
});

test("all three degrees record learned progress and automatically advance exactly once", () => {
  setup();
  const p = learnPage();
  ["none", "fuzzy", "remembered"].forEach((value, index) => {
    assert.equal(p.data.learningItems[index].revealed, false);
    p.onRate(event({ index, value }));
    const pending = engine.getPendingEvents().length;
    p.onRate(event({ index, value }));
    assert.equal(engine.getPendingEvents().length, pending, "double tap during feedback is ignored");
    assert.equal(engine.getKnowledgeView(group.items[index].id).learned, true);
    assert.equal(engine.getKnowledgeView(group.items[index].id).rating, value);
    flushTimers();
    assert.equal(p.data.currentIndex, index + 1);
    assert.equal(p.data.learningItems[index + 1].revealed, false);
    p.onRate(event({ index, value }));
    assert.equal(engine.getPendingEvents().length, pending, "stale events cannot rate the next card");
  });
  assert.equal(engine.topicSummary("idiom").learnedCount, 3);
  assert.equal(p.data.progressPercent, 15);
  assert.equal(learningView.getReadingIndex("idiom", 0, group.count), 3);
});

test("returning to a previous card can correct its degree without duplicating learned progress", () => {
  setup();
  const p = learnPage();
  p.onReveal(event({ index: 0 }));
  p.onRate(event({ index: 0, value: "none" })); flushTimers();
  p.onSwiperChange({ detail: { current: 0, source: "touch" } });
  assert.equal(p.data.currentIndex, 0);
  assert.equal(p.data.learningItems[0].revealed, true);
  p.onRate(event({ index: 0, value: "remembered" })); flushTimers();
  assert.equal(engine.getKnowledgeView(group.items[0].id).rating, "remembered");
  assert.equal(engine.topicSummary("idiom").learnedCount, 1);
  const reopened = learnPage();
  assert.equal(reopened.data.currentIndex, 1);
  assert.equal(reopened.data.learningItems[1].revealed, false);
  reopened.onReveal(event({ index: 1 }));
  reopened.onRestart();
  assert.equal(reopened.data.learningItems.every((item) => !item.revealed), true);
  assert.equal(learningView.getReadingIndex("idiom", 0, group.count), 0);
  assert.equal(engine.topicSummary("idiom").learnedCount, 1);
});

test("completing a group ends learning without automatically starting practice", () => {
  setup();
  const p = learnPage();
  for (let index = 0; index < group.count; index += 1) {
    p.onReveal(event({ index }));
    p.onRate(event({ index, value: "none" })); flushTimers();
  }
  assert.equal(p.data.showCompletion, true);
  assert.equal(p.data.groupComplete, true);
  assert.equal(p.data.progressPercent, 100);
  assert.notEqual(p.data.groupAction.type, "practice");
  assert.equal(navigation.length, 0);
  assert.equal(engine.topicSummary("idiom").learnedCount, group.count);
});

test("familiar requires confirmation, records learned status, and can restore automatic review", () => {
  setup();
  const p = learnPage();
  modalConfirm = false;
  p.onFamiliar();
  assert.equal(engine.getKnowledgeView(group.items[0].id).learned, false);
  assert.equal(p.data.currentIndex, 0);
  modalConfirm = true;
  p.onFamiliar(); flushTimers();
  assert.equal(engine.getKnowledgeView(group.items[0].id).learned, true);
  assert.equal(engine.getKnowledgeView(group.items[0].id).excluded, true);
  assert.equal(p.data.currentIndex, 1);
  p.onSwiperChange({ detail: { current: 0, source: "touch" } }); p.onFamiliar();
  assert.equal(engine.getKnowledgeView(group.items[0].id).excluded, false);
  assert.equal(engine.topicSummary("idiom").learnedCount, 1);
});

test("detail browsing stays neutral; degrees can be saved with meanings collapsed", () => {
  setup();const p=page('detail');p.onLoad({id:group.items[0].id});
  assert.equal(p.data.answerVisible,false);const pending=engine.getPendingEvents().length;
  p.onToggleAnswer();p.onToggleAnswer();assert.equal(engine.getPendingEvents().length,pending);assert.equal(engine.getKnowledgeView(group.items[0].id).learned,false);
  for(const rating of ['none','fuzzy','remembered']) {p.onRecall(event({value:rating}));assert.equal(p.data.learning.rating,rating);assert.equal(p.data.learning.learned,true);}
  assert.equal(engine.topicSummary('idiom').learnedCount,1);p.onLoad({id:group.items[1].id});assert.equal(p.data.answerVisible,false);
});
test("review detail allows direct recall and direct familiar confirmation/cancellation", () => {
  setup();engine.learn(group.items[0].id,'remembered');const p=page('detail');p.onLoad({id:group.items[0].id,recall:'1'});
  p.onRecall(event({value:'none'}));assert.equal(p.data.recallDone,true);assert.equal(p.data.learning.rating,'none');
  modalConfirm=false;p.onFamiliar();assert.equal(p.data.learning.excluded,false);
  modalConfirm=true;p.onFamiliar();assert.equal(p.data.learning.excluded,true);
  p.onRecall(event({value:'remembered'}));assert.equal(p.data.learning.excluded,true);
  p.onFamiliar();assert.equal(p.data.learning.excluded,false);
});
