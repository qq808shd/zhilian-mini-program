const KEY = "zhilian_local_profile_v1";
const DEFAULT_AVATAR = "/assets/account/avatar.svg";
function getProfile() {
  const profile = wx.getStorageSync(KEY) || {};
  return { nickname: profile.nickname || "知练同学", avatar: profile.avatar || DEFAULT_AVATAR, customized: !!(profile.nickname || profile.avatar) };
}
function normalizeNickname(value) { return String(value || "").trim(); }
function ownedAvatar(file) { return !!file && file.startsWith(wx.env.USER_DATA_PATH + "/zhilian-avatar-"); }
function removeAvatar(file) {
  if (ownedAvatar(file)) { try { wx.getFileSystemManager().unlinkSync(file); } catch (_) { /* 已失效的文件无需再删除。 */ } }
}
function persistAvatar(tempPath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({ src: tempPath, success(info) {
      if (!["png", "jpeg", "jpg", "webp"].includes(String(info.type).toLowerCase())) { reject(new Error("请选择 PNG、JPG 或 WebP 图片")); return; }
      const fs = wx.getFileSystemManager();
      fs.stat({ path: tempPath, success(result) {
        if (result.stats.size > 5 * 1024 * 1024) { reject(new Error("头像请小于 5 MB")); return; }
        const extension = info.type === "jpeg" ? "jpg" : info.type;
        const destination = wx.env.USER_DATA_PATH + "/zhilian-avatar-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + extension;
        fs.copyFile({ srcPath: tempPath, destPath: destination, success() { resolve(destination); },
          fail() { reject(new Error("头像保存失败，请重试")); } });
      }, fail() { reject(new Error("无法读取头像，请重新选择")); } });
    }, fail() { reject(new Error("头像已失效，请重新选择")); } });
  });
}
async function saveProfile({ nickname, avatar }) {
  const name = normalizeNickname(nickname);
  if (Array.from(name).length > 24) throw new Error("昵称最多 24 个字");
  const old = getProfile();
  const isNewAvatar = avatar && avatar !== DEFAULT_AVATAR && avatar !== old.avatar;
  const savedAvatar = isNewAvatar ? await persistAvatar(avatar) : avatar || DEFAULT_AVATAR;
  try { wx.setStorageSync(KEY, { nickname: name, avatar: savedAvatar === DEFAULT_AVATAR ? "" : savedAvatar }); }
  catch (_) { if (isNewAvatar) removeAvatar(savedAvatar); throw new Error("资料保存失败，请检查设备空间后重试"); }
  if (old.avatar !== savedAvatar) removeAvatar(old.avatar);
  return getProfile();
}
function deleteProfile() {
  const profile = getProfile();
  wx.removeStorageSync(KEY);
  removeAvatar(profile.avatar);
}
module.exports = { getProfile, normalizeNickname, saveProfile, deleteProfile, DEFAULT_AVATAR };
