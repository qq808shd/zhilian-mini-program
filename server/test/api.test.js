const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createDatabase } = require("../src/database");
const { createApiServer } = require("../src/api");

const config = {
  sessionSecret: "test-session-secret-that-is-longer-than-32-characters",
  sessionTtlSeconds: 3600,
  wechatAppId: "test-app-id",
  wechatAppSecret: "test-app-secret",
  wechatApiTimeoutMs: 1000
};

async function createFixture() {
  const database = createDatabase(":memory:");
  const server = createApiServer({
    config,
    database,
    exchangeCode: async (code) => ({ openid: `openid-${code}`, unionid: "" })
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    database,
    server,
    baseUrl,
    async close() {
      server.close();
      await once(server, "close");
      database.close();
    }
  };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  return { status: response.status, body: await response.json() };
}

test("健康检查、登录、首次导入和幂等答题同步", async () => {
  const fixture = await createFixture();
  try {
    const health = await request(fixture.baseUrl, "/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    const login = await request(fixture.baseUrl, "/v1/auth/wechat", {
      method: "POST",
      body: JSON.stringify({ code: "user-a" })
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    const headers = { Authorization: `Bearer ${login.body.token}` };

    const empty = await request(fixture.baseUrl, "/v1/sync", { headers });
    assert.equal(empty.body.initialized, false);

    const bootstrap = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        bootstrap: {
          stats: {
            "q-1": {
              questionId: "q-1",
              moduleId: "verbal",
              topicId: "idiom",
              attempts: 2,
              correct: 1,
              wrong: 1,
              consecutiveCorrect: 0,
              activeWrong: true,
              lastWrongAt: 100,
              lastAnsweredAt: 100,
              updatedAt: 100
            }
          },
          progress: {
            idiom_0: { topicId: "idiom", setIndex: 0, maxIndex: 3, total: 20, updatedAt: 100 }
          },
          events: [{
            eventId: "device-1:baseline-event",
            questionId: "q-1",
            moduleId: "verbal",
            topicId: "idiom",
            isCorrect: false,
            answeredAt: 100
          }]
        },
        events: [],
        progress: {}
      })
    });
    assert.equal(bootstrap.body.initialized, true);
    assert.equal(bootstrap.body.stats["q-1"].attempts, 2);
    assert.equal(bootstrap.body.progress.idiom_0.maxIndex, 3);
    assert.deepEqual(bootstrap.body.ackedEventIds, ["device-1:baseline-event"]);

    const baselineRetry = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        events: [{
          eventId: "device-1:baseline-event",
          questionId: "q-1",
          moduleId: "verbal",
          topicId: "idiom",
          isCorrect: false,
          answeredAt: 100
        }],
        progress: {}
      })
    });
    assert.equal(baselineRetry.body.stats["q-1"].attempts, 2);

    const eventPayload = {
      events: [{
        eventId: "device-1:event-1",
        questionId: "q-1",
        moduleId: "verbal",
        topicId: "idiom",
        isCorrect: true,
        answeredAt: 200
      }],
      progress: {},
      resetStats: false
    };
    const firstPush = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers,
      body: JSON.stringify(eventPayload)
    });
    assert.equal(firstPush.body.stats["q-1"].attempts, 3);
    assert.equal(firstPush.body.stats["q-1"].activeWrong, true);

    const duplicatePush = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers,
      body: JSON.stringify(eventPayload)
    });
    assert.equal(duplicatePush.body.stats["q-1"].attempts, 3);
    assert.deepEqual(duplicatePush.body.ackedEventIds, ["device-1:event-1"]);

    const secondCorrect = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        events: [{
          eventId: "device-1:event-2",
          questionId: "q-1",
          moduleId: "verbal",
          topicId: "idiom",
          isCorrect: true,
          answeredAt: 300
        }],
        progress: {}
      })
    });
    assert.equal(secondCorrect.body.stats["q-1"].attempts, 4);
    assert.equal(secondCorrect.body.stats["q-1"].activeWrong, false);
  } finally {
    await fixture.close();
  }
});

test("用户数据相互隔离，清空统计不会删除学习进度", async () => {
  const fixture = await createFixture();
  try {
    async function login(code) {
      const response = await request(fixture.baseUrl, "/v1/auth/wechat", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      return { Authorization: `Bearer ${response.body.token}` };
    }
    const userA = await login("a");
    const userB = await login("b");
    await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers: userA,
      body: JSON.stringify({
        bootstrap: { stats: {}, progress: {}, events: [] },
        events: [{ eventId: "a:event", questionId: "q-a", moduleId: "verbal", topicId: "idiom", isCorrect: false, answeredAt: 100 }],
        progress: { idiom_0: { topicId: "idiom", setIndex: 0, maxIndex: 5, total: 20, updatedAt: 100 } }
      })
    });

    const stateB = await request(fixture.baseUrl, "/v1/sync", { headers: userB });
    assert.deepEqual(stateB.body.stats, {});
    assert.deepEqual(stateB.body.progress, {});

    const resetA = await request(fixture.baseUrl, "/v1/sync", {
      method: "PUT",
      headers: userA,
      body: JSON.stringify({ resetStats: true, events: [], progress: {} })
    });
    assert.deepEqual(resetA.body.stats, {});
    assert.equal(resetA.body.progress.idiom_0.maxIndex, 5);
  } finally {
    await fixture.close();
  }
});
