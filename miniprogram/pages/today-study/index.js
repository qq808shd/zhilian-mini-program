const engine = require('../../utils/learningEngine');
const guide = require('../../utils/learningGuide');
const { getKnowledgeById } = require('../../data/content');
Page({
  data: { daily: {}, cards: [], currentIndex: 0, positionProgress: 0, task: null, mode: 'new', topicId: '', revealed: false, saving: false, confirming: false, current: {} },
  onLoad(options = {}) {
    this.reveals = {};
    this.setData({ mode: options.mode === 'review' ? 'review' : 'new', topicId: options.topicId || engine.getStudySettings().topicId });
    engine.repairDailyAnswers();
  },
  onShow() { this.refresh(); },
  onHide() { if (this.advanceTimer) { clearTimeout(this.advanceTimer); this.advanceTimer = null; this.setData({ saving: false }); } },
  onUnload() { if (this.advanceTimer) clearTimeout(this.advanceTimer); },
  refresh(focusId) {
    const now = Date.now(), daily = engine.dailyView(now, this.data.mode, this.data.topicId);
    const plan = engine.ensurePlan(now, this.data.mode, this.data.topicId);
    const reset = (engine.getState(now).learningResets || {})[this.data.topicId];
    const session = daily.sessionKey + ':' + (reset ? reset.id : '');
    if (this.revealSession !== session) { this.reveals = {}; this.revealSession = session; }
    const cards = plan.tasks.map(t => {
      const task = { ...t, sessionKey: daily.sessionKey, knowledge: getKnowledgeById(t.knowledgeId) };
      return { ...task, current: engine.getKnowledgeView(t.knowledgeId, now), revealed: !!(this.reveals[t.id] || engine.getDraft(task).revealed) };
    });
    const target = focusId || (daily.next && daily.next.id);
    const index = target ? cards.findIndex(t => t.id === target) : -1;
    const task = index >= 0 ? cards[index] : null;
    this.setData({ daily, cards, task, currentIndex: Math.max(0, index), positionProgress: task ? Math.round((index + 1) / cards.length * 100) : 100,
      current: task ? task.current : {}, revealed: !!(task && task.revealed), saving: false });
    if (!task && this.data.mode === 'new' && daily.summary.newCount > 0 && guide.takeHint('new-complete')) this.setData({ firstCompletion: true });
    if (task) engine.beginTask(now, this.data.mode, this.data.topicId);
    wx.setNavigationBarTitle({ title: daily.subject });
  },
  onSwiperChange(event) {
    if (event.detail.source && event.detail.source !== 'touch') return;
    const index = Number(event.detail.current), card = this.data.cards[index];
    if (!card || this.data.saving || this.data.confirming || index === this.data.currentIndex) return;
    this.refresh(card.id);
  },
  onReveal(event) {
    const id = event && event.currentTarget && event.currentTarget.dataset.taskId;
    if (!this.data.task || (id && id !== this.data.task.id) || this.data.saving) return;
    this.reveals[this.data.task.id] = true;
    engine.saveDraft(this.data.task, { revealed: true });
    this.refresh(this.data.task.id);
  },
  advance() {
    const next = this.data.cards[this.data.currentIndex + 1];
    this.setData({ saving: true });
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      const daily = engine.dailyView(Date.now(), this.data.mode, this.data.topicId);
      this.refresh(daily.remaining && next ? next.id : undefined);
    }, 220);
  },
  onRate(event) {
    if (!this.data.task || this.data.saving || this.data.confirming || this.data.current.excluded) return;
    const { taskId, value: rating } = event.currentTarget.dataset;
    if ((taskId && taskId !== this.data.task.id) || !['none', 'fuzzy', 'remembered'].includes(rating)) return;
    const task = this.data.task;
    // A swipe can focus any pending card; revisiting a completed card changes
    // its degree without creating a second completion or learned count.
    if (!engine.completeTask(task.id, { rating }, Date.now(), this.data.mode, this.data.topicId)) {
      if (!engine.getKnowledgeView(task.knowledgeId).learned) { this.refresh(); return; }
      engine.learn(task.knowledgeId, rating);
    }
    this.setData({ current: engine.getKnowledgeView(task.knowledgeId) });
    this.advance();
  },
  onFamiliar(event) {
    if (!this.data.task || this.data.saving || this.data.confirming) return;
    const tappedId = event && event.currentTarget && event.currentTarget.dataset.taskId;
    if (tappedId && tappedId !== this.data.task.id) return;
    const task = this.data.task, excluded = this.data.current.excluded;
    this.setData({ confirming: true });
    wx.showModal({ title: excluded ? '取消熟知？' : '标记为熟知？',
      content: excluded ? '取消后，这条知识将根据记忆情况重新安排复习。' : '标记后，这条知识将不再出现在自动复习中。以后可点击星标取消熟知。',
      confirmText: '确定', cancelText: '取消', confirmColor: '#4D785B',
      success: response => {
        this.setData({ confirming: false });
        if (!response.confirm || !this.data.task || this.data.task.id !== task.id) return;
        if (excluded) {
          engine.setFamiliar(task.knowledgeId, false); this.refresh(task.id); return;
        }
        if (!engine.completeTask(task.id, { excluded: true }, Date.now(), this.data.mode, this.data.topicId)) engine.setFamiliar(task.knowledgeId, true);
        this.advance();
      },
      complete: () => this.setData({ confirming: false })
    });
  },
  onHome() { wx.switchTab({ url: '/pages/study/index' }); }
});
