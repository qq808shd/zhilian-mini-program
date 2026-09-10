// Isolated native UI fixture: original pages, actual V5 model, no production requests.
const fs = require('node:fs'), path = require('node:path');
const source = path.resolve(__dirname, '..'), dest = process.argv[2];
if (!dest || !path.resolve(dest).startsWith('/private/tmp/zhilian-v6-preview-')) throw new Error('Use /private/tmp/zhilian-v6-preview-*');
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(source, 'miniprogram'), path.join(dest, 'miniprogram'), { recursive: true });
const root = path.join(dest, 'miniprogram');
const config = JSON.parse(fs.readFileSync(path.join(source, 'project.config.json')));
config.projectname = '知练V6隔离视觉验收'; config.miniprogramRoot = 'miniprogram/';
fs.writeFileSync(path.join(dest, 'project.config.json'), JSON.stringify(config, null, 2));
fs.writeFileSync(path.join(dest, 'project.private.config.json'), JSON.stringify({ setting: { ignoreDevUnusedFiles: false } }, null, 2));
fs.writeFileSync(path.join(root, 'config/cloud.js'), "module.exports={enabled:false,baseUrl:'',requestTimeout:1000};\n");
// The real group state machine creates the same fixtures used in prior group QA.
const { generate } = require('./group-visual-fixtures');
fs.writeFileSync(path.join(root, 'utils/group-visual-fixtures.js'), 'module.exports=' + JSON.stringify(generate()) + ';\n');
fs.writeFileSync(path.join(root, 'utils/groupApi.js'), `const all=require('./group-visual-fixtures');module.exports={requestId:()=> 'preview',errorText:e=>e.message,async write(){throw new Error('隔离视觉预览，不写生产数据');},async read(){return all['04-some-completed'];}};`);
fs.writeFileSync(path.join(root, 'app.js'), `
const content=require('./data/content'), model=require('./utils/learningModel');
// Separate storage namespace even if the developer tool reuses the same AppID.
const get=wx.getStorageSync.bind(wx),set=wx.setStorageSync.bind(wx),remove=wx.removeStorageSync.bind(wx);
wx.getStorageSync=k=>get('v6_visual_only:'+k);wx.setStorageSync=(k,v)=>set('v6_visual_only:'+k,v);wx.removeStorageSync=k=>remove('v6_visual_only:'+k);
wx.request=()=>{throw new Error('隔离预览禁止网络请求');};
const nativePage=Page;
Page=function(def){def.__choose=function(){wx.reLaunch({url:'/pages/visual/index'});};const original=def.onShow;def.onShow=function(){if(original)original.call(this);const app=getApp();if(app.selected)app.applyView(this);};nativePage(def);};
App({globalData:{},selected:'study-new',onLaunch(){this.seed('study-new');},
  seed(name){
    this.selected=name;const now=Date.now(),ks=content.getKnowledgeByTopic('idiom'),events=[];let serial=0;
    const add=(k,kind,at,extra={})=>events.push({id:'visual:'+ ++serial,learningVersion:5,knowledgeId:k.id,topicId:k.topicId,moduleId:k.moduleId,kind,at,...extra});
    let learned=0,due=0,newDone=0,reviewDone=0,goal=10;
    if(['study-review','study-review-done','study-complete','study-new-done','me-data','practice-learned','practice-wrong','result-wrong','result-correct','history','review-card'].includes(name)){learned=135;due=6;}
    if(name==='study-many'){learned=888;due=888;}
    if(name==='study-all'){learned=888;due=0;}
    if(name==='study-review-done'||name==='study-complete')reviewDone=due;
    if(name==='study-new-done'||name==='study-complete')newDone=10;
    if(name==='study-one')goal=1;if(name==='study-200')goal=200;
    for(let i=0;i<learned;i++)add(ks[i],'assessment',i<due?now-30*model.DAY+i:now-model.DAY+i,{rating:i<due?'none':'remembered'});
    if(reviewDone){const day=model.dayKey(now)+'/review/idiom',tasks=ks.slice(0,due).map(k=>({id:'review:'+k.id,knowledgeId:k.id,phase:'review'}));events.push({id:'visual-plan',learningVersion:5,kind:'plan',at:now-2000,day,mode:'review',topicId:'idiom',tasks,settings:{id:'default',version:3,topicId:'idiom',newCount:goal}});tasks.forEach((t,i)=>add(ks[i],'assessment',now-1500+i,{rating:'remembered',day,planId:'visual-plan',taskId:t.id,phase:'review'}));}
    for(let i=0;i<newDone;i++)add(ks[learned+i],'assessment',now-1000+i,{rating:'fuzzy'});
    if(name==='me-large')content.knowledge.forEach((k,i)=>add(k,'assessment',now-model.DAY+i,{rating:'remembered'}));
    const state=model.replay(events,null,now);state.studySettings={id:'visual-settings',version:3,topicId:'idiom',batchId:'',newCount:goal};
    wx.setStorageSync('zhilian_learning_v4',{version:5,base:model.emptyState(),pending:events,state});
    wx.setStorageSync('zhilian_question_stats_v3',{});wx.setStorageSync('zhilian_pending_answer_events_v1',[]);wx.setStorageSync('zhilian_answer_operations_v4',{});
    wx.setStorageSync('zhilian_daily_draft_v5',{});wx.setStorageSync('zhilian_study_progress_v1',{});
    wx.setStorageSync('zhilian_learning_guide',{version:1,completed:name!=='guide',hints:{due:true}});
    wx.setStorageSync('zhilian_local_profile_v1',name==='me-custom'?{nickname:'认真学习的知练同学与长期伙伴',avatar:'/assets/groups/avatar-1.svg'}:{});
    if(name==='practice-wrong'||name==='me-data'||name==='history'){
      const storage=require('./utils/storage');content.questions.filter(q=>ks.slice(0,8).some(k=>k.id===q.knowledgeId)).forEach((q,i)=>storage.recordQuestionResult(q.id,q.moduleId,q.topicId,i%3===0,{answeredAt:now+i}));
    }
  },
  preview(name){this.seed(name);const route=name.startsWith('me-')?'me':name==='group'?'study-group':name==='history'?'history':name.startsWith('practice-')||name.startsWith('result-')||name.startsWith('exam-')?'exam':name==='settings'?'study-settings':name==='review-card'||name==='new-card'?'today-study':'study';
    const url='/pages/'+route+'/index'+(name==='review-card'?'?mode=review&topicId=idiom':'');
    wx.reLaunch({url});
  },
  applyView(p){const name=this.selected;
    if(p.route==='pages/study/index'){
      if(name==='study-empty'){const d=require('./utils/learningDashboard').buildDashboard(require('./utils/learningEngine').getState(),{topicId:'missing',newCount:10},{},Date.now());p.setData(d);}
      if(name==='study-long')p.setData({topic:{...p.data.topic,name:'用于检查长分类名称的资料分析与增长率公式专项'}});
    }
    if(p.route==='pages/exam/index'){
      if(name==='practice-module'||name==='practice-learned'||name==='practice-wrong'||name==='practice-empty'){p.onBackModules();return;}
      if(name==='practice-topic'){p.onModuleTap({currentTarget:{dataset:{id:'verbal'}}});return;}
      p.configureTopic(content.getTopicById('idiom'));
      if(name==='practice-assessment')p.setData({sessionMode:'assessment'});
      if(name==='practice-setup'||name==='practice-assessment')return;
      if(name.startsWith('result-')||name.startsWith('exam-')){
        const qs=content.questions.filter(q=>q.topicId==='idiom').slice(0,10);p.startWithQuestions(qs);p.pauseClock();
        if(name==='exam-answer')return;
        p.setData({answers:Object.fromEntries(qs.map((q,i)=>[q.id,name==='result-correct'||i<8?q.answer:q.options.find(o=>o.id!==q.answer).id]))});
        if(name==='exam-feedback'){p.setData({selectedAnswer:qs[0].options.find(o=>o.id!==qs[0].answer).id,answers:{[qs[0].id]:qs[0].options.find(o=>o.id!==qs[0].answer).id}});p.onConfirm();return;}
        p.elapsedMs=402000;p.submitExam();
      }
    }
  }
});
`);
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
app.pages = ['pages/visual/index', ...app.pages];
const scenarios = ['study-empty','study-new','study-one','study-200','study-review','study-many','study-new-done','study-review-done','study-complete','study-all','study-long','practice-empty','practice-wrong','practice-learned','practice-module','practice-topic','practice-setup','practice-assessment','exam-answer','exam-feedback','result-wrong','result-correct','me-empty','me-custom','me-data','me-large','group','guide','settings','new-card','review-card','history'];
const dir = path.join(root, 'pages/visual'); fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({navigationBarTitleText:'V6 隔离视觉验收'}));
fs.writeFileSync(path.join(dir,'index.js'), 'Page({data:{scenarios:'+JSON.stringify(scenarios)+'},onChoose(e){getApp().preview(e.currentTarget.dataset.name);}});');
fs.writeFileSync(path.join(dir,'index.wxml'), '<view class="page"><text>仅合成数据 · 无生产请求</text><button wx:for="{{scenarios}}" wx:key="*this" data-name="{{item}}" bindtap="onChoose">{{item}}</button></view>');
fs.writeFileSync(path.join(dir,'index.wxss'),'.page button { min-height:44px; width:100%; font-size:24rpx; margin:8rpx 0; }');
for(const name of ['study','exam','me','study-group','study-settings','today-study','history']) {
 const wxml=path.join(root,'pages',name,'index.wxml');fs.appendFileSync(wxml,'<button class="visual-switch" bindtap="__choose" aria-label="切换验收场景">场景</button>');
 const wxss=path.join(root,'pages',name,'index.wxss');fs.appendFileSync(wxss,'.visual-switch {position:fixed;z-index:300;right:0;bottom:72px;width:44px!important;height:44px;font-size:10px;opacity:.65;color:#4d785b;background:#fff;}');
}

fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify(app, null, 2));
console.log(dest);
