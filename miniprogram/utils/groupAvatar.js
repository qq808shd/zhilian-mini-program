const { getProfile, DEFAULT_AVATAR } = require('./profile');
function localAvatar() { const avatar = getProfile().avatar; return avatar === DEFAULT_AVATAR ? '' : avatar; }
function compress(src) { return new Promise((resolve, reject) => wx.compressImage({ src, quality: 70, compressedWidth: 160, compressedHeight: 160, success: r => resolve(r.tempFilePath), fail: () => reject(new Error('头像处理失败，请在个人资料中重新选择头像')) })); }
async function prepareAvatar(src) {
  const path = await compress(src);
  try {
    const info = await new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: () => reject(new Error('无法读取头像格式')) }));
    const type = info.type === 'jpg' ? 'jpeg' : info.type;
    if (!['png', 'jpeg', 'webp'].includes(type)) throw new Error('请选择 PNG、JPG 或 WebP 头像');
    const data = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({ filePath: path, encoding: 'base64', success: r => resolve(r.data), fail: () => reject(new Error('头像已失效，请在个人资料中重新选择')) }));
    if (data.length > Math.ceil(128 * 1024 / 3) * 4) throw new Error('头像处理后仍然过大，请选择较小的头像');
    return 'data:image/' + type + ';base64,' + data;
  } finally {
    // Only remove the temporary compressed copy, never the saved profile image.
    if (path !== src) wx.getFileSystemManager().unlink({ filePath: path, fail() {} });
  }
}
let prepared = null;
let queue = Promise.resolve();
// Serialize profile saves and group refreshes so an older image cannot overwrite a newer one.
function syncAvatar(dashboard) {
  const run = queue.catch(() => {}).then(async () => {
    const account = require('./account');
    const api = require('./groupApi');
    const unified = await require('./profileSync').restore();
    if (unified && unified.revision) return await api.read();
    const src = localAvatar();
    if (!account.isSyncAuthorized() || !src) return dashboard;
    const data = dashboard || await api.read();
    if (!data.avatarEnabled || !data.me || !data.group) return data;
    if (!prepared || prepared.src !== src) prepared = { src, image: await prepareAvatar(src) };
    if (!account.isSyncAuthorized() || localAvatar() !== src) return data;
    if (data.me.avatarImage === prepared.image) return data;
    await api.write('/avatar', { membershipId: data.me.id, image: prepared.image, requestId: api.requestId() });
    return { ...data, me: { ...data.me, avatarImage: prepared.image },
      members: data.members.map(m => m.id === data.me.id ? { ...m, avatarImage: prepared.image } : m) };
  });
  queue = run;
  return run;
}
module.exports = { localAvatar, prepareAvatar, syncAvatar };
