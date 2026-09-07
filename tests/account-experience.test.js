const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const account = require("../miniprogram/utils/account");
const profile = require("../miniprogram/utils/profile");
const product = require("../miniprogram/config/product");
const storage = require("../miniprogram/utils/storage");
let store, app, timers, navigations, deleted, copied, modalConfirm, storageFailure;
function setup() {
  store = new Map(); app = { globalData: { cloudSync: {}, launchTarget: null } };
  timers = new Map(); navigations = []; deleted = []; copied = []; modalConfirm = false; storageFailure = false;
  storage.setCloudSyncScheduler(() => {});
  global.getApp = () => app;
  global.wx = {
    env: { USER_DATA_PATH: "/user" },
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    getStorageSync: (key) => structuredClone(store.get(key)),
    setStorageSync: (key, value) => { if (storageFailure) throw new Error("disk full"); store.set(key, structuredClone(value)); },
    removeStorageSync: (key) => store.delete(key),
    canIUse: () => true, hideKeyboard() {}, showToast() {}, setNavigationBarTitle() {},
    navigateTo: (o) => navigations.push(o.url), redirectTo: (o) => navigations.push(o.url),
    switchTab: (o) => navigations.push(o.url), reLaunch: (o) => navigations.push(o.url),
    navigateBack: () => navigations.push("back"),
    showModal: (o) => { assert.ok(o.confirmText.length <= 4); o.success({ confirm: modalConfirm }); },
    getImageInfo: (o) => o.success({ type: "png" }),
    getFileSystemManager: () => ({
      stat: (o) => o.success({ stats: { size: 1000 } }),
      copyFile: (o) => { copied.push(o.destPath); o.success(); },
      unlinkSync: (file) => deleted.push(file)
    })
  };
}
function load(relative, page = false, overrides = {}) {
  const file = path.resolve(__dirname, "../miniprogram/", relative);
  const module = { exports: {} };
  let result, nextTimer = 1;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    module, exports: module.exports, require: (name) => overrides[name] || createRequire(file)(name), wx, getApp,
    Page: (value) => { result = value; },
    setTimeout: (fn) => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id), setInterval: () => 1, clearInterval() {},
    Date, console: { warn() {} }
  }, { filename: file });
  if (!page) return module.exports;
  result.data = structuredClone(result.data);
  result.setData = function(values) { Object.assign(this.data, values); };
  return result;
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const page = (name) => load(`pages/${name}/index.js`, true);

test("My keeps automatic sync out of the menu and copies the configured contact email", () => {
  setup(); let clipboard;
  wx.setClipboardData = options => { clipboard = options.data; options.success(); };
  const p = page("me"); p.onShow();
  assert.equal(p.data.email, "386305161@qq.com");
  assert.equal(p.data.sync, undefined);
  assert.equal(p.onSync, undefined);
  p.onContact(); assert.equal(clipboard, p.data.email);
  assert.deepEqual(navigations, []);
});

test("legacy review links enter automatic review directly", () => {
  setup(); page("review").onLoad();
  assert.deepEqual(navigations, ["/pages/today-study/index?mode=review"]);
});

test("entry requires consent, including legacy local users; preview cannot authorize draft release or changed policy", () => {
  setup(); assert.equal(account.needsWelcome(), true); assert.equal(account.isSyncAuthorized(), false);
  account.chooseLocalMode(); assert.equal(account.needsWelcome(), true);
  assert.throws(() => account.enableSyncPreference());
  account.acceptTerms(); assert.equal(account.isSyncAuthorized(), true);
  const original = { ...product };
  try {
    product.policyVersion += "-changed";
    assert.equal(account.isSyncAuthorized(), false); assert.equal(account.needsWelcome(), true);
    Object.assign(product, original);
    wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: "release" } });
    assert.equal(account.isSyncAuthorized(), false); assert.throws(() => account.acceptTerms());
    Object.assign(product, { published: true, operator: "Test operator", contactEmail: "test@example.invalid", filingNumber: "TEST ONLY", effectiveDate: "2026-09-05" });
    assert.equal(account.hasCurrentConsent(), false);
    account.acceptTerms(); assert.equal(account.isSyncAuthorized(), true);
    account.stopSyncPreference(); assert.equal(account.isSyncAuthorized(), false);
    account.enableSyncPreference(); assert.equal(account.isSyncAuthorized(), true);
  } finally { Object.assign(product, original); }
});

test("initialization, foreground sync and local answer writes make no network calls without consent", async () => {
  setup(); let calls = 0;
  wx.login = wx.request = () => { calls++; throw new Error("must stay local"); };
  const cloud = load("utils/cloudSync.js");
  await cloud.initializeCloudSync(); storage.recordQuestionResult("q-local", "verbal", "idiom", false);
  await cloud.syncCloudData(); cloud.scheduleCloudSync();
  assert.equal(calls, 0); assert.equal(timers.size, 0);
  assert.equal(storage.getPendingAnswerEvents().length, 1);
  assert.equal(app.globalData.cloudSync.state, "local");
});

test("stopping during wx.login rejects the late code and cannot restart from the next answer", async () => {
  setup(); account.acceptTerms(); let login, requests = 0;
  wx.login = (o) => { login = o; }; wx.request = () => { requests++; };
  const cloud = load("utils/cloudSync.js");
  const pending = cloud.initializeCloudSync(); cloud.stopCloudSync();
  login.success({ code: "late-code" }); await pending;
  storage.recordQuestionResult("q-late", "verbal", "idiom", false);
  assert.equal(requests, 0); assert.equal(timers.size, 0);
  assert.equal(store.has("zhilian_cloud_auth_v1"), false);
  assert.equal(storage.getPendingAnswerEvents().length, 1);
});

test("stopping aborts requests; stale responses cannot overwrite records or interfere with a newly enabled run", async () => {
  setup(); account.acceptTerms();
  store.set("zhilian_cloud_auth_v1", { token: "test", expiresAt: Date.now() + 3600000 });
  storage.recordQuestionResult("q-kept", "verbal", "idiom", false);
  const requests = []; let aborted = 0;
  wx.request = (o) => { requests.push(o); return { abort() { aborted++; } }; };
  const cloud = load("utils/cloudSync.js");
  const first = cloud.initializeCloudSync(); await flush();
  cloud.stopCloudSync(); assert.equal(aborted, 1);
  account.enableSyncPreference(); const second = cloud.syncCloudData(); await flush();
  requests[0].success({ statusCode: 200, data: { initialized: true, stats: {}, progress: {} } });
  requests[0].complete(); await first;
  assert.equal(cloud.syncCloudData(), second);
  assert.equal(storage.getQuestionStats()["q-kept"].attempts, 1);
  assert.equal(requests.length, 2);
  requests[1].fail(new Error("offline")); requests[1].complete(); await second;
  assert.equal(app.globalData.cloudSync.state, "offline"); assert.equal(timers.size, 1);
  cloud.stopCloudSync(); assert.equal(timers.size, 0);
  assert.equal(storage.getPendingAnswerEvents().length, 1);
});

test("late PUT acknowledgement after stopping cannot discard pending local answers", async () => {
  setup(); account.acceptTerms();
  store.set("zhilian_cloud_auth_v1", { token: "test", expiresAt: Date.now() + 3600000 });
  storage.recordQuestionResult("q-put", "verbal", "idiom", false);
  const requests = []; wx.request = (o) => { requests.push(o); return { abort() {} }; };
  const cloud = load("utils/cloudSync.js"); const run = cloud.initializeCloudSync(); await flush();
  requests[0].success({ statusCode: 200, data: { initialized: true } }); requests[0].complete(); await flush();
  assert.equal(requests[1].method, "PUT"); cloud.stopCloudSync();
  requests[1].success({ statusCode: 200, data: { initialized: true, stats: {}, progress: {}, ackedEventIds: requests[1].data.events.map((e) => e.eventId) } });
  requests[1].complete(); await run;
  assert.equal(storage.getQuestionStats()["q-put"].attempts, 1);
  assert.equal(storage.getPendingAnswerEvents().length, 1);
  assert.equal(store.has("zhilian_sync_status_v1"), false);
});

test("avatar is copied before save; failed replacement rolls back only the new file; deletion preserves learning", async () => {
  setup(); storage.markGroupProgress("idiom", 0, 3, 20);
  const saved = await profile.saveProfile({ nickname: "  小知  ", avatar: "/tmp/avatar.png" });
  assert.equal(saved.nickname, "小知"); assert.ok(saved.avatar.startsWith("/user/zhilian-avatar-"));
  assert.equal(profile.getProfile().avatar, copied[0]);
  storageFailure = true;
  await assert.rejects(profile.saveProfile({ nickname: "新昵称", avatar: "/tmp/another.png" }), /资料保存失败/);
  storageFailure = false;
  assert.equal(profile.getProfile().avatar, saved.avatar); assert.deepEqual(deleted, [copied[1]]);
  await assert.rejects(profile.saveProfile({ nickname: "字".repeat(25), avatar: saved.avatar }), /最多/);
  profile.deleteProfile(); assert.equal(profile.getProfile().nickname, "知练同学");
  assert.ok(deleted.includes(saved.avatar)); assert.equal(storage.getGroupProgress("idiom", 0).maxIndex, 3);
});

test("nickname waits for native review; rejection does not save and approval completes pending submission", async () => {
  setup(); const p = page("profile"); p.onLoad({});
  p.onNicknameInput({ detail: { value: "知行" } }); p.onNicknameBlur({ detail: { value: "知行" } });
  await p.onSave({ detail: { value: { nickname: "知行" } } });
  assert.equal(profile.getProfile().customized, false); assert.equal(p.data.saving, true);
  p.onNicknameReview({ detail: { pass: false } });
  assert.equal(profile.getProfile().customized, false); assert.equal(p.data.saving, false);
  p.onNicknameInput({ detail: { value: "小知" } }); p.onNicknameBlur({ detail: { value: "小知" } });
  await p.onSave({ detail: { value: { nickname: "小知" } } });
  p.onNicknameReview({ detail: { pass: true } }); await flush();
  assert.equal(profile.getProfile().nickname, "小知"); assert.equal(navigations.at(-1), "back");
  assert.equal(timers.size, 0);
});

test("skipping profile leaves it untouched and restores the original learning destination", () => {
  setup(); account.acceptTerms(); app.globalData.launchTarget = { path: "pages/learn/index", query: { topicId: "idiom", setIndex: "7" } };
  const p = page("profile"); p.onLoad({ onboarding: "1" });
  p.onChooseAvatar({ detail: {} }); p.onNicknameInput({ detail: { value: "未保存" } }); p.onSkip();
  assert.equal(profile.getProfile().customized, false);
  assert.equal(navigations.at(-1), "/pages/learn/index?topicId=idiom&setIndex=7");
  assert.equal(app.globalData.launchTarget, null);
});

test("welcome never accepts unchecked terms and has no local bypass", () => {
  setup(); const w = page("welcome"); w.onLoad({}); w.onContinue();
  assert.equal(account.hasCurrentConsent(), false); assert.equal(navigations.length, 0);
  w.onLegal({ currentTarget: { dataset: { kind: "privacy" } } });
  assert.equal(navigations.at(-1), "/pages/legal/index?kind=privacy");
  assert.equal(w.data.agreed, false); assert.equal(w.onLocal, undefined);
  assert.equal(account.needsWelcome(), true); assert.equal(account.isSyncAuthorized(), false);
  require("../miniprogram/utils/accountNavigation").finishOnboarding();
  assert.equal(navigations.at(-1), "/pages/welcome/index");
});

test("settings cancellation is inert; answer reset preserves learning and records cloud reset", () => {
  setup(); storage.recordQuestionResult("q-reset", "verbal", "idiom", false); storage.markGroupProgress("idiom", 0, 6, 20);
  const s = page("settings"); s.onShow(); s.onClear();
  assert.equal(storage.getQuestionStats()["q-reset"].attempts, 1);
  modalConfirm = true; s.onClear();
  assert.equal(Object.keys(storage.getQuestionStats()).length, 0);
  assert.equal(storage.getGroupProgress("idiom", 0).maxIndex, 6);
  assert.ok(storage.getStatsResetPending());
});


test("agreeing once starts automatic sync without a separate switch or profile requirement", () => {
  setup(); let syncCalls = 0;
  const w = load("pages/welcome/index.js", true, { "../../utils/cloudSync": { syncCloudData() { syncCalls++; return Promise.resolve(); } } });
  w.onLoad({}); w.onAgreement({ detail: { value: ["agree"] } }); w.onContinue();
  assert.equal(account.isSyncAuthorized(), true); assert.equal(syncCalls, 1);
  assert.equal(profile.getProfile().customized, false);
  assert.equal(navigations.at(-1), "/pages/profile/index?onboarding=1");
  const next = page("welcome"); next.onLoad({});
  assert.equal(navigations.at(-1), "/pages/study/index");
});

test("a new answer schedules and uploads automatically after consent", async () => {
  setup(); account.acceptTerms(); const requests = [];
  wx.login = (o) => queueMicrotask(() => o.success({ code: "test-code" }));
  wx.request = (o) => {
    requests.push(o);
    const data = o.url.endsWith("/auth/wechat") ? { token: "test", expiresAt: Date.now() + 3600000 }
      : { initialized: true, revision: 1, stats: storage.getQuestionStats(), progress: storage.getStudyProgress(),
          ackedEventIds: o.method === "PUT" ? o.data.events.map((e) => e.eventId) : [] };
    queueMicrotask(() => { o.success({ statusCode: 200, data }); o.complete(); });
    return { abort() {} };
  };
  const cloud = load("utils/cloudSync.js"); await cloud.initializeCloudSync();
  storage.recordQuestionResult("q-auto", "verbal", "idiom", false);
  assert.equal(timers.size, 1);
  const [id, scheduled] = timers.entries().next().value; timers.delete(id); scheduled();
  await cloud.syncCloudData();
  const uploads = requests.filter((r) => r.method === "PUT");
  assert.equal(uploads.length, 1); assert.equal(uploads[0].data.events[0].questionId, "q-auto");
  assert.equal(storage.getPendingAnswerEvents().length, 0);
  assert.equal(app.globalData.cloudSync.state, "ready");
});

test("legacy sync URL returns to profile without manual sync or changing authorization", () => {
  setup();account.acceptTerms();account.stopSyncPreference();const saved=account.getPreferences();
  const p=load('pages/sync-status/index.js',true);p.onLoad();
  assert.equal(p.onSync,undefined);assert.deepEqual(account.getPreferences(),saved);assert.equal(navigations.at(-1),'/pages/me/index');
});

test("page guard blocks deep links, tab re-entry and stale consent while allowing legal reading", () => {
  setup(); const { guardPage } = require("../miniprogram/utils/consentGate");
  wx.nextTick = (fn) => fn();
  wx.reLaunch = (o) => { navigations.push(o.url); o.complete && o.complete(); };
  let calls = 0;
  const p = guardPage({ onLoad() { calls++; }, onShow() { calls++; } });
  p.route = "pages/learn/index";
  p.onLoad({ topicId: "idiom", setIndex: "7" }); p.onShow();
  assert.equal(calls, 0); assert.equal(navigations.at(-1), "/pages/welcome/index");
  assert.deepEqual(app.globalData.launchTarget, { path: p.route, query: { topicId: "idiom", setIndex: "7" } });
  const legal = guardPage({ onLoad() { calls++; } }); legal.route = "pages/legal/index";
  legal.onLoad({ kind: "privacy" }); assert.equal(calls, 1);
  account.acceptTerms(); p.onLoad({}); p.onShow(); assert.equal(calls, 3);
  account.stopSyncPreference(); p.onShow(); assert.equal(calls, 3);
  account.acceptTerms(); p.onShow(); assert.equal(calls, 4);
  const version = product.policyVersion;
  try { product.policyVersion += "-new"; p.onShow(); assert.equal(calls, 4); }
  finally { product.policyVersion = version; }
});

test("app registers the consent guard for every page", () => {
  setup(); let registered, application;
  const file = path.resolve(__dirname, "../miniprogram/app.js");
  const context = vm.createContext({ require: createRequire(file), Page(value) { registered = value; }, App(value) { application = value; } });
  vm.runInContext(fs.readFileSync(file, "utf8"), context);
  let shown = 0;
  context.Page({ onShow() { shown++; } }); registered.route = "pages/study/index";
  wx.nextTick = (fn) => fn(); registered.onShow();
  assert.equal(shown, 0); assert.equal(navigations.at(-1), "/pages/welcome/index");
  account.acceptTerms(); registered.onShow(); assert.equal(shown, 1);
  assert.equal(typeof application.onShow, "function");
});

test('an older V4 server cannot acknowledge and discard learning settings it does not understand', async()=>{
  setup(); account.acceptTerms(); const engine=require('../miniprogram/utils/learningEngine');
  engine.saveStudySettings({topicId:'idiom',newCount:200});
  wx.login=o=>queueMicrotask(()=>o.success({code:'test'}));
  wx.request=o=>{
    const data=o.url.endsWith('/auth/wechat') ? {token:'t',expiresAt:Date.now()+3600000} : {
      initialized:true,learningVersion:4,learningSettingsVersion:1,learningState:engine.model.emptyState(),stats:{},progress:{},
      ackedLearningEventIds:o.method==='PUT' ? o.data.learningEvents.map(e=>e.id) : []
    };
    queueMicrotask(()=>{o.success({statusCode:200,data});o.complete();});return {abort(){}};
  };
  const cloud=load('utils/cloudSync.js');await cloud.initializeCloudSync();
  assert.equal(app.globalData.cloudSync.state,'offline');assert.match(app.globalData.cloudSync.lastError,/学习设置/);
  assert.ok(engine.getPendingEvents().some(e=>e.kind==='preferences'));assert.equal(engine.getStudySettings().newCount,200);
  cloud.stopCloudSync();
});
