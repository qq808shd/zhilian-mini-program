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

test("V4 learning events survive duplicate uploads, isolate users, and restore daily progression", async () => {
  const fixture = await createFixture();
  try {
    const login = async (code) => { const r = await request(fixture.baseUrl, '/v1/auth/wechat', { method:'POST', body:JSON.stringify({code}) }); return {Authorization:`Bearer ${r.body.token}`}; };
    const a=await login('v4-a'), b=await login('v4-b');
    const now=Date.now(), day=require('../../miniprogram/utils/learningModel').dayKey(now);
    const events=[
      {id:'plan-one',kind:'plan',at:now,day,tasks:[{id:'new:k1',phase:'new',knowledgeId:'k1',questionId:''}]},
      {id:'learn-one',kind:'learn',at:now+1,knowledgeId:'k1',moduleId:'m1',topicId:'t1',rating:'fuzzy',day,planId:'plan-one',taskId:'new:k1',phase:'new'}
    ];
    const put=(headers,learningEvents)=>request(fixture.baseUrl,'/v1/sync',{method:'PUT',headers,body:JSON.stringify({learningEvents})});
    const first=await put(a,events); assert.equal(first.status,200); assert.equal(first.body.learningVersion,4);
    assert.equal(first.body.learningState.records.k1.selfRating,'fuzzy'); assert.ok(first.body.learningState.days[day].completed['new:k1']);
    const again=await put(a,events); assert.deepEqual(again.body.learningState,first.body.learningState); assert.deepEqual(again.body.ackedLearningEventIds,events.map(e=>e.id));
    const empty=await request(fixture.baseUrl,'/v1/sync',{headers:b}); assert.deepEqual(empty.body.learningState.records,{});
    const other=await put(b,events); assert.ok(other.body.learningState.records.k1,'same event ID in a different user is not lost');
    const invalid=await put(a,[{...events[1],rating:'unexpected'}]); assert.equal(invalid.status,400);
    const snapshot=await request(fixture.baseUrl,'/v1/sync',{headers:a}); assert.deepEqual(snapshot.body.learningState,first.body.learningState);
  } finally { await fixture.close(); }
});

test("V4 reordered offline results replay chronologically and reset preserves learning completion", async () => {
  const { replay, afterDays, status }=require('../../miniprogram/utils/learningModel');
  const fixture=await createFixture();
  try {
    const login=await request(fixture.baseUrl,'/v1/auth/wechat',{method:'POST',body:JSON.stringify({code:'v4-order'})});
    const headers={Authorization:`Bearer ${login.body.token}`}; const now=Date.now();
    const wrong={id:'older',kind:'answer',at:now-1000,knowledgeId:'k',topicId:'t',moduleId:'m',correct:false};
    const correct={...wrong,id:'newer',at:now,correct:true};
    const put=(events)=>request(fixture.baseUrl,'/v1/sync',{method:'PUT',headers,body:JSON.stringify({learningEvents:events})});
    await put([correct]); const merged=await put([wrong]);
    assert.equal(merged.body.learningState.records.k.reviewStage,1); assert.equal(merged.body.learningState.records.k.nextReviewAt,afterDays(now,1));
    assert.equal(status(merged.body.learningState.records.k,now),'consolidating'); assert.deepEqual(merged.body.learningState,replay([wrong,correct]));
    const reset=await put([{id:'reset',kind:'reset',at:now+1}]); assert.equal(reset.body.learningState.records.k.wrongCount,0); assert.ok(reset.body.learningState.records.k.firstLearnedAt);
  } finally { await fixture.close(); }
});
