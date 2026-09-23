const api = require('./cloudSync');
const local = require('./profile');
const account = require('./account');
const PENDING = 'zhilian_profile_pending_v1';
let queue = Promise.resolve();
async function request(method='GET', data) { try { return await api.requestAuthenticated({path:'/v1/profile',method,data}); } catch(e) { if(e.statusCode===404)e.message='个人资料同步服务尚未更新，请稍后再试'; throw e; } }
function serialized(work) { const result=queue.catch(()=>{}).then(work);queue=result;return result; }
async function publish(base) {
  if(!account.isSyncAuthorized())throw new Error('请先同意当前协议');
  const current=await request();
  if(current.userId!==base.userId)throw new Error('账户已变化，请重新打开个人资料');
  const profile=local.getProfile();
  const image=profile.avatar.startsWith('data:image/')?profile.avatar:await require('./groupAvatar').prepareAvatar(profile.avatar);
  const payload={nickname:profile.nickname,image,revision:base.revision};
  wx.setStorageSync(PENDING,{userId:base.userId,payload});
  const remote=await request('PUT',payload);
  wx.removeStorageSync(PENDING);
  return remote;
}
function save(base) { return serialized(async()=>publish(base||await request())); }
function restore() { return serialized(async()=>{
  if(!account.isSyncAuthorized())return null;
  let remote;
  try {remote=await request();}catch(e){if(e.statusCode===404)return null;throw e;}
  const pending=wx.getStorageSync(PENDING);
  if(pending&&pending.userId===remote.userId){remote=await request('PUT',pending.payload);wx.removeStorageSync(PENDING);}
  if(remote.revision) local.restoreProfile(remote);
  else if(local.getProfile().userId && local.getProfile().userId!==remote.userId) local.deleteProfile();
  return remote;
}); }
module.exports={restore,save};
