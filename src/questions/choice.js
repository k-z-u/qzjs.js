export function gradeChoice(question, payload = {}) {
  const selected =
    payload && typeof payload.selectedIndex === "number" ? payload.selectedIndex : -1;
  const valid = Number.isInteger(selected) && selected >= 0 && selected < question.options.length;
  return {
    correct: valid && selected === question.correctIndex,
    userAnswer: valid ? question.options[selected] : "（未選択）",
    correctAnswer: question.options[question.correctIndex] ?? "",
  };
}
