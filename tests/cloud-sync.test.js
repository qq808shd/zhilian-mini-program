const test = require("node:test");
const assert = require("node:assert/strict");

const store = new Map();
const requests = [];
let app = { globalData: { cloudSync: {} } };

global.getApp = () => app;
global.wx = {
  getAccountInfoSync() { return { miniProgram: { envVersion: "develop" } }; },
  getStorageSync(key) { return store.get(key); },
  setStorageSync(key, value) { store.set(key, value); },
  removeStorageSync(key) { store.delete(key); },
  login(options) { queueMicrotask(() => options.success({ code: "login-code" })); },
  request(options) {
    requests.push(options);
    const path = new URL(options.url).pathname;
    let data;
    if (path === "/v1/auth/wechat") {
      data = { token: "session-token", expiresAt: Date.now() + 3600000, user: { id: "user-1" } };
    } else if (path === "/v1/sync" && options.method === "GET") {
      data = { initialized: false, revision: 0, stats: {}, progress: {}, learningVersion: 5, learningSettingsVersion: 3,
        learningState: require("../miniprogram/utils/learningModel").emptyState() };
    } else if (path === "/v1/sync" && options.method === "PUT") {
      data = {
        learningVersion: 5,
        learningSettingsVersion: 3,
        learningState: require("../miniprogram/utils/learningModel").replay(options.data.learningEvents || []),
        ackedLearningEventIds: (options.data.learningEvents || []).map((e) => e.id),
        initialized: true,
        revision: 1,
        stats: options.data.bootstrap.stats,
        progress: options.data.bootstrap.progress,
        ackedEventIds: options.data.bootstrap.events.map((event) => event.eventId)
      };
    } else {
      return queueMicrotask(() => options.fail(new Error("unexpected request")));
    }
    queueMicrotask(() => options.success({ statusCode: 200, data }));
  }
};

const cloudConfig = require("../miniprogram/config/cloud");
cloudConfig.enabled = true;
cloudConfig.baseUrl = "https://api.test.example";
cloudConfig.syncDebounceMs = 60000;

const storage = require("../miniprogram/utils/storage");
const cloudSync = require("../miniprogram/utils/cloudSync");

test("首次登录会把本机历史作为基线导入云端并清理待同步事件", async () => {
  storage.recordQuestionResult("q-cloud-1", "verbal", "idiom", false);
  storage.markGroupProgress("idiom", 0, 4, 20);
  assert.equal(storage.getPendingAnswerEvents().length, 1);

  require("../miniprogram/utils/account").acceptTerms();
  await cloudSync.initializeCloudSync();

  assert.deepEqual(requests.map((item) => `${item.method || "GET"} ${new URL(item.url).pathname}`), [
    "POST /v1/auth/wechat",
    "GET /v1/sync",
    "PUT /v1/sync"
  ]);
  const upload = requests[2].data;
  assert.equal(upload.bootstrap.stats["q-cloud-1"].attempts, 1);
  assert.equal(upload.bootstrap.progress.idiom_0.maxIndex, 4);
  assert.equal(upload.bootstrap.events.length, 1);
  assert.deepEqual(upload.events, []);
  assert.equal(storage.getPendingAnswerEvents().length, 0);
  assert.equal(storage.isCloudSyncDirty(), false);
  assert.equal(app.globalData.cloudSync.state, "ready");
});

// Exercise the request/acknowledgement boundary independently of the scheduler.
// Timers are held so offline retry remains observable without real waiting.
function syncFixture({ pending, pendingAnswers = [], remote = {}, result = {}, duringPut } = {}) {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const events = pending || [{ id: 'v5-local', learningVersion: 5, kind: 'assessment', rating: 'none' }];
  const local = new Map(), calls = [], timers = new Map(), state = { globalData: {} };
  const snapshot = { initialized: true, learningVersion: 5, learningSettingsVersion: 3, learningResetVersion: 1, learningState: { version: 5, records: {} }, stats: {}, progress: {} };
  const engine = {
    model: { LEARNING_RESET_VERSION: 1 }, getState: () => ({ learningResets: {} }),
    repairDailyAnswers() {}, importLegacySnapshot() {}, getPendingEvents() { return events; },
    applySnapshot(value, acked = []) {
      if (value.learningVersion !== 5 || !value.learningState || value.learningState.version !== 5) return false;
      for (let i = events.length - 1; i >= 0; i--) if (acked.includes(events[i].id)) events.splice(i, 1);
      return true;
    }
  };
  const context = vm.createContext({
    module: { exports: {} }, console: { warn() {} }, getApp: () => state,
    setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === './learningEngine') return engine;
      if (name === '../config/cloud') return { enabled: true, baseUrl: 'https://sync.test', syncDebounceMs: 1000 };
      if (name === './account') return { isSyncAuthorized: () => true, stopSyncPreference() {} };
      if (name === './storage') return {
        getQuestionStats: () => ({}), getStudyProgress: () => ({}), getPendingAnswerEvents: () => pendingAnswers, getStatsResetPending: () => false,
        isCloudSyncDirty: () => events.length > 0 || pendingAnswers.length > 0,
        applyCloudSnapshot(value, ids) { for (let i = pendingAnswers.length - 1; i >= 0; i--) if (ids.includes(pendingAnswers[i].eventId)) pendingAnswers.splice(i, 1); },
        setCloudSyncScheduler() {}
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    wx: {
      getStorageSync: key => local.get(key), setStorageSync: (key, value) => local.set(key, value), removeStorageSync: key => local.delete(key),
      login(options) { queueMicrotask(() => options.success({ code: 'test' })); },
      request(options) {
        calls.push(options);
        let data;
        if (options.url.endsWith('/auth/wechat')) data = { token: 'test', expiresAt: Date.now() + 3600000 };
        else if (options.method === 'GET') data = { ...snapshot, ...remote };
        else { if (duringPut) duringPut(events); data = { ...snapshot, ackedLearningEventIds: options.data.learningEvents.map(event => event.id), ...result }; }
        queueMicrotask(() => { options.success({ statusCode: 200, data }); options.complete(); });
        return { abort() {} };
      }
    }
  });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../miniprogram/utils/cloudSync.js'), 'utf8'), context);
  return { cloud: context.module.exports, calls, events, pendingAnswers, state };
}

test('V5 assessments and exclusions never reach an older server or lose their queued IDs', async () => {
  for (const kind of ['assessment', 'exemption']) {
    const fixture = syncFixture({ pending: [{ id: kind, kind, learningVersion: 5 }], remote: { learningVersion: 4, learningState: { version: 4 } } });
    await fixture.cloud.syncCloudData();
    assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 0);
    assert.deepEqual(fixture.events.map(event => event.id), [kind]);
    assert.match(fixture.state.globalData.cloudSync.lastError, /V5/);
    fixture.cloud.stopCloudSync();
  }
});

test('V5 settings need advertised version 3 before upload', async () => {
  const fixture = syncFixture({ pending: [{ id: 'settings', kind: 'preferences', learningVersion: 5, settings: { version: 3 } }], remote: { learningSettingsVersion: 2 } });
  await fixture.cloud.syncCloudData();
  assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 0);
  assert.equal(fixture.events.length, 1);
  assert.match(fixture.state.globalData.cloudSync.lastError, /学习设置/);
  fixture.cloud.stopCloudSync();
});

test('a clean device does not report cloud learning restored from an incompatible GET snapshot', async () => {
  const fixture = syncFixture({ pending: [], remote: { learningVersion: 4, learningState: { version: 4 } } });
  await fixture.cloud.syncCloudData();
  assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 0);
  assert.equal(fixture.state.globalData.cloudSync.state, 'offline');
  assert.match(fixture.state.globalData.cloudSync.lastError, /V5/);
  fixture.cloud.stopCloudSync();
});

test('a downgraded or invalid PUT snapshot cannot acknowledge V5 records', async () => {
  for (const result of [
    { learningVersion: 4, learningState: { version: 4 } },
    { learningVersion: 6, learningState: { version: 5 } },
    { learningVersion: 5, learningState: { version: 4 } },
    { learningVersion: 5, learningState: null }
  ]) {
    const fixture = syncFixture({ result });
    await fixture.cloud.syncCloudData();
    assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 1);
    assert.equal(fixture.events.length, 1);
    assert.equal(fixture.state.globalData.cloudSync.state, 'offline');
    fixture.cloud.stopCloudSync();
  }
});

test('only explicitly acknowledged IDs from this sent batch are removed', async () => {
  const pending = [
    { id: 'acknowledged', kind: 'assessment', learningVersion: 5 },
    { id: 'unacknowledged', kind: 'exemption', learningVersion: 5 }
  ];
  const fixture = syncFixture({ pending,
    result: { ackedLearningEventIds: ['acknowledged', 'created-in-flight'] },
    duringPut(events) { events.push({ id: 'created-in-flight', kind: 'assessment', learningVersion: 5 }); }
  });
  await fixture.cloud.syncCloudData();
  assert.deepEqual(fixture.events.map(event => event.id), ['unacknowledged', 'created-in-flight']);
  fixture.cloud.stopCloudSync();
});

test('bootstrap answer events remain queued when another device initialized the account before PUT', async () => {
  const fixture = syncFixture({ pending: [], pendingAnswers: [{ eventId: 'bootstrap-answer' }], remote: { initialized: false }, result: { ackedEventIds: [] } });
  await fixture.cloud.syncCloudData();
  assert.equal(fixture.calls.find(call => call.method === 'PUT').data.bootstrap.events.length, 1);
  assert.deepEqual(fixture.pendingAnswers, [{ eventId: 'bootstrap-answer' }]);
  fixture.cloud.stopCloudSync();
});

test('a PUT response losing settings capability does not consume the preference event', async () => {
  const fixture = syncFixture({ pending: [{ id: 'settings', kind: 'preferences', learningVersion: 5, settings: { version: 3 } }], result: { learningSettingsVersion: 2 } });
  await fixture.cloud.syncCloudData();
  assert.equal(fixture.calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(fixture.events.length, 1);
  assert.match(fixture.state.globalData.cloudSync.lastError, /学习设置/);
  fixture.cloud.stopCloudSync();
});

test('learning reset requires dedicated capability before PUT and before acknowledging a response',async()=>{
  for(const missingAt of ['GET','PUT']) {
    const event={id:'scoped-clear',kind:'reset-learning',learningVersion:5,topicId:'idiom',knowledgeIds:['k']};
    const fixture=syncFixture({pending:[event],...(missingAt==='GET'?{remote:{learningResetVersion:undefined}}:{result:{learningResetVersion:undefined}})});
    await fixture.cloud.syncCloudData();
    assert.equal(fixture.calls.filter(c=>c.method==='PUT').length,missingAt==='GET'?0:1);
    assert.equal(fixture.events.length,1);assert.match(fixture.state.globalData.cloudSync.lastError,/清空/);fixture.cloud.stopCloudSync();
  }
});
