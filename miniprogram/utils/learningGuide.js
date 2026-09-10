const KEY = 'zhilian_learning_guide';
const VERSION = 1;
const steps = [
  { title: '新学', icon: 'book', body: '你决定每天学习多少新内容。按自己的计划，逐步积累。' },
  { title: '复习', icon: 'calendar', body: '根据过去的学习情况，安排已经学过的内容回来回忆。每天的复习数量可能不同。' },
  { title: '练习', icon: 'pencil', body: '用实际作答检验学习效果。对于已学知识，作答也会帮助调整后续复习安排。' }
];
function read() { const value = wx.getStorageSync(KEY); return value && value.version === VERSION ? value : { version: VERSION, completed: false, hints: {} }; }
function finish() { wx.setStorageSync(KEY, { ...read(), completed: true }); }
function takeHint(name) { const value = read(); if (value.hints[name]) return false; wx.setStorageSync(KEY, { ...value, hints: { ...value.hints, [name]: true } }); return true; }
module.exports = { VERSION, steps, read, finish, takeHint };
