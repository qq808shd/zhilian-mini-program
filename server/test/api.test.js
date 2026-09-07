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
    const first=await put(a,events); assert.equal(first.status,200); assert.equal(first.body.learningVersion,5);
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
    assert.equal(status(merged.body.learningState.records.k,now),'stranger'); assert.deepEqual(merged.body.learningState,replay([wrong,correct]));
    const reset=await put([{id:'reset',kind:'reset',at:now+1}]); assert.equal(reset.body.learningState.records.k.wrongCount,0); assert.ok(reset.body.learningState.records.k.firstLearnedAt);
  } finally { await fixture.close(); }
});

test('daily preferences and 20-item plans sync with explicit capability, bounds and user isolation', async()=>{
  const fixture=await createFixture();
  try {
    const auth=async code=>({Authorization:`Bearer ${(await request(fixture.baseUrl,'/v1/auth/wechat',{method:'POST',body:JSON.stringify({code})})).body.token}`});
    const a=await auth('settings-a'), b=await auth('settings-b'), now=Date.now(),day=require('../../miniprogram/utils/learningModel').dayKey(now);
    const pref={id:'prefs-1',kind:'preferences',at:now,settings:{topicId:'idiom',batchId:'photo800',newCount:20}};
    const plan={id:'plan-20',kind:'plan',at:now+1,day,settings:{...pref.settings,id:pref.id},tasks:Array.from({length:20},(_,i)=>({id:`new:k${i}`,phase:'new',knowledgeId:`k${i}`,questionId:''}))};
    const put=events=>request(fixture.baseUrl,'/v1/sync',{method:'PUT',headers:a,body:JSON.stringify({learningEvents:events})});
    const saved=await put([plan,pref]);assert.equal(saved.status,200);assert.equal(saved.body.learningSettingsVersion,3);assert.equal(saved.body.learningState.studySettings.newCount,20);assert.equal(saved.body.learningState.days[day].tasks.length,20);
    const duplicate=await put([pref,plan]);assert.deepEqual(duplicate.body.learningState,saved.body.learningState);
    assert.equal((await request(fixture.baseUrl,'/v1/sync',{headers:b})).body.learningState.studySettings,undefined);
    assert.equal((await put([{...pref,id:'bad',settings:{...pref.settings,newCount:100}}])).status,400);
    assert.equal((await put([{...plan,id:'oversize',tasks:[...plan.tasks,{id:'new:extra',phase:'new',knowledgeId:'extra'}]}])).status,400);
    assert.equal((await put([{...pref,id:'bad-batch',settings:{...pref.settings,topicId:'poetry'}}])).status,400);
  } finally {await fixture.close();}
});
test('version 2 accepts 200 new items, rejects overflow and syncs resumable progress in batches', async()=>{
  const fixture=await createFixture();
  try {
    const token=(await request(fixture.baseUrl,'/v1/auth/wechat',{method:'POST',body:JSON.stringify({code:'quantity-v2'})})).body.token;
    const headers={Authorization:`Bearer ${token}`},now=Date.now(),model=require('../../miniprogram/utils/learningModel'),day=model.dayKey(now);
    const pref={id:'slider-pref',kind:'preferences',at:now,settings:{version:2,topicId:'idiom',batchId:'',newCount:200}};
    const tasks=['review','new','practice'].flatMap(phase=>Array.from({length:({review:10,new:200,practice:5})[phase]},(_,i)=>({id:`${phase}:k${i}`,phase,knowledgeId:`k${i}`,questionId:phase==='new'?'':`q${i}`})));
    const plan={id:'plan-200',kind:'plan',at:now+1,day,settings:{...pref.settings,id:pref.id},tasks};
    const put=events=>request(fixture.baseUrl,'/v1/sync',{method:'PUT',headers,body:JSON.stringify({learningEvents:events})});
    const saved=await put([pref,plan]);assert.equal(saved.status,200);assert.equal(saved.body.learningSettingsVersion,3);assert.equal(saved.body.learningState.days[day].tasks.length,215);assert.equal(saved.body.learningState.studySettings.version,2);
    for(const newCount of [0,201,1.5]) assert.equal((await put([{...pref,id:`invalid:${newCount}`,settings:{...pref.settings,newCount}}])).status,400);
    assert.equal((await put([{...pref,id:'batch-v2',settings:{...pref.settings,batchId:'original'}}])).status,400);
    assert.equal((await put([{...plan,id:'overflow',tasks:[...tasks,{id:'new:extra',phase:'new',knowledgeId:'extra'}]}])).status,400);
    const completions=tasks.map((t,i)=>({kind:t.phase==='new'?'learn':'answer',at:now+2+i,day,planId:plan.id,taskId:t.id,...t,id:`done:${t.id}`,topicId:'idiom',moduleId:'verbal',correct:true}));
    const first=await put(completions.slice(0,200));assert.equal(first.status,200);assert.equal(Object.keys(first.body.learningState.days[day].completed).length,200);
    const rest=await put(completions.slice(200));assert.equal(rest.status,200);assert.equal(Object.keys(rest.body.learningState.days[day].completed).length,215);
    const again=await put(completions.slice(200));assert.deepEqual(again.body.learningState,rest.body.learningState);
  } finally {await fixture.close();}
});

test('V5 assessment and exemption sync preserves independent progress, idempotence and account isolation', async () => {
  const fixture = await createFixture();
  const model = require('../../miniprogram/utils/learningModel');
  try {
    const auth = async code => ({ Authorization: `Bearer ${(await request(fixture.baseUrl, '/v1/auth/wechat', { method: 'POST', body: JSON.stringify({ code }) })).body.token}` });
    const a = await auth('v5-a'), b = await auth('v5-b'), now = Date.now() - 1000;
    const events = ['none', 'fuzzy', 'remembered'].map((rating, index) => ({
      id: `v5:${rating}`, kind: 'assessment', learningVersion: 5, at: now + index,
      knowledgeId: `k-${index}`, topicId: 'idiom', moduleId: 'verbal', rating
    }));
    const put = (headers, learningEvents) => request(fixture.baseUrl, '/v1/sync', { method: 'PUT', headers, body: JSON.stringify({ learningEvents }) });
    const saved = await put(a, events);
    assert.equal(saved.status, 200); assert.equal(saved.body.initialized, true);
    assert.equal(saved.body.learningVersion, 5); assert.equal(saved.body.learningSettingsVersion, 3);
    events.forEach(event => {
      const record = saved.body.learningState.records[event.knowledgeId];
      assert.equal(record.firstLearnedAt, event.at, 'all three assessments complete learning');
      assert.equal(record.selfRating, event.rating);
      assert.ok(record.nextReviewAt >= model.afterDays(event.at, 1), 'never automatically review on the learning day');
    });
    const duplicate = await put(a, events);
    assert.deepEqual(duplicate.body.learningState, saved.body.learningState);
    assert.equal(duplicate.body.revision, saved.body.revision);
    assert.deepEqual(duplicate.body.ackedLearningEventIds, events.map(event => event.id));
    assert.deepEqual((await request(fixture.baseUrl, '/v1/sync', { headers: b })).body.learningState.records, {});
    const otherUser = await put(b, events);
    assert.deepEqual(otherUser.body.learningState.records, saved.body.learningState.records, 'event IDs are scoped to their account');
    const exemption = { ...events[2], id: 'v5:exempt', kind: 'exemption', excluded: true, at: now + 10 };
    const excluded = await put(a, [exemption]);
    assert.equal(excluded.body.learningState.records['k-2'].excludedFromReview, true);
    assert.equal(excluded.body.learningState.records['k-2'].firstLearnedAt, events[2].at);
    assert.equal(excluded.body.learningState.records['k-2'].nextReviewAt, 0);
    const restored = await put(a, [{ ...exemption, id: 'v5:restore', excluded: false, at: now + 11 }]);
    assert.equal(restored.body.learningState.records['k-2'].excludedFromReview, false);
    assert.ok(restored.body.learningState.records['k-2'].nextReviewAt);
    assert.equal((await request(fixture.baseUrl, '/v1/sync', { headers: b })).body.learningState.records['k-2'].excludedFromReview, false);
  } finally { await fixture.close(); }
});

test('V5 offline events replay in chronological order alongside legacy history and reset safely', async () => {
  const fixture = await createFixture();
  const model = require('../../miniprogram/utils/learningModel');
  try {
    const token = (await request(fixture.baseUrl, '/v1/auth/wechat', { method: 'POST', body: JSON.stringify({ code: 'v5-order' }) })).body.token;
    const headers = { Authorization: `Bearer ${token}` }, now = Date.now() - 1000;
    const legacy = { id: 'legacy:learn', kind: 'learn', at: now - 3 * model.DAY, knowledgeId: 'k', moduleId: 'verbal', topicId: 'idiom', rating: 'fuzzy' };
    const assessment = { ...legacy, id: 'v5:review', kind: 'assessment', learningVersion: 5, at: now, rating: 'remembered' };
    const wrong = { ...assessment, id: 'v5:wrong', kind: 'answer', correct: false, at: now + 1 };
    const put = learningEvents => request(fixture.baseUrl, '/v1/sync', { method: 'PUT', headers, body: JSON.stringify({ learningEvents }) });
    await put([wrong]); await put([assessment]);
    const merged = await put([legacy]);
    // The API only keeps fields appropriate to each event; match normalized replay.
    const normalized = [legacy, assessment, wrong].map(event => ({ ...event, retry: false }));
    assert.deepEqual(merged.body.learningState, JSON.parse(JSON.stringify(model.replay(normalized))));
    assert.equal(merged.body.learningState.records.k.firstLearnedAt, legacy.at);
    assert.equal(merged.body.learningState.records.k.selfRating, 'remembered', 'practice outcomes do not change the chosen proficiency');
    const reset = { id: 'v5:reset', kind: 'reset', learningVersion: 5, at: now + 2 };
    const cleared = await put([reset]);
    assert.equal(cleared.body.learningState.records.k.wrongCount, 0);
    assert.equal(cleared.body.learningState.records.k.firstLearnedAt, legacy.at);
    assert.equal(cleared.body.learningState.records.k.selfRating, 'remembered');
    const duplicate = await put([wrong]);
    assert.deepEqual(duplicate.body.learningState, cleared.body.learningState, 'retransmission cannot resurrect reset answer evidence');
  } finally { await fixture.close(); }
});

test('V5 scoped new/review plans remain independent and malformed new events are rejected atomically', async () => {
  const fixture = await createFixture();
  const model = require('../../miniprogram/utils/learningModel');
  try {
    const token = (await request(fixture.baseUrl, '/v1/auth/wechat', { method: 'POST', body: JSON.stringify({ code: 'v5-plans' }) })).body.token;
    const headers = { Authorization: `Bearer ${token}` }, now = Date.now() - 1000, date = model.dayKey(now);
    const settings = { id: 'v5:pref', version: 3, topicId: 'idiom', batchId: '', newCount: 2 };
    const pref = { id: settings.id, kind: 'preferences', learningVersion: 5, at: now, settings };
    const plan = mode => ({ id: `v5:plan:${mode}`, kind: 'plan', learningVersion: 5, at: now + 1, day: `${date}/${mode}/idiom`, mode, topicId: 'idiom', settings,
      tasks: Array.from({ length: mode === 'new' ? 2 : 25 }, (_, i) => ({ id: `${mode}:k${i}`, phase: mode, knowledgeId: `k${i}`, questionId: '' })) });
    const newPlan = plan('new'), reviewPlan = plan('review');
    const completed = { id: 'v5:completed', kind: 'assessment', learningVersion: 5, at: now + 2, day: newPlan.day, planId: newPlan.id, taskId: 'new:k0', phase: 'new', knowledgeId: 'k0', moduleId: 'verbal', topicId: 'idiom', rating: 'none' };
    const put = learningEvents => request(fixture.baseUrl, '/v1/sync', { method: 'PUT', headers, body: JSON.stringify({ learningEvents }) });
    const saved = await put([pref, newPlan, reviewPlan, completed]);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.learningState.days[newPlan.day].tasks.length, 2);
    assert.equal(saved.body.learningState.days[reviewPlan.day].tasks.length, 25, 'reviews are not capped by the former ten-item phase');
    assert.ok(saved.body.learningState.days[newPlan.day].completed['new:k0']);
    assert.deepEqual(saved.body.learningState.days[reviewPlan.day].completed, {});
    const invalid = [
      { ...completed, rating: undefined }, { ...completed, learningVersion: 4 }, { ...completed, learningVersion: 6 },
      { ...completed, day: `${date}/new/poetry` }, { ...completed, phase: 'retry' },
      { ...completed, kind: 'exemption', excluded: 'true' },
      { ...newPlan, mode: 'review' }, { ...newPlan, day: date },
      { ...newPlan, tasks: Array.from({ length: 201 }, (_, i) => ({ id: `new:k${i}`, phase: 'new', knowledgeId: `k${i}` })) },
      { ...reviewPlan, tasks: Array.from({ length: 2001 }, (_, i) => ({ id: `review:k${i}`, phase: 'review', knowledgeId: `k${i}` })) },
      { ...pref, settings: { ...settings, newCount: 201 } }
    ];
    for (const event of invalid) {
      const rejected = await put([{ ...completed, id: 'must-not-partially-save' }, { ...event, id: 'invalid' }]);
      assert.equal(rejected.status, 400, JSON.stringify(event));
    }
    const unchanged = await request(fixture.baseUrl, '/v1/sync', { headers });
    assert.deepEqual(unchanged.body.learningState, saved.body.learningState);
  } finally { await fixture.close(); }
});

test('scope reset synchronizes with durable progress cutoff, preserves other topics and users, and is idempotent', async()=>{
  const fixture=await createFixture();
  try {
    const login=async code=>({Authorization:`Bearer ${(await request(fixture.baseUrl,'/v1/auth/wechat',{method:'POST',body:JSON.stringify({code})})).body.token}`});
    const a=await login('reset-a'),b=await login('reset-b');
    const put=(headers,body)=>request(fixture.baseUrl,'/v1/sync',{method:'PUT',headers,body:JSON.stringify(body)});
    const at=Date.now()-1000;
    const learned=(id,topic)=>({id:`learn-${id}`,learningVersion:5,kind:'assessment',at,knowledgeId:id,topicId:topic,moduleId:'verbal',rating:'remembered'});
    const progress={idiom_0:{topicId:'idiom',setIndex:0,maxIndex:8,total:10,completed:false,updatedAt:at},poetry_0:{topicId:'poetry',setIndex:0,maxIndex:1,total:2,completed:true,updatedAt:at}};
    const first=await put(a,{learningEvents:[learned('k','idiom'),learned('o','poetry')],progress,events:[{eventId:'answer',questionId:'q',topicId:'idiom',moduleId:'verbal',isCorrect:true,answeredAt:at}]});
    assert.equal(first.status,200);assert.equal(first.body.learningResetVersion,1);
    await put(b,{learningEvents:[learned('k','idiom')],progress});
    const clear={id:'clear-idiom',kind:'reset-learning',learningVersion:5,at:at+100,topicId:'idiom',knowledgeIds:['k']};
    const cleared=await put(a,{learningEvents:[clear],progress});
    assert.equal(cleared.status,200);assert.deepEqual(cleared.body.ackedLearningEventIds,[clear.id]);
    assert.equal(cleared.body.learningState.records.k,undefined);assert.ok(cleared.body.learningState.records.o.firstLearnedAt);
    assert.equal(cleared.body.progress.idiom_0,undefined);assert.deepEqual(cleared.body.progress.poetry_0,first.body.progress.poetry_0);assert.deepEqual(cleared.body.stats,first.body.stats);
    const stale=await put(a,{learningEvents:[{...learned('k','idiom'),id:'late-old'}],progress});
    assert.equal(stale.body.progress.idiom_0,undefined);assert.equal(stale.body.learningState.records.k,undefined);
    const fresh=await put(a,{learningEvents:[{...learned('k','idiom'),id:'new-learning',at:at+200,rating:'none'}],progress:{idiom_0:{...progress.idiom_0,maxIndex:0,updatedAt:at+200}}});
    assert.equal(fresh.body.learningState.records.k.firstLearnedAt,at+200);assert.equal(fresh.body.progress.idiom_0.maxIndex,0);
    const repeated=await put(a,{learningEvents:[clear],progress});
    assert.deepEqual(repeated.body.learningState,fresh.body.learningState);assert.equal(repeated.body.progress.idiom_0.maxIndex,0);
    const untouched=await request(fixture.baseUrl,'/v1/sync',{headers:b});assert.equal(untouched.body.progress.idiom_0.maxIndex,8);assert.ok(untouched.body.learningState.records.k.firstLearnedAt);
    for(const invalid of [{...clear,learningVersion:4},{...clear,knowledgeIds:[]},{...clear,topicId:''}]) assert.equal((await put(a,{learningEvents:[invalid]})).status,400);
  } finally {await fixture.close();}
});
