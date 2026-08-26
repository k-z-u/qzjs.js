export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function gradeInput(question, payload = {}) {
  const raw = typeof payload === "string" ? payload : (payload.text ?? "");
  const userAnswer = String(raw).trim();
  const normalized = normalizeText(userAnswer);
  const correct =
    normalized !== "" && question.answers.some((a) => normalizeText(a) === normalized);
  return {
    correct,
    userAnswer: userAnswer === "" ? "（未回答）" : userAnswer,
    correctAnswer: question.answers[0] ?? "",
  };
}
