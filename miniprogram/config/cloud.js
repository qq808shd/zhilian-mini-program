module.exports = {
  // 知练同步服务的正式 HTTPS 入口，密钥仅保存在服务器端。
  enabled: true,
  baseUrl: "https://api.dabaommz.cloud",
  requestTimeout: 10000,
  syncDebounceMs: 1800,
  maxEventBatch: 200
};
