const http = require("node:http");
const { issueSession, verifySession } = require("./session");
const { exchangeWechatCode } = require("./wechat");
const learningModel = require("../../miniprogram/utils/learningModel");

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_BOOTSTRAP_STATS = 3000;
const MAX_PROGRESS_ITEMS = 500;
const MAX_EVENT_BATCH = 200;
const ID_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/;

function apiError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(apiError(413, "BODY_TOO_LARGE", "请求数据过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(apiError(400, "INVALID_JSON", "请求不是有效的 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function safeId(value, fieldName) {
  const normalized = String(value || "");
  if (!ID_PATTERN.test(normalized) || ["__proto__", "constructor", "prototype"].includes(normalized)) throw apiError(400, "INVALID_PAYLOAD", `${fieldName} 格式不正确`);
  return normalized;
}

function safeInteger(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 0), max);
}

function normalizeStat(questionId, value) {
  const attempts = safeInteger(value.attempts, 0, 100000000);
  const correct = Math.min(safeInteger(value.correct, 0, attempts), attempts);
  const wrong = Math.min(safeInteger(value.wrong, 0, attempts), attempts);
  return {
    questionId: safeId(questionId, "questionId"),
    moduleId: safeId(value.moduleId, "moduleId"),
    topicId: safeId(value.topicId, "topicId"),
    attempts,
    correct,
    wrong,
    consecutiveCorrect: safeInteger(value.consecutiveCorrect, 0, attempts),
    activeWrong: Boolean(value.activeWrong),
    lastWrongAt: safeInteger(value.lastWrongAt),
    lastAnsweredAt: safeInteger(value.lastAnsweredAt || value.updatedAt || value.lastWrongAt),
    updatedAt: safeInteger(value.updatedAt || value.lastAnsweredAt || Date.now())
  };
}

function normalizeStats(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source);
  if (entries.length > MAX_BOOTSTRAP_STATS) throw apiError(400, "INVALID_PAYLOAD", "答题统计数量超出限制");
  return Object.fromEntries(entries.map(([id, item]) => [id, normalizeStat(id, item || {})]));
}

function normalizeProgress(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source);
  if (entries.length > MAX_PROGRESS_ITEMS) throw apiError(400, "INVALID_PAYLOAD", "学习进度数量超出限制");
  return Object.fromEntries(entries.map(([key, item]) => {
    const progressKey = safeId(key, "progressKey");
    const total = Math.max(safeInteger(item.total, 1, 10000), 1);
    const maxIndex = Math.min(safeInteger(item.maxIndex, 0, 10000), total - 1);
    return [progressKey, {
      topicId: safeId(item.topicId, "topicId"),
      setIndex: safeInteger(item.setIndex, 0, 10000),
      maxIndex,
      total,
      completed: maxIndex >= total - 1,
      updatedAt: safeInteger(item.updatedAt || Date.now())
    }];
  }));
}

function normalizeEvents(value, limit = MAX_EVENT_BATCH) {
  const source = Array.isArray(value) ? value : [];
  if (source.length > limit) throw apiError(400, "INVALID_PAYLOAD", `单次答题事件超过 ${limit} 条`);
  return source.map((item) => ({
    eventId: safeId(item.eventId, "eventId"),
    questionId: safeId(item.questionId, "questionId"),
    moduleId: safeId(item.moduleId, "moduleId"),
    topicId: safeId(item.topicId, "topicId"),
    isCorrect: Boolean(item.isCorrect),
    answeredAt: safeInteger(item.answeredAt || Date.now())
  }));
}

function normalizeLearningEvents(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) throw apiError(400, "INVALID_PAYLOAD", "学习事件数量超出限制");
  const kinds = ["seed", "start", "learn", "rating", "answer", "recall", "plan", "begin", "group", "reset", "preferences", "assessment", "exemption", "reset-learning"];
  const phases = ["review", "new", "practice", "retry"];
  return value.map((raw) => {
    if (!raw || !kinds.includes(raw.kind)) throw apiError(400, "INVALID_PAYLOAD", "学习事件类型无效");
    if (raw.learningVersion !== undefined && ![4, 5].includes(raw.learningVersion)) throw apiError(400, "INVALID_PAYLOAD", "学习事件版本无效");
    const isV5 = raw.learningVersion === 5;
    if (["assessment", "exemption", "reset-learning"].includes(raw.kind) && !isV5) throw apiError(400, "INVALID_PAYLOAD", "学习事件需要 V5 协议");
    const e = { id: safeId(raw.id, "learningEventId"), kind: raw.kind, at: safeInteger(raw.at, 0, Date.now() + 300000) };
    if (raw.learningVersion !== undefined) e.learningVersion = raw.learningVersion;
    if (!e.at) throw apiError(400, "INVALID_PAYLOAD", "学习时间无效");
    if (raw.settings !== undefined) {
      const s = raw.settings;
      if (!s || !Number.isInteger(s.newCount) || s.newCount < 1 || s.newCount > 200 || (s.version !== undefined && ![1, 2, 3].includes(s.version)) ||
          (s.version === 3 && !isV5) || (![2, 3].includes(s.version) && ![5, 10, 20].includes(s.newCount)) || !['', 'original', 'photo800'].includes(s.batchId || '') ||
          (s.batchId && (s.topicId !== 'idiom' || s.version >= 2))) throw apiError(400, "INVALID_PAYLOAD", "学习设置无效");
      e.settings = { topicId: safeId(s.topicId, "topicId"), batchId: s.batchId || '', newCount: s.newCount };
      if ([2, 3].includes(s.version)) e.settings.version = s.version;
      if (raw.kind === 'plan') e.settings.id = safeId(s.id, 'settingsId');
    }
    if (raw.kind === 'preferences') {
      if (!e.settings) throw apiError(400, "INVALID_PAYLOAD", "缺少学习设置");
      return e;
    }
    if (raw.kind === 'reset-learning') {
      if (!Array.isArray(raw.knowledgeIds) || !raw.knowledgeIds.length || raw.knowledgeIds.length > 2000) throw apiError(400, 'INVALID_PAYLOAD', '清空范围无效');
      return { ...e, topicId: safeId(raw.topicId, 'topicId'), knowledgeIds: [...new Set(raw.knowledgeIds.map(id => safeId(id, 'knowledgeId')))] };
    }
    if (raw.kind === "reset") return e;
    if (raw.kind === "group") return { ...e, groupKey: safeId(raw.groupKey, "groupKey") };
    if (raw.day !== undefined) {
      const pattern = isV5 ? /^\d{4}-\d{2}-\d{2}\/(new|review)\/[a-zA-Z0-9_-]{1,128}$/ : /^\d{4}-\d{2}-\d{2}$/;
      if (!pattern.test(raw.day)) throw apiError(400, "INVALID_PAYLOAD", "学习日期或范围无效");
      e.day = raw.day;
    }
    if (raw.kind === "plan") {
      if (isV5) {
        if (!e.day || !['new', 'review'].includes(raw.mode) || !e.settings || e.settings.version !== 3 ||
            !Array.isArray(raw.tasks) || raw.tasks.length > 2000) throw apiError(400, "INVALID_PAYLOAD", "学习计划无效");
        e.mode = raw.mode; e.topicId = safeId(raw.topicId, "topicId");
        if (e.day.split('/')[1] !== e.mode || e.day.split('/')[2] !== e.topicId || e.settings.topicId !== e.topicId ||
            (e.mode === 'new' && raw.tasks.length > 200)) throw apiError(400, "INVALID_PAYLOAD", "学习计划范围或数量无效");
        const seen = new Set();
        e.tasks = raw.tasks.map((t) => {
          if (!t || t.phase !== e.mode || seen.has(t.id) || t.id !== `${e.mode}:${t.knowledgeId}` || t.questionId) throw apiError(400, "INVALID_PAYLOAD", "学习任务无效");
          seen.add(t.id);
          return { id: safeId(t.id, "taskId"), phase: t.phase, knowledgeId: safeId(t.knowledgeId, "knowledgeId"), questionId: '' };
        });
        return e;
      }
      if (!e.day || !Array.isArray(raw.tasks) || raw.tasks.length > 215) throw apiError(400, "INVALID_PAYLOAD", "今日任务无效");
      const limits = { review: 10, new: e.settings ? e.settings.newCount : 10, practice: 5 }, seen = new Set();
      e.tasks = raw.tasks.map((t) => {
        if (!t || !limits[t.phase] || seen.has(t.id)) throw apiError(400, "INVALID_PAYLOAD", "今日任务顺序或数量无效");
        limits[t.phase] -= 1; seen.add(t.id);
        return { id: safeId(t.id, "taskId"), phase: t.phase, knowledgeId: safeId(t.knowledgeId, "knowledgeId"), questionId: t.questionId ? safeId(t.questionId, "questionId") : "" };
      });
      const order = { review: 0, new: 1, practice: 2 };
      if (e.tasks.some((t, i) => i && order[t.phase] < order[e.tasks[i - 1].phase])) throw apiError(400, "INVALID_PAYLOAD", "今日任务阶段顺序无效");
      return e;
    }
    if (raw.taskId) {
      e.taskId = safeId(raw.taskId, "taskId"); e.planId = safeId(raw.planId, "planId");
      if (!e.day) throw apiError(400, "INVALID_PAYLOAD", "缺少任务日期");
    }
    if (raw.kind === "begin") {
      if (!e.taskId) throw apiError(400, "INVALID_PAYLOAD", "缺少任务");
      return e;
    }
    e.knowledgeId = safeId(raw.knowledgeId, "knowledgeId");
    e.moduleId = safeId(raw.moduleId, "moduleId"); e.topicId = safeId(raw.topicId, "topicId");
    if (isV5 && e.day && e.day.split('/')[2] !== e.topicId) throw apiError(400, "INVALID_PAYLOAD", "学习任务分类不一致");
    if (raw.kind === 'assessment' && !['none', 'fuzzy', 'remembered'].includes(raw.rating)) throw apiError(400, "INVALID_PAYLOAD", "缺少学习程度");
    if (raw.kind === 'exemption') {
      if (typeof raw.excluded !== 'boolean') throw apiError(400, "INVALID_PAYLOAD", "熟知标记无效");
      e.excluded = raw.excluded;
    }
    if (raw.kind === "seed") { e.learned = raw.learned === true; e.wrong = safeInteger(raw.wrong, 0, 100000000); return e; }
    if (raw.questionId) e.questionId = safeId(raw.questionId, "questionId");
    if (["answer", "recall"].includes(raw.kind)) {
      if (typeof raw.correct !== "boolean") throw apiError(400, "INVALID_PAYLOAD", "缺少检验结果");
      e.correct = raw.correct;
    }
    if (raw.rating) {
      if (!["none", "fuzzy", "remembered"].includes(raw.rating)) throw apiError(400, "INVALID_PAYLOAD", "自评无效");
      e.rating = raw.rating;
    }
    if (raw.phase) {
      if (!(isV5 ? ['new', 'review'] : phases).includes(raw.phase) || (isV5 && e.day && e.day.split('/')[1] !== raw.phase)) throw apiError(400, "INVALID_PAYLOAD", "阶段无效");
      e.phase = raw.phase;
    }
    e.retry = raw.phase === "retry" && !!e.taskId;
    return e;
  });
}

function normalizeSyncPayload(body) {
  const bootstrap = body.bootstrap && typeof body.bootstrap === "object" ? {
    stats: normalizeStats(body.bootstrap.stats),
    progress: normalizeProgress(body.bootstrap.progress),
    events: normalizeEvents(body.bootstrap.events, MAX_BOOTSTRAP_STATS)
  } : null;
  return {
    bootstrap,
    learningEvents: normalizeLearningEvents(body.learningEvents),
    events: normalizeEvents(body.events),
    progress: normalizeProgress(body.progress),
    resetStats: Boolean(body.resetStats)
  };
}

function createRateLimiter(limit, intervalMs) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + intervalMs });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

function getClientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function createApiHandler({ config, database, exchangeCode = exchangeWechatCode }) {
  const allowGeneralRequest = createRateLimiter(240, 60 * 1000);
  const allowLoginRequest = createRateLimiter(30, 60 * 1000);

  function authenticate(request) {
    const authorization = String(request.headers.authorization || "");
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const session = verifySession(token, config.sessionSecret);
    if (!session) throw apiError(401, "UNAUTHORIZED", "登录状态无效或已过期");
    const user = database.getUserById(session.sub);
    if (!user) throw apiError(401, "UNAUTHORIZED", "用户不存在");
    return user;
  }

  return async function handler(request, response) {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const ip = getClientIp(request);
    if (!allowGeneralRequest(ip)) return sendJson(response, 429, { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试" });

    try {
      if (request.method === "GET" && requestUrl.pathname === "/health") {
        return sendJson(response, 200, { ok: true, learningVersion: learningModel.VERSION, learningSettingsVersion: 3, learningResetVersion: learningModel.LEARNING_RESET_VERSION, groupVersion: 1, service: "zhilian-sync-api", serverTime: Date.now() });
      }

      if (request.method === "POST" && requestUrl.pathname === "/v1/auth/wechat") {
        if (!allowLoginRequest(ip)) throw apiError(429, "RATE_LIMITED", "登录请求过于频繁");
        const body = await readJson(request);
        const code = String(body.code || "").trim();
        if (!code || code.length > 128) throw apiError(400, "INVALID_CODE", "缺少有效的微信登录凭证");
        const identity = await exchangeCode(code, config);
        const user = database.getOrCreateUser(identity.openid, identity.unionid);
        const token = issueSession(user.id, config.sessionSecret, config.sessionTtlSeconds);
        return sendJson(response, 200, {
          token,
          expiresAt: Date.now() + config.sessionTtlSeconds * 1000,
          user: { id: user.id },
          serverTime: Date.now()
        });
      }

      if (requestUrl.pathname === "/v1/groups" || requestUrl.pathname.startsWith("/v1/groups/")) {
        const user = authenticate(request);
        return sendJson(response, 200, await require("./groups/routes").groupRoute({ request, url: requestUrl, user, groups: database.groups, readJson }));
      }

      if (request.method === "GET" && requestUrl.pathname === "/v1/sync") {
        const user = authenticate(request);
        return sendJson(response, 200, { ...database.getSnapshot(user.id), serverTime: Date.now() });
      }

      if (request.method === "PUT" && requestUrl.pathname === "/v1/sync") {
        const user = authenticate(request);
        const payload = normalizeSyncPayload(await readJson(request));
        return sendJson(response, 200, { ...database.applySync(user.id, payload), serverTime: Date.now() });
      }

      return sendJson(response, 404, { code: "NOT_FOUND", message: "接口不存在" });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error(`[${new Date().toISOString()}]`, error);
      return sendJson(response, statusCode, {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode >= 500 ? "服务器暂时不可用" : error.message
      });
    }
  };
}

function createApiServer(options) {
  return http.createServer(createApiHandler(options));
}

module.exports = { createApiHandler, createApiServer, normalizeSyncPayload };
