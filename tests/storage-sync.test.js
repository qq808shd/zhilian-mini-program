const test = require("node:test");
const assert = require("node:assert/strict");

const store = new Map();
global.wx = {
  getStorageSync(key) { return store.get(key); },
  setStorageSync(key, value) { store.set(key, value); },
  removeStorageSync(key) { store.delete(key); }
};

const storage = require("../miniprogram/utils/storage");

test("答题事件先保存在本地，云端确认后不会重复累计", () => {
  storage.recordQuestionResult("q-test-1", "verbal", "idiom", false);
  storage.recordQuestionResult("q-test-1", "verbal", "idiom", true);
  storage.recordQuestionResult("q-test-1", "verbal", "idiom", true);

  const local = storage.getQuestionStats()["q-test-1"];
  const events = storage.getPendingAnswerEvents();
  assert.equal(local.attempts, 3);
  assert.equal(local.wrong, 1);
  assert.equal(local.activeWrong, false);
  assert.equal(events.length, 3);
  assert.equal(storage.isCloudSyncDirty(), true);

  storage.applyCloudSnapshot({
    stats: {
      "q-test-1": {
        questionId: "q-test-1",
        moduleId: "verbal",
        topicId: "idiom",
        attempts: 2,
        correct: 1,
        wrong: 1,
        consecutiveCorrect: 1,
        activeWrong: true,
        lastWrongAt: events[0].answeredAt,
        lastAnsweredAt: events[1].answeredAt,
        updatedAt: events[1].answeredAt,
        errorRate: 50
      }
    },
    progress: {}
  }, events.slice(0, 2).map((event) => event.eventId));

  const merged = storage.getQuestionStats()["q-test-1"];
  assert.equal(merged.attempts, 3);
  assert.equal(merged.activeWrong, false);
  assert.equal(storage.getPendingAnswerEvents().length, 1);
});

test("学习进度取较大位置，清空答题会生成云端重置信号", () => {
  storage.markGroupProgress("idiom", 0, 5, 20);
  storage.applyCloudSnapshot({
    stats: {},
    progress: {
      idiom_0: { topicId: "idiom", setIndex: 0, maxIndex: 3, total: 20, updatedAt: 1 }
    }
  });
  assert.equal(storage.getGroupProgress("idiom", 0).maxIndex, 5);

  storage.clearQuestionStats();
  assert.deepEqual(storage.getQuestionStats(), {});
  assert.equal(storage.getStatsResetPending(), true);
  assert.equal(storage.isCloudSyncDirty(), true);
});
