const engine = require('../../utils/learningEngine');
const phaseLabels = { review: '到期复习', new: '今日新学', practice: '巩固练习', retry: '本轮错题再练' };
Page({
  data: { daily: {}, task: null, phaseLabel: '', revealed: false, rating: '', selected: '', feedback: null, checkpoint: false },
  onLoad() { engine.repairDailyAnswers(); },
  onShow() { this.refresh(); },
  refresh() {
    const daily = engine.dailyView(), task = daily.next;
    const draft = task ? engine.getDraft(task) : {};
    const checkpoint = !!(task && task.phase === 'practice' && !task.started && daily.summary.exerciseCount === 0 && daily.summary.newCount > 0);
    this.setData({ daily, task, phaseLabel: task ? phaseLabels[task.phase] : '', revealed: !!draft.revealed, rating: draft.rating || '', selected: draft.selected || '', feedback: null, checkpoint });
    if (task && !checkpoint) engine.beginTask();
    wx.setNavigationBarTitle({ title: task ? '今日学习' : '今日总结' });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  persist() { if (this.data.task) engine.saveDraft(this.data.task, { revealed: this.data.revealed, rating: this.data.rating, selected: this.data.selected }); },
  onBeginPractice() { engine.beginTask(); this.refresh(); },
  onReveal() { this.setData({ revealed: true }); this.persist(); },
  onRate(e) { if (!this.data.revealed || this.data.feedback) return; this.setData({ rating: e.currentTarget.dataset.value }); this.persist(); },
  onSelect(e) { if (this.data.feedback) return; this.setData({ selected: e.currentTarget.dataset.id }); this.persist(); },
  onContinue() {
    if (this.data.feedback) { this.refresh(); return; }
    const { task, selected, revealed, rating } = this.data;
    if (!task) return;
    if (task.question) {
      if (!selected) return;
      const correct = selected === task.question.answer;
      if (!engine.completeTask(task.id, { selected })) { this.refresh(); return; }
      const answer = task.question.options.find((o) => o.id === task.question.answer);
      this.setData({ feedback: { correct, answer: answer ? answer.text : '', explanation: task.question.explanation || task.question.analysis || task.knowledge.detail || task.knowledge.summary }, revealed: true });
    } else {
      if (!revealed) { this.onReveal(); return; }
      if (task.phase !== 'new' && !rating) { wx.showToast({ title: '请选择回忆结果', icon: 'none' }); return; }
      engine.completeTask(task.id, { rating }); this.refresh();
    }
  },
  onHome() { wx.switchTab({ url: '/pages/study/index' }); },
  onFreeStudy() { wx.navigateTo({ url: '/pages/free-study/index' }); }
});
