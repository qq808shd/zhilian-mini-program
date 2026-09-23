const { validateAvatar } = require('./groups/avatar');
function createProfiles(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS user_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,nickname TEXT NOT NULL,image TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL)`);
  function get(userId) { const p=db.prepare('SELECT nickname,image,revision FROM user_profiles WHERE user_id=?').get(userId);return {userId,profileVersion:1,...(p||{nickname:'',image:'',revision:0})}; }
  function put(userId,data) {
    const fail=(code,message,statusCode=400)=>{const e=new Error(message);Object.assign(e,{code,statusCode});throw e;};
    if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.nickname!=='string')fail('INVALID_PROFILE','请填写头像和昵称');
    const nickname=data.nickname.trim();
    if(!nickname||Array.from(nickname).length>24||/[\u0000-\u001f\u007f]/.test(nickname))fail('INVALID_PROFILE','昵称须为 1～24 个字');
    const image=validateAvatar(data.image);
    db.exec('BEGIN IMMEDIATE');
    try {
      const old=get(userId);
      // An uncertain retry of the same content is safe even after its revision was committed.
      if(old.nickname===nickname&&old.image===image){db.exec('COMMIT');return old;}
      if(!Number.isSafeInteger(data.revision)||data.revision!==old.revision)fail('PROFILE_CONFLICT','资料已在其他设备更新，请重新打开资料页后修改',409);
      db.prepare('INSERT INTO user_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,image=excluded.image,revision=excluded.revision,updated_at=excluded.updated_at').run(userId,nickname,image,old.revision+1,Date.now());
      db.exec('COMMIT');return get(userId);
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {get,put};
}
module.exports={createProfiles};
