import { checkDuplicateIds, createError, sameMultiset } from "./validator.js";

export const QUESTION_TYPES = ["choice", "input", "order"];
const TYPE_SET = new Set(QUESTION_TYPES);
const LIST_KEYS = new Set(["items", "answer", "accept"]);
const KNOWN_KEYS = new Set([
  "id",
  "topic",
  "question",
  "answer",
  "accept",
  "items",
  "explanation",
]);

function clip(text, max = 24) {
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function extractStar(raw) {
  if (raw.endsWith("\\*")) {
    return { text: raw.slice(0, -2).trimEnd(), starred: false };
  }
  const m = raw.match(/^(.*?)\s*\*$/);
  if (m && m[1].trim() !== "") {
    return { text: m[1].trimEnd(), starred: true };
  }
  if (raw === "*") {
    return { text: "", starred: true };
  }
  return { text: raw, starred: false };
}

function dedupeStrings(values) {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v !== ""))];
}

export function parseQuiz(source) {
  const errors = [];
  const text = String(source ?? "").replace(/^\uFEFF/, "");
  const lines = text.split(/\r\n|\r|\n/);

  let title = "";
  let quizCount = 0;
  const parsedQuestions = [];
  let questionNumber = 0;

  let i = 0;
  while (i < lines.length) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    i += 1;

    if (line === "" || line.startsWith("#")) continue;

    if (/^@quiz(\s|$)/i.test(line)) {
      quizCount += 1;
      const rest = line.slice(5).trim();
      if (rest !== "") {
        const m =
          rest.match(/^"(.*)"$/) ?? rest.match(/^「(.*)」$/) ?? rest.match(/^(.+)$/);
        title = m ? m[1].trim() : "";
      } else {
        title = "";
      }
      continue;
    }

    const dir = line.match(/^@([A-Za-z][A-Za-z0-9_-]*)(.*)$/);
    if (dir) {
      const type = dir[1].toLowerCase();
      const startLine = lineNo;
      const body = [];
      while (i < lines.length) {
        const inner = lines[i].trim();
        if (inner.startsWith("@")) break;
        body.push({ line: inner, no: i + 1 });
        i += 1;
      }

      if (!TYPE_SET.has(type)) {
        errors.push(
          createError(
            `不明な問題タイプ "@${dir[1]}" です。使えるのは ${QUESTION_TYPES.map((t) => "@" + t).join(" / ")} です`,
            { line: startLine },
          ),
        );
        continue;
      }

      questionNumber += 1;
      parsedQuestions.push(
        parseQuestionBlock(type, body, { number: questionNumber, line: startLine }, errors),
      );
      continue;
    }

    errors.push(
      createError(`問題ブロックの外に読み取れない行があります: "${clip(line)}"`, {
        line: lineNo,
      }),
    );
  }

  if (quizCount === 0) {
    errors.unshift(
      createError(
        '@quiz ディレクティブがありません。先頭に例のように @quiz "クイズ名" を追加してください',
      ),
    );
  } else if (quizCount > 1) {
    errors.push(createError("@quiz は 1回だけ指定してください"));
  }
  if (quizCount >= 1 && questionNumber === 0) {
    errors.push(
      createError("問題が 1つもありません。@choice / @input / @order ブロックを追加してください"),
    );
  }

  checkDuplicateIds(parsedQuestions, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const questions = parsedQuestions.map(({ _line, _number, ...q }) => q);
  return { ok: true, quiz: { title, questions } };
}

function parseQuestionBlock(type, body, meta, errors) {
  const fields = new Map();
  const lists = new Map();
  const options = [];
  let currentList = null;

  for (const { line, no } of body) {
    if (line === "" || line.startsWith("#")) continue;

    if (line.startsWith("-")) {
      const rawItem = line.slice(1).trim();
      const { text: itemText, starred } = extractStar(rawItem);

      if (currentList) {
        lists.get(currentList).entries.push({ text: itemText, line: no });
      } else if (type === "choice") {
        options.push({ text: itemText, starred, line: no });
      } else {
        errors.push(
          createError('リスト項目 "-" は items: / answer: / accept: の直後に書いてください', {
            number: meta.number,
            line: no,
          }),
        );
      }
      continue;
    }

    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*)[ \t]*:[ \t]*(.*)$/);
    if (kv) {
      const key = kv[1].toLowerCase();
      const value = kv[2].trim();

      if (!KNOWN_KEYS.has(key)) {
        errors.push(createError(`不明なフィールド "${key}:" があります`, { number: meta.number, line: no }));
        currentList = null;
        continue;
      }

      if (LIST_KEYS.has(key)) {
        if (lists.has(key)) {
          errors.push(
            createError(`フィールド "${key}:" が重複しています`, { number: meta.number, line: no }),
          );
        } else {
          lists.set(key, { inline: value, entries: [], line: no });
        }
        currentList = key;
      } else {
        if (fields.has(key)) {
          errors.push(
            createError(`フィールド "${key}:" が重複しています`, { number: meta.number, line: no }),
          );
        }
        fields.set(key, { value, line: no });
        currentList = null;
      }
      continue;
    }

    errors.push(createError(`読み取れない行があります: "${clip(line)}"`, { number: meta.number, line: no }));
  }

  const id = fields.get("id")?.value || `q${meta.number}`;
  const topic = fields.get("topic")?.value || "";
  const question = fields.get("question")?.value || "";
  const explanation = fields.get("explanation")?.value || "";
  const ctx = { number: meta.number, id };

  if (question === "") {
    errors.push(
      createError("question が指定されていません", {
        ...ctx,
        line: fields.get("question")?.line ?? meta.line,
      }),
    );
  }

  let specific;
  if (type === "choice") {
    specific = finalizeChoice(ctx, options, errors, meta.line);
  } else if (type === "input") {
    specific = finalizeInput(ctx, fields, lists, errors, meta.line);
  } else {
    specific = finalizeOrder(ctx, lists, errors, meta.line);
  }

  return {
    id,
    topic,
    question,
    explanation,
    ...specific,
    _number: meta.number,
    _line: meta.line,
  };
}

function finalizeChoice(ctx, options, errors, blockLine) {
  for (const opt of options) {
    if (opt.text === "") {
      errors.push(createError("空の選択肢があります", { ...ctx, line: opt.line }));
    }
  }
  if (options.length < 2) {
    errors.push(
      createError(`選択肢が少なすぎます（${options.length}個）。2つ以上必要です`, {
        ...ctx,
        line: blockLine,
      }),
    );
  }

  const starCount = options.filter((o) => o.starred).length;
  if (starCount === 0) {
    errors.push(
      createError("正解の選択肢がありません。正解の末尾に * を付けてください", {
        ...ctx,
        line: blockLine,
      }),
    );
  } else if (starCount > 1) {
    errors.push(
      createError(`正解の指定 (*) が ${starCount}個あります。1つだけにしてください`, {
        ...ctx,
        line: blockLine,
      }),
    );
  }

  return {
    type: "choice",
    options: options.map((o) => o.text),
    correctIndex: starCount === 1 ? options.findIndex((o) => o.starred) : -1,
  };
}

function finalizeInput(ctx, fields, lists, errors, blockLine) {
  const answers = [];

  const answerField = fields.get("answer");
  if (answerField && answerField.value !== "") {
    answers.push(answerField.value);
  }

  // "answer" は LIST_KEYS に入っているため、input では
  // "answer: 12" のようなインライン形式もリスト側に記録される
  const answerList = lists.get("answer");
  if (answerList) {
    if (answerList.inline !== "") {
      answers.push(answerList.inline);
    }
    for (const entry of answerList.entries) {
      if (entry.text !== "") {
        answers.push(entry.text);
      } else {
        errors.push(createError("answer の項目が空です", { ...ctx, line: entry.line }));
      }
    }
  }

  const accept = lists.get("accept");
  if (accept) {
    if (accept.inline !== "") answers.push(accept.inline);
    for (const entry of accept.entries) {
      if (entry.text !== "") {
        answers.push(entry.text);
      } else {
        errors.push(createError("accept の項目が空です", { ...ctx, line: entry.line }));
      }
    }
  }

  if (answers.length === 0) {
    errors.push(
      createError("answer が指定されていません。例: answer: 12", {
        ...ctx,
        line: answerField?.line ?? blockLine,
      }),
    );
  }

  return { type: "input", answers: dedupeStrings(answers) };
}

function finalizeOrder(ctx, lists, errors, blockLine) {
  const itemsEntry = lists.get("items");
  const answerEntry = lists.get("answer");
  const items = itemsEntry ? itemsEntry.entries.map((e) => e.text) : [];
  const correctOrder = answerEntry ? answerEntry.entries.map((e) => e.text) : [];

  if (!itemsEntry || items.length === 0) {
    errors.push(
      createError("items が指定されていません。items: に続けて - 項目 を並べてください", {
        ...ctx,
        line: itemsEntry?.line ?? blockLine,
      }),
    );
  }
  if (!answerEntry || correctOrder.length === 0) {
    errors.push(
      createError("answer が指定されていません。answer: に続けて正しい順に - 項目 を並べてください", {
        ...ctx,
        line: answerEntry?.line ?? blockLine,
      }),
    );
  }

  for (const [name, values] of [
    ["items", items],
    ["answer", correctOrder],
  ]) {
    values.forEach((v, idx) => {
      if (v === "") {
        errors.push(
          createError(`${name} の ${idx + 1}番目の項目が空です`, { ...ctx, line: blockLine }),
        );
      }
    });
  }

  if (items.length > 0 && correctOrder.length > 0) {
    if (items.length !== correctOrder.length) {
      errors.push(
        createError(
          `items（${items.length}個）と answer（${correctOrder.length}個）の数が一致しません`,
          { ...ctx, line: blockLine },
        ),
      );
    } else if (!sameMultiset(items, correctOrder)) {
      errors.push(
        createError(
          "items と answer の内容が一致しません。answer は items と同じ項目を並べ替えたものにしてください",
          { ...ctx, line: blockLine },
        ),
      );
    }
  }

  return { type: "order", items, correctOrder };
}
