const { modules, questions, getTopicsByModule, getModuleById, getTopicById, getModuleName, getTopicName, getKnowledgeById } = require("../../data/content");
const { recordQuestionResult, getActiveWrongQuestionIds, consumeExamRequest } = require("../../utils/storage");
const { getQuestionCountOptions, selectQuestions, formatDuration } = require("../../utils/examSession");

Page({
  data: {
    state: "module", modules, topics: [], selectedModule: null, selectedTopic: null,
    sessionMode: "practice", sessionTitle: "", sourceKind: "topic", questionCountOptions: [], questionCount: 0,
    availableCount: 0, examQuestions: [], currentIndex: 0, currentQuestion: null,
    answers: {}, confirmed: {}, selectedAnswer: "", currentFeedback: null, answeredCount: 0,
    elapsed: "00:00", sheetOpen: false, answerSheet: [], marks: {}, resultSummary: null,
    resultItems: [], resultTopics: [], resultFilter: "all", filteredResults: [], resultIndex: 0, resultItem: null, recommendation: null
  },
  onShow() {
    const request = consumeExamRequest();
    if (request) {
      if (this.data.state === "exam") {
        wx.showModal({ title: "开始新的练习？", content: "当前练习将结束。已经确认的作答会保留，尚未提交的答案不会计入记录。", confirmText: "开始新的", success: (res) => { if (res.confirm) this.applyRequest(request); } });
      } else this.applyRequest(request);
    }
    if (this.data.state === "exam") this.resumeClock();
  },
  onHide() { this.pauseClock(); },
  onUnload() { this.pauseClock(); },
  resumeClock() {
    if (this.clock) return;
    this.clockStart = Date.now();
    this.clock = setInterval(() => this.setData({ elapsed: formatDuration(Math.floor(((this.elapsedMs || 0) + Date.now() - this.clockStart) / 1000)) }), 1000);
  },
  pauseClock() {
    if (!this.clock) return;
    this.elapsedMs = (this.elapsedMs || 0) + Date.now() - this.clockStart;
    clearInterval(this.clock);
    this.clock = null;
  },
  applyRequest(request) {
    if (request.mode === "topic") { this.configureTopic(getTopicById(request.topicId)); return; }
    const ids = request.mode === "wrong" ? getActiveWrongQuestionIds(request.topicId ? { topicId: request.topicId } : {}) : request.questionIds || [];
    const idSet = new Set(ids);
    const source = questions.filter((question) => idSet.has(question.id));
    if (!source.length) { wx.showToast({ title: "目前没有可练习的题目", icon: "none" }); return; }
    this.customSource = source;
    this.configureSetup(source, { sourceKind: request.mode, sessionMode: "practice", sessionTitle: request.title || (request.mode === "wrong" ? "错题巩固" : "关联知识练习"), selectedTopic: getTopicById(source[0].topicId), selectedModule: getModuleById(source[0].moduleId) });
  },
  onModuleTap(event) {
    const selectedModule = getModuleById(event.currentTarget.dataset.id);
    if (!selectedModule) return;
    this.customSource = null;
    this.setData({ state: "topic", selectedModule, topics: getTopicsByModule(selectedModule.id) });
  },
  onTopicTap(event) { this.configureTopic(getTopicById(event.currentTarget.dataset.id)); },
  configureTopic(topic) {
    if (!topic) return;
    this.customSource = null;
    this.configureSetup(questions.filter((q) => q.topicId === topic.id), { selectedTopic: topic, selectedModule: getModuleById(topic.moduleId), sourceKind: "topic", sessionTitle: topic.name, sessionMode: "practice" });
  },
  configureSetup(source, values) {
    this.pauseClock();
    const options = getQuestionCountOptions(source.length);
    this.setData({ ...values, state: "setup", sheetOpen: false, availableCount: source.length, questionCountOptions: options, questionCount: options.length ? options[0].value : 0 });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onBackModules() { this.customSource = null; this.setData({ state: "module", selectedModule: null, selectedTopic: null }); },
  onBackTopics() {
    const module = this.data.selectedModule;
    if (!module) { this.onBackModules(); return; }
    this.customSource = null;
    this.setData({ state: "topic", topics: getTopicsByModule(module.id), selectedTopic: null });
  },
  onCountTap(event) { this.setData({ questionCount: Number(event.currentTarget.dataset.value) }); },
  onModeTap(event) { this.setData({ sessionMode: event.currentTarget.dataset.mode }); },
  onStartExam() {
    const source = this.customSource || questions.filter((q) => q.topicId === this.data.selectedTopic.id);
    this.startWithQuestions(selectQuestions(source, this.data.questionCount));
  },
  startWithQuestions(source) {
    const examQuestions = source.slice(0, 20).map((question) => ({ ...question, moduleName: getModuleName(question.moduleId), topicName: getTopicName(question.topicId) }));
    if (!examQuestions.length) { wx.showToast({ title: "当前没有可用题目", icon: "none" }); return; }
    this.pauseClock(); this.elapsedMs = 0; this.recordedIds = new Set();
    this.setData({ state: "exam", examQuestions, currentIndex: 0, currentQuestion: examQuestions[0], answers: {}, confirmed: {}, marks: {}, selectedAnswer: "", currentFeedback: null, answeredCount: 0, elapsed: "00:00", sheetOpen: false, resultSummary: null, resultItems: [] });
    this.refreshSheet(); this.resumeClock();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  refreshSheet() {
    const { examQuestions, answers, confirmed, marks, sessionMode } = this.data;
    this.setData({ answeredCount: Object.keys(answers).length,
      answerSheet: examQuestions.map((question, index) => ({ id: question.id, index, answered: !!answers[question.id], marked: !!marks[question.id], label: sessionMode === "practice" && confirmed[question.id] ? "已确认" : answers[question.id] ? "已答" : "未答" })) });
  },
  onChooseOption(event) {
    if (this.data.confirmed[this.data.currentQuestion.id]) return;
    const optionId = event.currentTarget.dataset.id;
    this.setData({ answers: { ...this.data.answers, [this.data.currentQuestion.id]: optionId }, selectedAnswer: optionId });
    this.refreshSheet();
  },
  makeResult(question, index) {
    const selectedAnswer = this.data.answers[question.id] || "";
    const selected = question.options.find((option) => option.id === selectedAnswer);
    const correct = question.options.find((option) => option.id === question.answer);
    const knowledge = getKnowledgeById(question.knowledgeId);
    return { ...question, number: index + 1, selectedAnswer, selectedText: selected ? selected.text : "未作答", correctText: correct ? correct.text : "", isCorrect: selectedAnswer === question.answer,
      knowledgeTitle: knowledge ? knowledge.title : "", memory: knowledge ? knowledge.memory : "" };
  },
  recordOnce(result) {
    if (this.recordedIds.has(result.id)) return;
    recordQuestionResult(result.id, result.moduleId, result.topicId, result.isCorrect);
    this.recordedIds.add(result.id);
  },
  onConfirm() {
    const { currentQuestion, currentIndex, selectedAnswer, confirmed } = this.data;
    if (!selectedAnswer || confirmed[currentQuestion.id]) return;
    const result = this.makeResult(currentQuestion, currentIndex);
    this.recordOnce(result);
    this.setData({ confirmed: { ...confirmed, [currentQuestion.id]: true }, currentFeedback: result });
    this.refreshSheet();
  },
  goToQuestion(index) {
    const currentQuestion = this.data.examQuestions[index];
    if (!currentQuestion) return;
    this.setData({ currentIndex: index, currentQuestion, selectedAnswer: this.data.answers[currentQuestion.id] || "", currentFeedback: this.data.confirmed[currentQuestion.id] ? this.makeResult(currentQuestion, index) : null, sheetOpen: false });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onPrevious() { this.goToQuestion(this.data.currentIndex - 1); },
  onNext() {
    if (this.data.sessionMode === "practice" && !this.data.currentFeedback) { this.onConfirm(); return; }
    if (this.data.currentIndex < this.data.examQuestions.length - 1) this.goToQuestion(this.data.currentIndex + 1);
    else this.onSubmit();
  },
  onToggleSheet() { this.setData({ sheetOpen: !this.data.sheetOpen }); },
  onSheetQuestion(event) { this.goToQuestion(Number(event.currentTarget.dataset.index)); },
  onToggleMark() { const id = this.data.currentQuestion.id; this.setData({ marks: { ...this.data.marks, [id]: !this.data.marks[id] } }); this.refreshSheet(); },
  onSubmit() {
    if (this.data.state !== "exam") return;
    const remaining = this.data.sessionMode === "practice" ? this.data.examQuestions.length - Object.keys(this.data.confirmed).length : this.data.examQuestions.length - this.data.answeredCount;
    wx.showModal({ title: this.data.sessionMode === "practice" ? "结束本次练习？" : "确认交卷？", content: remaining ? `还有 ${remaining} 题${this.data.sessionMode === "practice" ? "未确认" : "未作答"}。未作答将计为错误，提交后查看学习反馈。` : "本次作答将计入统计，错题会自动进入复习。", confirmText: "确认提交", success: (res) => { if (res.confirm) this.submitExam(); } });
  },
  submitExam() {
    if (this.data.state !== "exam") return;
    this.pauseClock();
    const resultItems = this.data.examQuestions.map((question, index) => this.makeResult(question, index));
    resultItems.forEach((result) => this.recordOnce(result));
    const correctCount = resultItems.filter((item) => item.isCorrect).length;
    const groups = {};
    resultItems.forEach((item) => { if (!groups[item.topicId]) groups[item.topicId] = { id: item.topicId, name: item.topicName, total: 0, correct: 0 }; groups[item.topicId].total += 1; groups[item.topicId].correct += item.isCorrect ? 1 : 0; });
    const resultTopics = Object.values(groups).map((topic) => ({ ...topic, accuracy: Math.round(topic.correct / topic.total * 100) })).sort((a, b) => a.accuracy - b.accuracy);
    const weak = resultTopics.find((topic) => topic.correct < topic.total);
    this.setData({ state: "result", sheetOpen: false, resultItems, resultTopics, resultFilter: "all", filteredResults: resultItems, resultIndex: 0, resultItem: resultItems[0],
      elapsed: formatDuration(Math.floor(this.elapsedMs / 1000)),
      resultSummary: { correctCount, wrongCount: resultItems.length - correctCount, totalCount: resultItems.length, accuracy: Math.round(correctCount / resultItems.length * 100) },
      recommendation: weak ? { topicId: weak.id, title: `下一步，巩固${weak.name}`, description: `本次答对 ${weak.correct} / ${weak.total} 题。先理解错因，再练一次。` } : { topicId: resultTopics[0].id, title: "这一轮表现不错", description: "本次全部答对。可以继续学习这个专项，扩大积累。" } });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onResultFilter(event) {
    const resultFilter = event.currentTarget.dataset.filter;
    const filteredResults = this.data.resultItems.filter((item) => resultFilter === "all" || !item.isCorrect);
    this.setData({ resultFilter, filteredResults, resultIndex: 0, resultItem: filteredResults[0] || null });
  },
  onResultMove(event) {
    const resultIndex = this.data.resultIndex + Number(event.currentTarget.dataset.step);
    const resultItem = this.data.filteredResults[resultIndex];
    if (resultItem) this.setData({ resultIndex, resultItem });
  },
  onRetryWrong() {
    this.customSource = this.data.resultItems.filter((item) => !item.isCorrect);
    this.configureSetup(this.customSource, { sourceKind: "wrong", sessionMode: "practice", sessionTitle: "本次错题再练" });
  },
  onBackToSetup() { this.configureTopic(this.data.selectedTopic); },
  onStudyTopic() { wx.navigateTo({ url: `/pages/group/index?topicId=${this.data.recommendation.topicId}` }); },
  onReviewTopic() { wx.navigateTo({ url: `/pages/review-detail/index?topicId=${this.data.recommendation.topicId}` }); },
  onOpenKnowledge(event) { wx.navigateTo({ url: `/pages/detail/index?id=${event.currentTarget.dataset.id}` }); }
});
