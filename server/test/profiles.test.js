const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDatabase}=require('../src/database');
test('unified profile additive storage survives restart without changing learning data',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zhilian-profile-test-'));let db;
 try{const file=path.join(dir,'test.sqlite');db=createDatabase(file);const id=db.getOrCreateUser('fixture-only','').id;const before=db.getSnapshot(id);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6uAAAAAASUVORK5CYII=';
 db.profiles.put(id,{nickname:'持久资料🌈',image,revision:0});db.close();db=createDatabase(file);assert.equal(db.profiles.get(id).nickname,'持久资料🌈');assert.equal(db.profiles.get(id).image,image);assert.deepEqual(db.getSnapshot(id),before);
 }finally{if(db)db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
