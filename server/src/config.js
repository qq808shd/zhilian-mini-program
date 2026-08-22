const path = require("node:path");

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`缺少环境变量 ${name}`);
  return normalized;
}

function positiveInteger(value, fallback, name) {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} 必须是正整数`);
  return parsed;
}

function loadConfig(env = process.env) {
  const sessionSecret = required(env.SESSION_SECRET, "SESSION_SECRET");
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET 至少需要 32 个字符");

  return {
    env: env.NODE_ENV || "production",
    host: env.HOST || "127.0.0.1",
    port: positiveInteger(env.PORT, 8787, "PORT"),
    dbPath: env.DB_PATH || path.join(__dirname, "..", "data", "zhilian.sqlite"),
    wechatAppId: required(env.WECHAT_APP_ID, "WECHAT_APP_ID"),
    wechatAppSecret: required(env.WECHAT_APP_SECRET, "WECHAT_APP_SECRET"),
    sessionSecret,
    sessionTtlSeconds: positiveInteger(env.SESSION_TTL_SECONDS, 2592000, "SESSION_TTL_SECONDS"),
    wechatApiTimeoutMs: positiveInteger(env.WECHAT_API_TIMEOUT_MS, 8000, "WECHAT_API_TIMEOUT_MS")
  };
}

module.exports = { loadConfig };
