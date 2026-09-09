// Isolated native WeChat visual harness, never part of miniprogram runtime or upload.
const fs=require('node:fs'),path=require('node:path');
const {generate}=require('./group-visual-fixtures');
const source=path.resolve(__dirname,'..'),dest=process.argv[2];
if(!dest || !path.resolve(dest).startsWith('/private/tmp/zhilian-group-preview-'))throw new Error('Use an isolated /private/tmp/zhilian-group-preview-* directory');
fs.mkdirSync(dest,{recursive:true});fs.cpSync(path.join(source,'miniprogram'),path.join(dest,'miniprogram'),{recursive:true});
const config=JSON.parse(fs.readFileSync(path.join(source,'project.config.json'),'utf8'));config.projectname='知练小组视觉测试';
config.miniprogramRoot='miniprogram/';
fs.writeFileSync(path.join(dest,'project.config.json'),JSON.stringify(config,null,2));
const root=path.join(dest,'miniprogram');
fs.writeFileSync(path.join(root,'app.js'),"App({globalData:{groupFixture:'04-some-completed'}});\n");
const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));app.pages=['pages/study-group/index',...app.pages.filter(p=>p!=='pages/study-group/index')];fs.writeFileSync(path.join(root,'app.json'),JSON.stringify(app,null,2));
fs.writeFileSync(path.join(root,'utils/group-visual-fixtures.js'),'module.exports='+JSON.stringify(generate())+';\n');
fs.writeFileSync(path.join(root,'utils/groupApi.js'),`// Visual test adapter. Mutations are deliberately disabled; no production login or HTTP.\nconst all=require('./group-visual-fixtures');\nmodule.exports={requestId:()=> 'visual-test',errorText:e=>e.message,async write(){throw new Error('视觉预览不写入数据');},async read(path=''){const d=all[getApp().globalData.groupFixture];if(path.startsWith('/month'))return d.monthDetail;if(path.startsWith('/members/'))return d.memberDetail;if(path==='/history')return d.history||{items:[],nextCursor:''};if(path.startsWith('/preview')){if(path.includes('ZZZZZZ')){const e=new Error('邀请码无效，请核对后再试');e.code='INVITE_INVALID';throw e;}return d.preview;}return d;}};\n`);
console.log(dest);
