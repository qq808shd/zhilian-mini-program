const learningModel = require("../../miniprogram/utils/learningModel");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

function ensureDatabaseDirectory(dbPath) {
  if (dbPath === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

function toBoolean(value) {
  return Boolean(Number(value));
}

function createDatabase(dbPath, options = {}) {
  ensureDatabaseDirectory(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openid TEXT NOT NULL UNIQUE,
      unionid TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_meta (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      initialized INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS question_stats (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      correct INTEGER NOT NULL DEFAULT 0,
      wrong INTEGER NOT NULL DEFAULT 0,
      consecutive_correct INTEGER NOT NULL DEFAULT 0,
      active_wrong INTEGER NOT NULL DEFAULT 0,
      last_wrong_at INTEGER NOT NULL DEFAULT 0,
      last_answered_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS answer_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS answer_events_user_question
      ON answer_events(user_id, question_id, answered_at);
    CREATE TABLE IF NOT EXISTS learning_events (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL, occurred_at INTEGER NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS study_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress_key TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      max_index INTEGER NOT NULL,
      total INTEGER NOT NULL,
      completed INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, progress_key)
    );
  `);

  const groups = require("./groups/service").createGroupService(db, options.groups);

  const statements = {
    insertLearning: db.prepare("INSERT OR IGNORE INTO learning_events(user_id, event_id, occurred_at, payload) VALUES (?, ?, ?, ?)"),
    listLearning: db.prepare("SELECT payload FROM learning_events WHERE user_id = ? ORDER BY occurred_at, event_id"),
    getUserByOpenid: db.prepare("SELECT * FROM users WHERE openid = ?"),
    getUserById: db.prepare("SELECT * FROM users WHERE id = ?"),
    insertUser: db.prepare("INSERT INTO users(id, openid, unionid, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)"),
    touchUser: db.prepare("UPDATE users SET unionid = CASE WHEN ? = '' THEN unionid ELSE ? END, last_seen_at = ? WHERE id = ?"),
    insertMeta: db.prepare("INSERT OR IGNORE INTO sync_meta(user_id, initialized, revision, updated_at) VALUES (?, 0, 0, ?)"),
    getMeta: db.prepare("SELECT initialized, revision, updated_at FROM sync_meta WHERE user_id = ?"),
    updateMeta: db.prepare("UPDATE sync_meta SET initialized = ?, revision = revision + ?, updated_at = ? WHERE user_id = ?"),
    listStats: db.prepare("SELECT * FROM question_stats WHERE user_id = ?"),
    getStat: db.prepare("SELECT * FROM question_stats WHERE user_id = ? AND question_id = ?"),
    upsertStat: db.prepare(`
      INSERT INTO question_stats(
        user_id, question_id, module_id, topic_id, attempts, correct, wrong,
        consecutive_correct, active_wrong, last_wrong_at, last_answered_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        module_id = excluded.module_id,
        topic_id = excluded.topic_id,
        attempts = excluded.attempts,
        correct = excluded.correct,
        wrong = excluded.wrong,
        consecutive_correct = excluded.consecutive_correct,
        active_wrong = excluded.active_wrong,
        last_wrong_at = excluded.last_wrong_at,
        last_answered_at = excluded.last_answered_at,
        updated_at = excluded.updated_at
    `),
    deleteStats: db.prepare("DELETE FROM question_stats WHERE user_id = ?"),
    deleteEvents: db.prepare("DELETE FROM answer_events WHERE user_id = ?"),
    insertEvent: db.prepare(`
      INSERT OR IGNORE INTO answer_events(
        event_id, user_id, question_id, module_id, topic_id, is_correct, answered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listProgress: db.prepare("SELECT * FROM study_progress WHERE user_id = ?"),
    deleteScopeProgress: db.prepare("DELETE FROM study_progress WHERE user_id = ? AND topic_id = ? AND updated_at <= ?"),
    getProgress: db.prepare("SELECT * FROM study_progress WHERE user_id = ? AND progress_key = ?"),
    upsertProgress: db.prepare(`
      INSERT INTO study_progress(
        user_id, progress_key, topic_id, set_index, max_index, total, completed, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, progress_key) DO UPDATE SET
        topic_id = excluded.topic_id,
        set_index = excluded.set_index,
        max_index = excluded.max_index,
        total = excluded.total,
        completed = excluded.completed,
        updated_at = excluded.updated_at
    `)
  };

  function transaction(callback) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function getOrCreateUser(openid, unionid = "") {
    const now = Date.now();
    let user = statements.getUserByOpenid.get(openid);
    if (!user) {
      const id = randomUUID();
      statements.insertUser.run(id, openid, unionid, now, now);
      statements.insertMeta.run(id, now);
      user = statements.getUserById.get(id);
    } else {
      statements.touchUser.run(unionid, unionid, now, user.id);
      statements.insertMeta.run(user.id, now);
      user = statements.getUserById.get(user.id);
    }
    return user;
  }

  function getUserById(userId) {
    return statements.getUserById.get(userId) || null;
  }

  function getSnapshot(userId) {
    const meta = statements.getMeta.get(userId) || { initialized: 0, revision: 0, updated_at: 0 };
    const stats = {};
    statements.listStats.all(userId).forEach((item) => {
      stats[item.question_id] = {
        questionId: item.question_id,
        moduleId: item.module_id,
        topicId: item.topic_id,
        attempts: item.attempts,
        correct: item.correct,
        wrong: item.wrong,
        consecutiveCorrect: item.consecutive_correct,
        activeWrong: toBoolean(item.active_wrong),
        lastWrongAt: item.last_wrong_at,
        lastAnsweredAt: item.last_answered_at,
        updatedAt: item.updated_at,
        errorRate: item.attempts ? Number(((item.wrong / item.attempts) * 100).toFixed(1)) : 0
      };
    });

    const progress = {};
    statements.listProgress.all(userId).forEach((item) => {
      progress[item.progress_key] = {
        topicId: item.topic_id,
        setIndex: item.set_index,
        maxIndex: item.max_index,
        total: item.total,
        completed: toBoolean(item.completed),
        updatedAt: item.updated_at
      };
    });

    const learningState = learningModel.replay(statements.listLearning.all(userId).map(r => JSON.parse(r.payload)));
    return {
      initialized: toBoolean(meta.initialized),
      revision: meta.revision,
      updatedAt: meta.updated_at,
      stats,
      progress: learningModel.filterResetProgress(progress, learningState.learningResets),
      learningVersion: learningModel.VERSION,
      learningSettingsVersion: 3,
      learningResetVersion: learningModel.LEARNING_RESET_VERSION,
      learningState
    };
  }

  function writeStat(userId, item) {
    statements.upsertStat.run(
      userId,
      item.questionId,
      item.moduleId,
      item.topicId,
      item.attempts,
      item.correct,
      item.wrong,
      item.consecutiveCorrect,
      item.activeWrong ? 1 : 0,
      item.lastWrongAt,
      item.lastAnsweredAt,
      item.updatedAt
    );
  }

  function writeProgress(userId, key, incoming) {
    const previous = statements.getProgress.get(userId, key);
    let next = incoming;
    if (previous) {
      const maxIndex = Math.max(previous.max_index, incoming.maxIndex);
      const useIncomingShape = incoming.updatedAt >= previous.updated_at;
      const total = useIncomingShape ? incoming.total : previous.total;
      next = {
        ...incoming,
        topicId: useIncomingShape ? incoming.topicId : previous.topic_id,
        setIndex: useIncomingShape ? incoming.setIndex : previous.set_index,
        maxIndex,
        total,
        completed: maxIndex >= total - 1,
        updatedAt: Math.max(previous.updated_at, incoming.updatedAt)
      };
    }
    statements.upsertProgress.run(
      userId,
      key,
      next.topicId,
      next.setIndex,
      next.maxIndex,
      next.total,
      next.completed ? 1 : 0,
      next.updatedAt
    );
  }

  function applyAnswerEvent(userId, event, now) {
    const result = statements.insertEvent.run(
      event.eventId,
      userId,
      event.questionId,
      event.moduleId,
      event.topicId,
      event.isCorrect ? 1 : 0,
      event.answeredAt,
      now
    );
    if (Number(result.changes) === 0) return false;

    const previous = statements.getStat.get(userId, event.questionId);
    const current = previous ? {
      attempts: previous.attempts,
      correct: previous.correct,
      wrong: previous.wrong,
      consecutiveCorrect: previous.consecutive_correct,
      activeWrong: toBoolean(previous.active_wrong),
      lastWrongAt: previous.last_wrong_at,
      lastAnsweredAt: previous.last_answered_at
    } : {
      attempts: 0,
      correct: 0,
      wrong: 0,
      consecutiveCorrect: 0,
      activeWrong: false,
      lastWrongAt: 0,
      lastAnsweredAt: 0
    };

    const isLatest = event.answeredAt >= current.lastAnsweredAt;
    const next = {
      questionId: event.questionId,
      moduleId: event.moduleId,
      topicId: event.topicId,
      attempts: current.attempts + 1,
      correct: current.correct + (event.isCorrect ? 1 : 0),
      wrong: current.wrong + (event.isCorrect ? 0 : 1),
      consecutiveCorrect: current.consecutiveCorrect,
      activeWrong: current.activeWrong,
      lastWrongAt: event.isCorrect ? current.lastWrongAt : Math.max(current.lastWrongAt, event.answeredAt),
      lastAnsweredAt: Math.max(current.lastAnsweredAt, event.answeredAt),
      updatedAt: now
    };
    if (isLatest && event.isCorrect) {
      next.consecutiveCorrect = current.consecutiveCorrect + 1;
      if (next.consecutiveCorrect >= 2) next.activeWrong = false;
    }
    if (isLatest && !event.isCorrect) {
      next.consecutiveCorrect = 0;
      next.activeWrong = true;
    }
    writeStat(userId, next);
    return true;
  }

  function applySync(userId, payload) {
    const now = Date.now();
    const ackedEventIds = [];
    const ackedLearningEventIds = [];
    let changed = false;

    transaction(() => {
      const meta = statements.getMeta.get(userId);
      (payload.learningEvents || []).forEach((event) => {
        const result = statements.insertLearning.run(userId, event.id, event.at, JSON.stringify(event));
        if (Number(result.changes)) changed = true;
        ackedLearningEventIds.push(event.id);
      });
      const learningState = learningModel.replay(statements.listLearning.all(userId).map(r => JSON.parse(r.payload)));
      const resets = learningState.learningResets || {};
      Object.entries(resets).forEach(([topicId, reset]) => {
        if (Number(statements.deleteScopeProgress.run(userId, topicId, reset.at).changes)) changed = true;
      });
      const writeScopedProgress = progress => Object.entries(learningModel.filterResetProgress(progress, resets)).forEach(([key, item]) => {
        writeProgress(userId, key, item); changed = true;
      });
      if (payload.resetStats) {
        const deletedStats = statements.deleteStats.run(userId);
        const deletedEvents = statements.deleteEvents.run(userId);
        changed = changed || Number(deletedStats.changes) > 0 || Number(deletedEvents.changes) > 0;
      }

      if (!toBoolean(meta.initialized) && payload.bootstrap) {
        Object.values(payload.bootstrap.stats).forEach((item) => writeStat(userId, item));
        writeScopedProgress(payload.bootstrap.progress);
        payload.bootstrap.events.forEach((event) => {
          statements.insertEvent.run(
            event.eventId,
            userId,
            event.questionId,
            event.moduleId,
            event.topicId,
            event.isCorrect ? 1 : 0,
            event.answeredAt,
            now
          );
          ackedEventIds.push(event.eventId);
        });
        changed = true;
      }

      payload.events.forEach((event) => {
        if (applyAnswerEvent(userId, event, now)) changed = true;
        ackedEventIds.push(event.eventId);
      });
      writeScopedProgress(payload.progress);


      const initialized = toBoolean(meta.initialized) || Boolean(payload.bootstrap) || payload.events.length > 0 || (payload.learningEvents || []).length > 0 || Object.keys(payload.progress).length > 0 || payload.resetStats;
      statements.updateMeta.run(initialized ? 1 : 0, changed ? 1 : 0, now, userId);
    });

    return { ...getSnapshot(userId), ackedEventIds, ackedLearningEventIds };
  }

  return {
    groups,
    getOrCreateUser,
    getUserById,
    getSnapshot,
    applySync,
    close() { db.close(); }
  };
}

module.exports = { createDatabase };
