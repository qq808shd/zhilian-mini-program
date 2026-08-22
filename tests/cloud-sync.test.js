const test = require("node:test");
const assert = require("node:assert/strict");

const store = new Map();
const requests = [];
let app = { globalData: { cloudSync: {} } };

global.getApp = () => app;
global.wx = {
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
      data = { initialized: false, revision: 0, stats: {}, progress: {} };
    } else if (path === "/v1/sync" && options.method === "PUT") {
      data = {
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
