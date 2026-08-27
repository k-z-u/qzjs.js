import { normalizeJa } from "./input.js";

function extractUnitSuffix(raw) {
  // 末尾の単位らしき文字列を抽出（例: "2.7 g/cm3" -> {num:"2.7", unit:"g/cm3"}）
  const s = String(raw ?? "").trim().normalize("NFKC");
  // 数値部分の後ろに続く文字列を単位とみなす
  // 数値は先頭から parseFloat で取れる範囲
  const m = s.match(/^([+-]?[\d,]+(?:\.\d+)?(?:\s*\/\s*[\d,]+(?:\.\d+)?)?)\s*(.*)$/);
  if (!m) return { numPart: s, unitPart: "" };
  return { numPart: m[1].trim(), unitPart: m[2].trim() };
}

function normalizeUnit(u) {
  return String(u ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/³/g, "3")
    .replace(/²/g, "2");
}

function parseNumericValue(numPart) {
  let s = String(numPart ?? "").trim().normalize("NFKC").replace(/,/g, "").trim();
  if (s === "") return null;
  if (/^-?\d+\s*\/\s*-?\d+$/.test(s)) {
    const [a, b] = s.split("/").map((v) => parseFloat(v.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    return a / b;
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function gradeNumeric(question, payload = {}) {
  const raw = typeof payload === "string" ? payload : (payload.text ?? payload.value ?? "");
  const userAnswerRaw = String(raw).trim();
  const answerNum = Number(question.answer);
  const tolerance = Number.isFinite(Number(question.tolerance)) ? Number(question.tolerance) : 0;
  const unit = question.unit ?? "";
  const requireUnit = !!question.requireUnit;
  const unitNorm = normalizeUnit(unit);

  if (userAnswerRaw === "") {
    return { correct: false, userAnswer: "（未回答）", correctAnswer: String(question.answer ?? "") + (unit ? ` ${unit}` : "") };
  }

  const { numPart, unitPart } = extractUnitSuffix(userAnswerRaw);
  const userUnitNorm = normalizeUnit(unitPart);
  const userNum = parseNumericValue(numPart);

  // 単位判定
  let unitOk = true;
  if (unitNorm !== "") {
    if (requireUnit) {
      // 単位必須: 単位がなければ不正解、間違っていても不正解
      if (userUnitNorm === "") unitOk = false;
      else if (userUnitNorm !== unitNorm) unitOk = false;
    } else {
      // 単位任意: 省略はOK、書かれたら正しいかチェック
      if (userUnitNorm !== "" && userUnitNorm !== unitNorm) unitOk = false;
    }
  } else {
    // 期待単位なし: ユーザーが単位を書いても数値のみで判定（寛容）
    unitOk = true;
  }

  if (userNum === null || !Number.isFinite(answerNum)) {
    return { correct: false, userAnswer: userAnswerRaw, correctAnswer: String(question.answer ?? "") + (unit ? ` ${unit}` : "") };
  }

  const acceptNums = (question.acceptAnswers ?? []).map((a) => parseNumericValue(extractUnitSuffix(a).numPart)).filter((v) => v !== null);

  let numericOk = false;
  if (Math.abs(userNum - answerNum) <= tolerance + 1e-12) numericOk = true;
  else if (acceptNums.some((n) => Math.abs(userNum - n) <= tolerance + 1e-12)) numericOk = true;
  else {
    const normUser = normalizeJa(userAnswerRaw);
    const normAns = normalizeJa(String(question.answer));
    if (normUser === normAns) numericOk = true;
  }

  const correct = numericOk && unitOk;
  const correctAnswer = String(question.answerRaw ?? question.answer ?? "") + (unit ? ` ${unit}` : "");
  return { correct, userAnswer: userAnswerRaw, correctAnswer };
}
