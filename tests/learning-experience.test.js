const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const content = require("../miniprogram/data/content");
const storage = require("../miniprogram/utils/storage");
const learning = require("../miniprogram/utils/learningView");
const exam = require("../miniprogram/utils/examSession");
let store, app, modalConfirm, navigations;
function setup() {
  store = new Map(); app = { globalData: { examRequest: null } }; modalConfirm = true; navigations = [];
  global.getApp = () => app;
  global.wx = {
    getStorageSync: (key) => structuredClone(store.get(key)),
    setStorageSync: (key, value) => store.set(key, structuredClone(value)),
    removeStorageSync: (key) => store.delete(key),
    setNavigationBarTitle() {}, pageScrollTo() {}, showToast() {},
    showModal: (options) => { assert.ok(!options.confirmText || options.confirmText.length <= 4, "WeChat confirmation label must fit its native limit"); options.success({ confirm: modalConfirm }); },
    navigateTo: (options) => navigations.push(options.url),
    switchTab: (options) => navigations.push(options.url),
    redirectTo: (options) => navigations.push(options.url), navigateBack() {}
  };
}
function page(name) {
  let definition;
  const file = path.resolve(__dirname, `../miniprogram/pages/${name}/index.js`);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    Page: (value) => { definition = value; }, require: createRequire(file), wx: global.wx, getApp: global.getApp,
    setInterval: () => 1, clearInterval() {}, setTimeout: (fn) => fn(), Date, console
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
const event = (dataset) => ({ currentTarget: { dataset } });
const record = (q, correct) => storage.recordQuestionResult(q.id, q.moduleId, q.topicId, correct);

test("question counts cover empty, short and large banks; all entry points cap at 20", () => {
  for (const count of [0, 1, 9, 10, 11, 19, 20, 21, 50, 100, 101, 888]) {
    const options = exam.getQuestionCountOptions(count);
    assert.equal(options.length > 0, count > 0);
    for (const option of options) assert.ok(option.value > 0 && option.value <= count && option.value <= 20);
    const source = Array.from({ length: count }, (_, i) => ({ id: String(i) }));
    const chosen = exam.selectQuestions(source.concat(source), 999);
    assert.equal(chosen.length, Math.min(count, 20));
    assert.equal(new Set(chosen.map((q) => q.id)).size, chosen.length);
  }
});
test("free learning retains the exact reading cursor without reducing cloud progress", () => {
  setup(); assert.equal(learning.getLearningOverview().summary.accuracy, null);
  storage.markGroupProgress("idiom", 0, 12, 20);
  learning.saveReadingPosition("idiom", 0, 3);
  const home = page("study"); home.onShow();
  home.onFreeStudy(); assert.equal(navigations.at(-1), "/pages/free-study/index");
  assert.equal(learning.getReadingIndex("idiom", 0, 20), 3);
  const learn = page("learn"); learn.onLoad({ topicId: "idiom", setIndex: "0" });
  assert.equal(learn.data.currentIndex, 3);
  learn.onSwiperChange({ detail: { current: 2 } });
  assert.equal(storage.getGroupProgress("idiom", 0).maxIndex, 12);
  const reopened = page("learn"); reopened.onLoad({ topicId: "idiom", setIndex: "0" });
  assert.equal(reopened.data.currentIndex, 2);
  reopened.onRestart(); assert.equal(learning.getReadingIndex("idiom", 0, 20), 0);
});
test("learning group routes to only its associated questions, leaving bank order intact", () => {
  setup(); const learn = page("learn"); learn.onLoad({ topicId: "idiom", setIndex: "7" });
  assert.equal(learn.data.total, 13);
  learn.onPracticeSet(); const request = app.globalData.examRequest;
  const ids = new Set(content.getKnowledgeSet("idiom", 7).items.map((item) => item.id));
  assert.equal(request.questionIds.length, 13);
  assert.ok(request.questionIds.every((id) => ids.has(content.getQuestionById(id).knowledgeId)));
  const e = page("exam"); e.onShow(); assert.equal(e.data.state, "exam");
  assert.equal(e.data.examQuestions.length, 5);
});
test("practice records on confirmation exactly once; report and repeat submit cannot duplicate counts", () => {
  setup(); const q = content.questions[0]; const e = page("exam"); e.startWithQuestions([q]);
  e.onChooseOption(event({ id: q.answer })); assert.equal(Object.keys(storage.getQuestionStats()).length, 0);
  e.onConfirm(); e.onConfirm();
  assert.equal(storage.getQuestionStats()[q.id].attempts, 1);
  e.onChooseOption(event({ id: q.options.find((o) => o.id !== q.answer).id }));
  assert.equal(e.data.selectedAnswer, q.answer);
  e.onSubmit(); e.submitExam(); assert.equal(storage.getQuestionStats()[q.id].attempts, 1);
  assert.equal(e.data.resultSummary.accuracy, 100);
  e.onResultFilter(event({ filter: "wrong" })); assert.equal(e.data.resultItem, null);
});
test("assessment allows changes and jumping; cancellation preserves state; submit records unanswered once", () => {
  setup(); const source = content.questions.slice(0, 2); const e = page("exam");
  e.setData({ sessionMode: "assessment" }); e.startWithQuestions(source);
  e.onChooseOption(event({ id: source[0].options.find((o) => o.id !== source[0].answer).id }));
  e.onChooseOption(event({ id: source[0].answer })); e.onToggleMark();
  e.goToQuestion(1); assert.equal(Object.keys(storage.getQuestionStats()).length, 0);
  assert.equal(e.data.currentFeedback, null);
  modalConfirm = false; e.onSubmit(); assert.equal(e.data.state, "exam");
  modalConfirm = true; e.onSubmit(); e.submitExam();
  assert.equal(e.data.resultSummary.correctCount, 1); assert.equal(e.data.resultSummary.wrongCount, 1);
  assert.equal(storage.getQuestionStats()[source[1].id].activeWrong, true);
  assert.equal(storage.getPendingAnswerEvents().length, 2);
});
test("same-day correct rounds preserve V4 consolidation while legacy counters keep their history", () => {
  setup(); const q = content.questions[0]; record(q, false);
  const detail = page("review-detail"); detail.onLoad({ topicId: q.topicId }); detail.onShow();
  assert.equal(detail.data.summary.activeWrongCount, 1);
  for (let i = 0; i < 2; i += 1) {
    const e = page("exam"); e.applyRequest({ mode: "wrong", topicId: q.topicId });
    e.onStartExam(); e.onChooseOption(event({ id: q.answer })); e.onConfirm(); e.submitExam();
    detail.onShow();
    assert.equal(detail.data.summary.activeWrongCount, 1);
  }
  detail.onFilter(event({ value: "mastered" })); assert.equal(detail.data.items.length, 0);
  assert.equal(detail.data.summary.masteredCount, 0);
  assert.equal(storage.getQuestionStats()[q.id].attempts, 3);
  assert.equal(storage.getQuestionStats()[q.id].wrong, 1);
  assert.equal(storage.getPendingAnswerEvents().length, 3);
});
test("large wrong-question lists load 40 at a time; practice still uses at most 20", () => {
  setup(); const source = content.questions.filter((q) => q.topicId === "idiom").slice(0, 85);
  source.forEach((q) => record(q, false));
  const detail = page("review-detail"); detail.onLoad({ topicId: "idiom" }); detail.onShow();
  assert.equal(detail.data.items.length, 40); assert.equal(detail.data.ranked.length, 5);
  detail.onMore(); assert.equal(detail.data.items.length, 80);
  const e = page("exam"); e.applyRequest({ mode: "wrong", topicId: "idiom" });
  e.onCountTap(event({ value: 20 })); e.onStartExam(); assert.equal(e.data.examQuestions.length, 20);
});
test("catalog still searches and restores incremental results; invalid learning route has recovery", () => {
  setup(); const catalog = page("catalog"); catalog.onLoad({ topicId: "idiom" });
  assert.equal(catalog.data.items.length, 40);
  const title = content.getKnowledgeByTopic("idiom")[0].title;
  catalog.applyFilter(title); assert.equal(catalog.data.items[0].title, title);
  catalog.applyFilter("不存在的词语00000"); assert.equal(catalog.data.resultCount, 0);
  catalog.onClearSearch(); assert.equal(catalog.data.items.length, 40); assert.equal(catalog.data.total, 888);
  const learn = page("learn"); learn.onLoad({ topicId: "missing" }); assert.equal(learn.data.error, true);
});
