const MAX_QUESTIONS = 20;
function shuffle(items) {
  const copied = items.slice();
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}
function getQuestionCountOptions(count) {
  if (!count) return [];
  if (count <= 10) return [{ value: count, label: `${count} 题` }];
  return [{ value: 10, label: "10 题" }, { value: Math.min(count, MAX_QUESTIONS), label: `${Math.min(count, MAX_QUESTIONS)} 题` }];
}
function selectQuestions(items, count) {
  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values());
  return shuffle(unique).slice(0, Math.min(Math.max(count || MAX_QUESTIONS, 1), MAX_QUESTIONS));
}
function formatDuration(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
module.exports = { MAX_QUESTIONS, shuffle, getQuestionCountOptions, selectQuestions, formatDuration };
