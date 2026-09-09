const { requestAuthenticated } = require('./cloudSync');
function requestId() { return 'group:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
async function read(path = '') { return requestAuthenticated({ path: '/v1/groups' + path }); }
async function write(path, data, method = 'POST') {
  return requestAuthenticated({ path: '/v1/groups' + path, method, data });
}
function errorText(error) {
  error = error || {};
  if (error.code === 'SYNC_STOPPED') return '请先阅读并同意当前协议后使用学习小组。';
  if (error.statusCode === 404 && error.code === 'NOT_FOUND') return '学习小组服务暂未开放，请稍后再试。';
  const detail = String(error.errMsg || error.message || '');
  if (/url not in domain list/i.test(detail)) return '请求被微信合法域名校验拦截，请检查开发者工具的域名配置是否已同步。';
  if (/timeout|timed out/i.test(detail)) return '连接小组服务超时，请稍后重试。';
  return error.message || '暂时无法连接小组服务，请检查网络后重试。';
}
module.exports = { read, write, requestId, errorText };
