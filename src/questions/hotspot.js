export function formatHotspot(question) {
  return question.answerArea ?? question.answer ?? "";
}

export function gradeHotspot(question, payload = {}) {
  const selected = String(payload?.area ?? payload?.selected ?? payload?.text ?? "").trim();
  const correctArea = String(question.answerArea ?? question.answer ?? "").trim();
  if (selected === "") {
    return { correct: false, userAnswer: "（未選択）", correctAnswer: correctArea };
  }
  const correct = selected === correctArea;
  return { correct, userAnswer: selected, correctAnswer: correctArea };
}
