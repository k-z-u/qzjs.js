export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// 日本語正規化（狭義）: 仕様決定版
// 吸収するもの: 前後/連続スペース, 全角半角, 英字大小, NFKC, ・の有無
// 吸収しないもの: ひらがな<->漢字の読み変換（気候<->きこう）は accept/yomi で明示
export function normalizeJa(value) {
  let s = normalizeText(value);
  // 中黒「・」のみ除去（明らかな表記揺れ）。ハイフンやスラッシュは意味を持つため残す
  s = s.replace(/[・･\u30FB\uFF65]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function gradeInput(question, payload = {}) {
  const raw = typeof payload === "string" ? payload : (payload.text ?? "");
  const userAnswer = String(raw).trim();
  const mode = question.match === "strict" ? "strict" : "normalized";
  const normFn = mode === "strict" ? normalizeText : normalizeJa;
  const normalized = normFn(userAnswer);
  const allAnswers = question.answers ?? [];
  const yomiAnswers = question.yomiAnswers ?? [];
  const combined = [...allAnswers, ...yomiAnswers];
  const correct =
    normalized !== "" && combined.some((a) => normFn(a) === normalized);
  return {
    correct,
    userAnswer: userAnswer === "" ? "（未回答）" : userAnswer,
    correctAnswer: allAnswers[0] ?? "",
  };
}
