const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createDatabase } = require('../src/database');
const { createApiServer } = require('../src/api');
const engine = require('../../miniprogram/utils/learningEngine');
const storage = require('../../miniprogram/utils/storage');
const model = engine.model;
const json = value => JSON.parse(JSON.stringify(value));

async function fixture() {
  const local = new Map();
  global.wx = {
    getStorageSync: key => structuredClone(local.get(key)),
    setStorageSync: (key, value) => local.set(key, structuredClone(value)),
    removeStorageSync: key => local.delete(key)
  };
  global.getApp = () => ({ globalData: {} });
  storage.setCloudSyncScheduler(() => {});
  const database = createDatabase(':memory:');
  const server = createApiServer({
    database,
    config: { sessionSecret: 'test-session-secret-for-real-learning-flow-32-characters', sessionTtlSeconds: 3600 },
    exchangeCode: async code => ({ openid: `test-${code}`, unionid: '' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let token = '';
  const request = async (path, body) => {
    const response = await fetch(baseUrl + path, {
      method: body ? path.endsWith('/wechat') ? 'POST' : 'PUT' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  token = (await request('/v1/auth/wechat', { code: 'flow' })).token;
  return {
    request,
    async close() { server.close(); await once(server, 'close'); database.close(); }
  };
}

test('actual V5 engine events round-trip learning, scoped plans, familiarity and due review through HTTP/SQLite', async () => {
  const api = await fixture();
  try {
    let at = model.afterDays(Date.now(), -1) + 10 * 3600000;
    const tick = () => ++at;
    const sentHistory = [];
    const sync = async (now, inFlight) => {
      const events = json(engine.getPendingEvents());
      assert.ok(events.length && events.length <= 200);
      const pendingResponse = api.request('/v1/sync', { learningEvents: events });
      if (inFlight) inFlight();
      const snapshot = await pendingResponse;
      sentHistory.push(...events);
      assert.deepEqual(snapshot.ackedLearningEventIds, events.map(event => event.id));
      assert.deepEqual(snapshot.learningState, json(model.replay(sentHistory, null, now)), 'API normalization preserves the real client event semantics');
      const unsent = engine.getPendingEvents().filter(event => !events.some(sent => sent.id === event.id));
      assert.equal(engine.applySnapshot(snapshot, snapshot.ackedLearningEventIds, now), true);
      assert.deepEqual(engine.getPendingEvents().map(event => event.id), unsent.map(event => event.id));
      assert.deepEqual(json(engine.getState(now)), json(model.replay(unsent, snapshot.learningState, now)));
      return snapshot;
    };

    engine.saveStudySettings({ topicId: 'idiom', newCount: 4 }, tick());
    const learned = [];
    for (const result of [{ rating: 'none' }, { rating: 'fuzzy' }, { rating: 'remembered' }, { excluded: true }]) {
      const view = engine.dailyView(tick());
      learned.push(view.next.knowledgeId);
      engine.beginTask(tick());
      assert.equal(engine.completeTask(view.next.id, result, tick()), true);
    }
    const finished = engine.dailyView(tick());
    assert.equal(finished.completed, 4); assert.equal(finished.remaining, 0);
    assert.equal(engine.topicSummary('idiom', at).learnedCount, 4);
    assert.equal(engine.getKnowledgeView(learned[3], at).excluded, true);

    // Reducing today's target must retain all four actual completions, including
    // the unfamiliar and exempt items, without restarting this day's work.
    engine.saveStudySettings({ topicId: 'idiom', newCount: 1 }, tick());
    const reduced = engine.dailyView(tick());
    assert.equal(reduced.goal, 1); assert.equal(reduced.completed, 4); assert.equal(reduced.remaining, 0);
    engine.saveStudySettings({ topicId: 'poetry', newCount: 1 }, tick());
    const other = engine.dailyView(tick());
    assert.notEqual(other.sessionKey, reduced.sessionKey);
    assert.equal(engine.completeTask(other.next.id, { rating: 'none' }, tick()), true);
    const first = await sync(at);
    assert.equal(first.learningState.days[reduced.sessionKey].tasks.length, 4);
    assert.equal(Object.keys(first.learningState.days[reduced.sessionKey].completed).length, 4);
    assert.equal(Object.keys(first.learningState.days[other.sessionKey].completed).length, 1);
    assert.equal(engine.getPendingEvents().length, 0);

    // The next calendar day offers only due, learned knowledge in this scope.
    at = Date.now() - 1000;
    const dueBefore = engine.reviewItems('idiom', at).filter(item => item.due).map(item => item.id);
    assert.ok(dueBefore.includes(learned[0]));
    assert.ok(!dueBefore.includes(learned[3]), 'familiarity excludes a learned item from automatic review');
    const review = engine.dailyView(tick(), 'review', 'idiom');
    assert.equal(review.remaining, dueBefore.length);
    assert.ok(review.sessionKey.endsWith('/review/idiom'));
    let completed = 0;
    while (true) {
      const current = engine.dailyView(tick(), 'review', 'idiom');
      if (!current.next) break;
      engine.beginTask(tick(), 'review', 'idiom');
      assert.equal(engine.completeTask(current.next.id, { rating: completed ? 'remembered' : 'none' }, tick(), 'review', 'idiom'), true);
      completed++;
      assert.ok(completed <= dueBefore.length, 'marking unfamiliar does not append same-day retry work');
    }
    assert.equal(completed, dueBefore.length);
    assert.equal(engine.reviewItems('idiom', at).filter(item => item.due).length, 0);
    const second = await sync(at, () => engine.setFamiliar(learned[3], false, tick()));
    assert.equal(engine.getPendingEvents().length, 1, 'an action created while uploading is not consumed by the earlier acknowledgement');
    assert.equal(second.learningState.records[learned[3]].excludedFromReview, true);
    assert.equal(engine.getState(at).records[learned[3]].excludedFromReview, false);
    const third = await sync(at);
    assert.equal(third.learningState.records[learned[3]].excludedFromReview, false);
    assert.equal(engine.getPendingEvents().length, 0);

    const duplicate = await api.request('/v1/sync', { learningEvents: sentHistory.slice(-2) });
    assert.deepEqual(duplicate.learningState, third.learningState);
    assert.equal(duplicate.revision, third.revision);
  } finally { await api.close(); }
});

test('explicit cross-topic new and review scopes cap their own quantities without changing saved preferences', async () => {
  const api = await fixture();
  try {
    const content = require('../../miniprogram/data/content');
    const poetry = content.getKnowledgeByTopic('poetry');
    const now = Date.now() - 1000;
    engine.learn(poetry[0].id, 'none', model.afterDays(now, -1) + 1000);
    engine.saveStudySettings({ topicId: 'idiom', newCount: 200 }, now);
    const savedPreferences = engine.getStudySettings(now);
    const idiom = engine.dailyView(now + 1);
    const poetryNew = engine.dailyView(now + 2, 'new', 'poetry');
    const poetryReview = engine.dailyView(now + 3, 'review', 'poetry');
    assert.equal(idiom.goal, 200);
    assert.equal(poetryNew.goal, poetry.length);
    assert.equal(poetryReview.goal, poetry.length);
    assert.equal(poetryNew.remaining, 1);
    assert.equal(poetryReview.remaining, 1);
    assert.equal(engine.completeTask(poetryReview.next.id, { rating: 'remembered' }, now + 4, 'review', 'poetry'), true);
    assert.deepEqual(engine.getStudySettings(now + 5), savedPreferences);
    const events = engine.getPendingEvents();
    assert.deepEqual(events.filter(event => event.kind === 'preferences').map(event => event.settings.topicId), ['idiom']);
    const snapshot = await api.request('/v1/sync', { learningEvents: events });
    assert.deepEqual(snapshot.ackedLearningEventIds, events.map(event => event.id));
    assert.equal(snapshot.learningState.days[idiom.sessionKey].settings.newCount, 200);
    assert.equal(snapshot.learningState.days[poetryNew.sessionKey].settings.newCount, poetry.length);
    assert.equal(snapshot.learningState.days[poetryReview.sessionKey].settings.newCount, poetry.length);
    assert.equal(snapshot.learningState.studySettings.topicId, 'idiom');
    assert.equal(snapshot.learningState.studySettings.newCount, 200);
    assert.equal(engine.applySnapshot(snapshot, snapshot.ackedLearningEventIds, now + 5), true);
    assert.equal(engine.getPendingEvents().length, 0);
    assert.deepEqual(engine.getStudySettings(now + 5), savedPreferences);
  } finally { await api.close(); }
});
