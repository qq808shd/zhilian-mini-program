const { modules } = require("../../data/content");
const { getQuestionStats, clearQuestionStats } = require("../../utils/storage");
Page({
  data:{summary:{attempts:0,accuracy:0,activeWrongCount:0},moduleStats:[]},
  onShow(){this.refreshStats();},
  refreshStats(){ const records=Object.values(getQuestionStats()); const attempts=records.reduce((s,i)=>s+i.attempts,0); const correct=records.reduce((s,i)=>s+i.correct,0); this.setData({ summary:{attempts,accuracy:attempts?Math.round(correct/attempts*100):0,activeWrongCount:records.filter((i)=>i.activeWrong).length}, moduleStats:modules.map((module)=>{const items=records.filter((i)=>i.moduleId===module.id);const itemAttempts=items.reduce((s,i)=>s+i.attempts,0);return {...module,attempts:itemAttempts,wrong:items.reduce((s,i)=>s+i.wrong,0),activeWrongCount:items.filter((i)=>i.activeWrong).length,accuracy:itemAttempts?Math.round(items.reduce((s,i)=>s+i.correct,0)/itemAttempts*100):0};}) }); },
  onOpenModule(e){ wx.navigateTo({url:`/pages/review-topic/index?moduleId=${e.currentTarget.dataset.id}`}); },
  onClearStats(){ if(!this.data.summary.attempts){wx.showToast({title:"目前没有答题记录",icon:"none"});return;} wx.showModal({title:"清空答题记录",content:"所有正确率和错题记录都会被清除，且无法恢复。",confirmText:"确认清空",confirmColor:"#C53F3F",success:(result)=>{if(result.confirm){clearQuestionStats();this.refreshStats();wx.showToast({title:"记录已清空",icon:"success"});}}}); }
});
