const { modules, questions, getTopicsByModule, getModuleById, getTopicById, getModuleName, getTopicName } = require("../../data/content");
const { recordQuestionResult, getActiveWrongQuestionIds, consumeExamRequest } = require("../../utils/storage");

function shuffle(items) { const copied = items.slice(); for (let i = copied.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copied[i], copied[j]] = [copied[j], copied[i]]; } return copied; }

Page({
  data: { state: "module", modules, topics: [], selectedModule: null, selectedTopic: null, questionCountOptions: [{value:10,label:"10 题"},{value:20,label:"20 题"},{value:0,label:"全部"}], questionCount: 10, availableCount: 0, examQuestions: [], currentIndex: 0, currentQuestion: null, answers: {}, selectedAnswer: "", resultSummary: null, resultItems: [] },
  onShow() {
    const request = consumeExamRequest();
    if (!request) return;
    if (request.mode === "wrong") this.startWrongExam(request.topicId);
    if (request.mode === "questionIds") this.startWithQuestions(request.questionIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean));
  },
  onModuleTap(event) { const selectedModule = getModuleById(event.currentTarget.dataset.id); this.setData({ state:"topic", selectedModule, topics:getTopicsByModule(selectedModule.id) }); },
  onTopicTap(event) { const selectedTopic = getTopicById(event.currentTarget.dataset.id); this.setData({ state:"setup", selectedTopic, availableCount:questions.filter((q) => q.topicId === selectedTopic.id).length }); },
  onBackModules() { this.setData({ state:"module", topics:[], selectedModule:null, selectedTopic:null }); },
  onBackTopics() { this.setData({ state:"topic", selectedTopic:null }); },
  onCountTap(event) { this.setData({ questionCount:Number(event.currentTarget.dataset.value) }); },
  onStartExam() { const eligible = questions.filter((q) => q.topicId === this.data.selectedTopic.id); const number = this.data.questionCount || eligible.length; this.startWithQuestions(shuffle(eligible).slice(0, Math.min(number, eligible.length))); },
  startWithQuestions(selectedQuestions) {
    const examQuestions = selectedQuestions.map((question) => ({ ...question, moduleName:getModuleName(question.moduleId), topicName:getTopicName(question.topicId) }));
    if (!examQuestions.length) { wx.showToast({title:"当前没有可用题目",icon:"none"}); return; }
    this.setData({ state:"exam", examQuestions, currentIndex:0, currentQuestion:examQuestions[0], answers:{}, selectedAnswer:"", resultSummary:null, resultItems:[] });
  },
  startWrongExam(topicId) {
    const ids = getActiveWrongQuestionIds(topicId ? {topicId} : {});
    const source = ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    if (!source.length) { wx.showToast({title:"目前没有待复习错题",icon:"none"}); this.setData({state:"module"}); return; }
    const selectedTopic = topicId ? getTopicById(topicId) : null;
    this.setData({ selectedTopic, selectedModule:selectedTopic ? getModuleById(selectedTopic.moduleId) : null });
    this.startWithQuestions(shuffle(source));
  },
  onChooseOption(event) { const optionId=event.currentTarget.dataset.id; this.setData({answers:{...this.data.answers,[this.data.currentQuestion.id]:optionId},selectedAnswer:optionId}); },
  goToQuestion(index) { const currentQuestion=this.data.examQuestions[index]; this.setData({currentIndex:index,currentQuestion,selectedAnswer:this.data.answers[currentQuestion.id] || ""}); },
  onPrevious() { if(this.data.currentIndex>0) this.goToQuestion(this.data.currentIndex-1); },
  onNext() { if(!this.data.selectedAnswer) { wx.showToast({title:"请先选择一个答案",icon:"none"}); return; } if(this.data.currentIndex < this.data.examQuestions.length-1) this.goToQuestion(this.data.currentIndex+1); else this.submitExam(); },
  submitExam() {
    const resultItems=this.data.examQuestions.map((question)=>{ const selectedAnswer=this.data.answers[question.id]||""; const isCorrect=selectedAnswer===question.answer; recordQuestionResult(question.id,question.moduleId,question.topicId,isCorrect); const selectedOption=question.options.find((option)=>option.id===selectedAnswer); const correctOption=question.options.find((option)=>option.id===question.answer); return {...question,selectedAnswer,selectedText:selectedOption?selectedOption.text:"未作答",correctText:correctOption?correctOption.text:"",isCorrect}; });
    const correctCount=resultItems.filter((item)=>item.isCorrect).length; const totalCount=resultItems.length; this.setData({state:"result",resultItems,resultSummary:{correctCount,wrongCount:totalCount-correctCount,totalCount,accuracy:Math.round(correctCount/totalCount*100)}});
  },
  onRetryWrong() { this.startWithQuestions(this.data.resultItems.filter((item)=>!item.isCorrect)); },
  onBackToSetup() { this.setData({ state:this.data.selectedModule ? "setup" : "module", examQuestions:[],currentQuestion:null,answers:{},selectedAnswer:"",resultSummary:null,resultItems:[] }); },
  onOpenKnowledge(event) { wx.navigateTo({url:`/pages/detail/index?id=${event.currentTarget.dataset.id}`}); }
});
