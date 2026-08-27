import { checkDuplicateIds, createError, sameMultiset } from "./validator.js";
import { parseClozeTemplate } from "../questions/cloze.js";

export const QUESTION_TYPES = ["choice", "input", "order", "match", "group", "cloze", "numeric", "hotspot"];
// 公開は @group のみ。@sort / @map は内部エイリアスとしてのみ許容し、PROMPT.mdやエラー表示には出さない
const INTERNAL_ALIASES = { sort: "group", map: "hotspot" };
const TYPE_SET = new Set([...QUESTION_TYPES, ...Object.keys(INTERNAL_ALIASES)]);
const LIST_KEYS = new Set(["items", "answer", "accept", "pairs", "groups", "areas"]);
const KNOWN_KEYS = new Set([
  "id",
  "topic",
  "question",
  "answer",
  "accept",
  "items",
  "explanation",
  "pairs",
  "groups",
  "areas",
  "image",
  "unit",
  "tolerance",
  "requireunit",
  "match",
  "yomi",
]);

function clip(text, max = 40) {
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

function splitPair(raw) {
  // 対応する区切り: =>, →, ->, :, ＝, =, 、
  const seps = ["=>", "→", "->", "＝", "：", ":"];
  for (const sep of seps) {
    const idx = raw.indexOf(sep);
    if (idx !== -1) {
      const left = raw.slice(0, idx).trim();
      const right = raw.slice(idx + sep.length).trim();
      if (left !== "" && right !== "") return [left, right];
    }
  }
  // "A , B" のようなカンマ区切りも許容（最後の手段）
  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx !== -1) {
    const left = raw.slice(0, commaIdx).trim();
    const right = raw.slice(commaIdx + 1).trim();
    if (left !== "" && right !== "") return [left, right];
  }
  return null;
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
      let type = dir[1].toLowerCase();
      type = INTERNAL_ALIASES[type] ?? type;
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
  let currentGroup = null; // for groups:

  for (const { line, no } of body) {
    if (line === "" || line.startsWith("#")) continue;

    // groups のネスト: "- グループ名:"  と "  - 項目"
    // body は trim 済みなので、元行のインデントは失われるが、"- " で始まる行で ":" で終わるものはグループヘッダとみなす
    // ただし trim 済みなので "  - 項目" も "- 項目" になる。グループ内判定は currentList==="groups" かつ ":" で終わるかで区別
    if (line.startsWith("-")) {
      const rawItem = line.slice(1).trim();

      // groups のグループヘッダ: "- 東部:" のように : で終わる
      if (currentList === "groups" && rawItem.endsWith(":")) {
        const groupName = rawItem.slice(0, -1).trim();
        if (groupName === "") {
          errors.push(createError("グループ名が空です", { number: meta.number, line: no }));
        } else {
          const entry = lists.get("groups");
          entry.groups.push({ name: groupName, items: [], line: no });
          currentGroup = entry.groups.length - 1;
        }
        continue;
      }

      // hotspot areas は通常のリストだが、groups 内の項目は group に追加
      if (currentList === "groups" && currentGroup !== null) {
        const { text: itemText } = extractStar(rawItem);
        if (itemText === "") {
          errors.push(createError("グループ内の項目が空です", { number: meta.number, line: no }));
        } else {
          lists.get("groups").groups[currentGroup].items.push({ text: itemText, line: no });
        }
        continue;
      }

      const { text: itemText, starred } = extractStar(rawItem);

      if (currentList) {
        lists.get(currentList).entries.push({ text: itemText, line: no });
      } else if (type === "choice") {
        options.push({ text: itemText, starred, line: no });
      } else {
        errors.push(
          createError('リスト項目 "-" は items: / answer: / accept: / pairs: / groups: / areas: の直後に書いてください', {
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
        currentGroup = null;
        continue;
      }

      if (LIST_KEYS.has(key)) {
        if (lists.has(key)) {
          errors.push(
            createError(`フィールド "${key}:" が重複しています`, { number: meta.number, line: no }),
          );
        } else {
          if (key === "groups") {
            lists.set(key, { inline: value, entries: [], groups: [], line: no });
            // inline に "東部, 西部" のような簡易指定があればグループヘッダとして展開
            if (value !== "") {
              const names = value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
              for (const n of names) {
                lists.get(key).groups.push({ name: n.replace(/:$/, ""), items: [], line: no });
              }
              if (names.length > 0) currentGroup = 0;
            }
          } else {
            lists.set(key, { inline: value, entries: [], line: no });
          }
        }
        currentList = key;
        if (key !== "groups") currentGroup = null;
        // groups のネストをリセット
        if (key === "groups" && lists.get(key).groups.length === 0) currentGroup = null;
      } else {
        if (fields.has(key)) {
          errors.push(
            createError(`フィールド "${key}:" が重複しています`, { number: meta.number, line: no }),
          );
        }
        fields.set(key, { value, line: no });
        currentList = null;
        currentGroup = null;
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
  } else if (type === "order") {
    specific = finalizeOrder(ctx, lists, errors, meta.line);
  } else if (type === "match") {
    specific = finalizeMatch(ctx, lists, fields, errors, meta.line);
  } else if (type === "group") {
    specific = finalizeGroup(ctx, lists, errors, meta.line);
  } else if (type === "cloze") {
    specific = finalizeCloze(ctx, fields, lists, errors, meta.line);
  } else if (type === "numeric") {
    specific = finalizeNumeric(ctx, fields, lists, errors, meta.line);
  } else if (type === "hotspot") {
    specific = finalizeHotspot(ctx, fields, lists, errors, meta.line);
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
  const yomiAnswers = [];

  const answerField = fields.get("answer");
  if (answerField && answerField.value !== "") {
    answers.push(answerField.value);
  }

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

  // yomi フィールド: カンマ or 改行区切り or accept と同様のリスト
  const yomiField = fields.get("yomi");
  if (yomiField && yomiField.value !== "") {
    yomiAnswers.push(...yomiField.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean));
  }
  // yomi がリストとして書かれるケースは accept と同様に扱う（yomi: の後に - 行）
  // parser上 yomi は LIST_KEYS に入っていないので、"yomi:" の後に "- 項目" が来ても currentList が null になる
  // そのため yomi 用のリストは accept の直後と同じ扱いにする: yomi: に続く - 行は yomiAnswers に入れる
  // ただし簡易実装として yomi はフィールド値のみサポート

  const matchField = fields.get("match");
  let match = "normalized";
  if (matchField) {
    const v = matchField.value.toLowerCase();
    if (v === "strict" || v === "normalized") match = v;
    else {
      errors.push(createError('match は "strict" か "normalized" を指定してください', { ...ctx, line: matchField.line }));
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

  return { type: "input", answers: dedupeStrings(answers), yomiAnswers: dedupeStrings(yomiAnswers), match };
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

function finalizeMatch(ctx, lists, fields, errors, blockLine) {
  const pairsEntry = lists.get("pairs");
  const pairs = [];
  if (pairsEntry) {
    // inline: "A=>B, C=>D" のような簡易記法も許容
    if (pairsEntry.inline !== "") {
      const rawPairs = pairsEntry.inline.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      for (const rp of rawPairs) {
        const pr = splitPair(rp);
        if (pr) pairs.push(pr);
        else errors.push(createError(`pairs の区切り "=>" が見つかりません: "${clip(rp)}"`, { ...ctx, line: pairsEntry.line }));
      }
    }
    for (const entry of pairsEntry.entries) {
      const pr = splitPair(entry.text);
      if (pr) pairs.push(pr);
      else errors.push(createError(`pairs は "左 => 右" の形式で書いてください: "${clip(entry.text)}"`, { ...ctx, line: entry.line }));
    }
  }
  // answer: での pairs 代用も許容（後方互換）
  const answerEntry = lists.get("answer");
  if (answerEntry && pairs.length === 0) {
    for (const entry of answerEntry.entries) {
      const pr = splitPair(entry.text);
      if (pr) pairs.push(pr);
    }
  }

  if (pairs.length < 2) {
    errors.push(createError(`pairs が少なすぎます（${pairs.length}個）。2つ以上必要です。例: - 五大湖 => 冷帯`, { ...ctx, line: pairsEntry?.line ?? blockLine }));
  }
  const lefts = pairs.map(([l]) => l);
  const leftSet = new Set(lefts);
  if (leftSet.size !== lefts.length) {
    errors.push(createError("pairs の左辺が重複しています。左辺は一意にしてください", { ...ctx, line: blockLine }));
  }
  const rights = pairs.map(([, r]) => r);
  // 右辺の重複は許容（同じ気候が複数地域に対応する場合）しないチェックは緩めに

  const matchField = fields.get("match");
  let match = "normalized";
  if (matchField) {
    const v = matchField.value.toLowerCase();
    if (v === "strict" || v === "normalized") match = v;
    else errors.push(createError('match は "strict" か "normalized" を指定してください', { ...ctx, line: matchField.line }));
  }

  return { type: "match", pairs, match };
}

function finalizeGroup(ctx, lists, errors, blockLine) {
  const groupsEntry = lists.get("groups");
  const groups = [];
  if (groupsEntry) {
    for (const g of groupsEntry.groups) {
      const items = g.items.map((e) => e.text).filter((v) => v !== "");
      if (items.length === 0) {
        errors.push(createError(`グループ "${g.name}" に項目がありません。グループ名の下に "  - 項目" を追加してください`, { ...ctx, line: g.line }));
      }
      groups.push({ name: g.name, items });
    }
    // groups: の下に直接 "- 項目" が書かれた場合（グループヘッダなし）の救済
    if (groups.length === 0 && groupsEntry.entries.length > 0) {
      errors.push(createError('groups: の下は "- グループ名:" と "  - 項目" の形式で書いてください。例:\n- 東部:\n  - 冷帯', { ...ctx, line: blockLine }));
    }
  }
  if (groups.length < 2) {
    errors.push(createError(`groups が少なすぎます（${groups.length}個）。2つ以上必要です`, { ...ctx, line: groupsEntry?.line ?? blockLine }));
  }
  const allItems = groups.flatMap((g) => g.items);
  const itemSet = new Set(allItems);
  if (itemSet.size !== allItems.length) {
    errors.push(createError("groups 内で同じ項目が重複しています", { ...ctx, line: blockLine }));
  }
  if (allItems.length < 3) {
    errors.push(createError(`分類する項目が少なすぎます（${allItems.length}個）。3つ以上必要です`, { ...ctx, line: blockLine }));
  }
  return { type: "group", groups };
}

function finalizeCloze(ctx, fields, lists, errors, blockLine) {
  const question = fields.get("question")?.value ?? "";
  const slots = parseClozeTemplate(question);
  if (slots.length === 0) {
    errors.push(createError("question に {答え} の形式で穴埋めを1つ以上入れてください。例: 東部は {冷帯} → {温帯} となる", { ...ctx, line: fields.get("question")?.line ?? blockLine }));
  }
  if (slots.length > 6) {
    errors.push(createError(`穴埋めが多すぎます（${slots.length}個）。6つ以下にしてください`, { ...ctx, line: blockLine }));
  }
  // {正答|別解1|別解2} 形式: parseClozeTemplate が各スロットの options を返す
  // accept/yomi 行は cloze では使わず、{...|...} 内で完結させる。yomi フィールドがあれば後方互換で統合
  const yomiField = fields.get("yomi");
  if (yomiField && yomiField.value !== "") {
    const parts = yomiField.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < slots.length && i < parts.length; i++) {
      if (parts[i]) slots[i].push(parts[i]);
    }
  }

  const matchField = fields.get("match");
  let match = "normalized";
  if (matchField) {
    const v = matchField.value.toLowerCase();
    if (v === "strict" || v === "normalized") match = v;
    else errors.push(createError('match は "strict" か "normalized" を指定してください', { ...ctx, line: matchField.line }));
  }

  // accept リストは cloze では警告なく無視（将来拡張で accept: を { } に統合済み）

  return { type: "cloze", clozeAnswers: slots, match };
}

function finalizeNumeric(ctx, fields, lists, errors, blockLine) {
  const answerField = fields.get("answer");
  const answerRaw = answerField?.value ?? lists.get("answer")?.inline ?? "";
  let answerNum = null;
  if (answerRaw !== "") {
    // 分数も許容
    if (/^-?\d+\s*\/\s*-?\d+$/.test(answerRaw)) {
      const [a, b] = answerRaw.split("/").map((v) => parseFloat(v.trim()));
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) answerNum = a / b;
    } else {
      answerNum = parseFloat(answerRaw.normalize("NFKC").replace(/,/g, ""));
    }
  }
  if (answerRaw === "" || answerNum === null || !Number.isFinite(answerNum)) {
    errors.push(createError("answer に数値を指定してください。例: answer: 2.7", { ...ctx, line: answerField?.line ?? blockLine }));
    answerNum = 0;
  }
  const unit = fields.get("unit")?.value ?? "";
  const requireUnitRaw = fields.get("requireunit")?.value ?? "";
  let requireUnit = false;
  if (requireUnitRaw !== "") {
    const v = requireUnitRaw.toLowerCase();
    if (v === "true" || v === "yes" || v === "1") requireUnit = true;
    else if (v === "false" || v === "no" || v === "0") requireUnit = false;
    else errors.push(createError('requireUnit は true/false で指定してください', { ...ctx, line: fields.get("requireunit")?.line ?? blockLine }));
  }
  const toleranceRaw = fields.get("tolerance")?.value ?? "";
  let tolerance = 0;
  if (toleranceRaw !== "") {
    tolerance = parseFloat(toleranceRaw.normalize("NFKC"));
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      errors.push(createError('tolerance は 0 以上の数値で指定してください。例: tolerance: 0.01', { ...ctx, line: fields.get("tolerance")?.line ?? blockLine }));
      tolerance = 0;
    }
  }
  // accept: の数値も保持
  const acceptEntry = lists.get("accept");
  const acceptAnswers = [];
  if (acceptEntry) {
    if (acceptEntry.inline !== "") acceptAnswers.push(acceptEntry.inline);
    for (const e of acceptEntry.entries) acceptAnswers.push(e.text);
  }
  const matchField = fields.get("match");
  let match = "normalized";
  if (matchField) {
    const v = matchField.value.toLowerCase();
    if (v === "strict" || v === "normalized") match = v;
  }

  return { type: "numeric", answer: answerNum, answerRaw: String(answerRaw), unit, requireUnit, tolerance, acceptAnswers: dedupeStrings(acceptAnswers), match };
}

function finalizeHotspot(ctx, fields, lists, errors, blockLine) {
  const image = fields.get("image")?.value ?? "";
  const answerField = fields.get("answer");
  const answerArea = answerField?.value ?? lists.get("answer")?.inline ?? "";
  // areas: リスト
  const areasEntry = lists.get("areas");
  const areas = [];
  if (areasEntry) {
    if (areasEntry.inline !== "") {
      // inline は "名前: x1,y1,x2,y2" をカンマ区切りで複数
      // 簡易: inline は使わず entries のみ推奨
    }
    for (const entry of areasEntry.entries) {
      // 形式: "ロッキー山脈: 20,30,35,70" または "ロッキー山脈 => 20,30,35,70"
      const sepIdx = entry.text.indexOf(":");
      const sep2 = entry.text.indexOf("=>");
      let name, coordsRaw;
      if (sepIdx !== -1) {
        name = entry.text.slice(0, sepIdx).trim();
        coordsRaw = entry.text.slice(sepIdx + 1).trim();
      } else if (sep2 !== -1) {
        name = entry.text.slice(0, sep2).trim();
        coordsRaw = entry.text.slice(sep2 + 2).trim();
      } else {
        errors.push(createError(`areas は "名前: x1,y1,x2,y2" の形式で書いてください: "${clip(entry.text)}"`, { ...ctx, line: entry.line }));
        continue;
      }
      if (name === "" || coordsRaw === "") {
        errors.push(createError(`areas の名前または座標が空です: "${clip(entry.text)}"`, { ...ctx, line: entry.line }));
        continue;
      }
      const coords = coordsRaw.split(/[,，\s]+/).map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n));
      if (coords.length !== 4) {
        errors.push(createError(`areas の座標は 4つの数値（x1,y1,x2,y2 の%）で指定してください: "${clip(entry.text)}"`, { ...ctx, line: entry.line }));
        continue;
      }
      if (coords.some((n) => n < 0 || n > 100)) {
        errors.push(createError("areas の座標は 0〜100 の%で指定してください", { ...ctx, line: entry.line }));
      }
      areas.push({ name, coords });
    }
  }
  if (image === "") {
    errors.push(createError("image が指定されていません。例: image: https://example.com/map.png", { ...ctx, line: fields.get("image")?.line ?? blockLine }));
  } else if (!/^https?:\/\//.test(image) && !image.startsWith("/") && !image.startsWith("data:")) {
    errors.push(createError("image は https:// から始まるURLか / から始まるパスで指定してください", { ...ctx, line: fields.get("image")?.line ?? blockLine }));
  }
  if (answerArea === "") {
    errors.push(createError("answer が指定されていません。正解のエリア名を answer: に書いてください", { ...ctx, line: answerField?.line ?? blockLine }));
  } else if (areas.length > 0 && !areas.some((a) => a.name === answerArea)) {
    errors.push(createError(`answer "${answerArea}" が areas に存在しません`, { ...ctx, line: answerField?.line ?? blockLine }));
  }
  if (areas.length < 2) {
    errors.push(createError(`areas が少なすぎます（${areas.length}個）。2つ以上必要です`, { ...ctx, line: areasEntry?.line ?? blockLine }));
  }
  return { type: "hotspot", image, areas, answerArea, answer: answerArea };
}
