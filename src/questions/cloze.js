import { normalizeJa, normalizeText } from "./input.js";

export function parseClozeTemplate(questionText) {
  // {答え} や {答え|別解1|別解2} を抽出。 \| と \} はエスケープ
  const slots = [];
  let i = 0;
  while (i < questionText.length) {
    const open = questionText.indexOf("{", i);
    if (open === -1) break;
    // エスケープされた \{ はスキップ
    if (open > 0 && questionText[open - 1] === "\\") {
      i = open + 1;
      continue;
    }
    let j = open + 1;
    let buf = "";
    let found = false;
    while (j < questionText.length) {
      const ch = questionText[j];
      if (ch === "}" && questionText[j - 1] !== "\\") {
        found = true;
        break;
      }
      buf += ch;
      j++;
    }
    if (!found) break;
    // エスケープ解除
    const raw = buf.replace(/\\\|/g, "|").replace(/\\\}/g, "}").replace(/\\\\/g, "\\").trim();
    if (raw !== "") {
      const options = raw
        .split(/(?<!\\)\|/)
        .map((s) => s.replace(/\\\|/g, "|").replace(/\\\}/g, "}").replace(/\\\\/g, "\\").trim())
        .filter((s) => s !== "");
      if (options.length > 0) slots.push(options);
    }
    i = j + 1;
  }
  // フォールバック: 上記がヒットしない場合は単純正規表現（後方互換）
  if (slots.length === 0) {
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(questionText)) !== null) {
      if (m[1].includes("\\|") || m[1].includes("\\}")) continue; // エスケープ済みなら上で処理
      const raw = m[1].trim();
      if (raw === "") continue;
      const options = raw.split("|").map((s) => s.trim()).filter((s) => s !== "");
      if (options.length > 0) slots.push(options);
    }
  }
  return slots;
}

export function formatClozeAnswers(slots) {
  return slots.map((opts) => opts[0] ?? "").join(" / ");
}

export function renderClozeQuestion(questionText) {
  // {答え} を ____ に置換して表示用テキストを作る（正答は表示しない）
  return questionText.replace(/\{[^}]+\}/g, "____");
}

export function gradeCloze(question, payload = {}) {
  const userTexts = Array.isArray(payload?.texts)
    ? payload.texts.map(String)
    : Array.isArray(payload?.blanks)
      ? payload.blanks.map(String)
      : typeof payload?.text === "string"
        ? [payload.text]
        : [];
  const slots = question.clozeAnswers ?? [];
  if (slots.length === 0) {
    return { correct: false, userAnswer: "（未回答）", correctAnswer: "" };
  }
  const mode = question.match === "strict" ? "strict" : "normalized";
  const normFn = mode === "strict" ? normalizeText : normalizeJa;

  let correct = true;
  if (userTexts.length !== slots.length) correct = false;
  else {
    for (let i = 0; i < slots.length; i++) {
      const userNorm = normFn(userTexts[i] ?? "");
      if (userNorm === "") {
        correct = false;
        break;
      }
      const opts = slots[i] ?? [];
      const hit = opts.some((a) => normFn(a) === userNorm);
      if (!hit) {
        correct = false;
        break;
      }
    }
  }
  const userAnswer = userTexts.length > 0 ? userTexts.join(" / ") || "（未回答）" : "（未回答）";
  const correctAnswer = formatClozeAnswers(slots);
  return { correct, userAnswer, correctAnswer };
}
