async function groupRoute({ request, url, user, groups, readJson }) {
  const path = url.pathname.slice('/v1/groups'.length), method = request.method;
  if (method === 'GET') {
    if (path === '' || path === '/current') return groups.dashboard(user.id);
    if (path === '/preview') return groups.preview(user.id, url.searchParams.get('code'));
    if (path === '/rules') return groups.rules();
    if (path === '/history') return groups.history(user.id, url.searchParams.get('before') || '');
    if (path === '/month') return groups.monthDetail(user.id, url.searchParams.get('month'));
    const match = /^\/members\/([a-zA-Z0-9-]+)$/.exec(path);
    if (match) return groups.memberDetail(user.id, match[1]);
  }
  if (method === 'POST' || method === 'PATCH') {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) { const e = new Error('请求内容无效'); e.statusCode = 400; throw e; }
    if (method === 'POST') {
      if (path === '') return groups.create(user.id, body);
      if (path === '/join') return groups.join(user.id, body);
      if (path === '/exit') return groups.exit(user.id, body);
      if (path === '/today') return groups.writeToday(user.id, body, 'add');
      if (path === '/day-off') return groups.writeToday(user.id, body, 'day-off');
    }
    if (method === 'PATCH' && path === '/today') return groups.writeToday(user.id, body, 'set');
  }
  const error = new Error('接口不存在'); error.statusCode = 404; error.code = 'NOT_FOUND'; throw error;
}
module.exports = { groupRoute };
