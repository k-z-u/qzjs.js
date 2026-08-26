export function createError(message, { number, id, line } = {}) {
  const err = { message };
  if (number != null) err.number = number;
  if (id != null) err.id = id;
  if (line != null) err.line = line;
  return err;
}

export function formatError(err) {
  const head = [];
  if (err.number != null) head.push(`${err.number}問目`);
  if (err.id != null) head.push(`(${err.id})`);
  let out = head.length > 0 ? `${head.join(" ")}: ${err.message}` : err.message;
  if (err.line != null) out += `（${err.line}行目）`;
  return out;
}

export function formatErrors(errors) {
  return errors.map((e) => formatError(e)).join("\n");
}

export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function checkDuplicateIds(questions, errors) {
  const seen = new Map();
  for (const q of questions) {
    const prevLine = seen.get(q.id);
    if (prevLine != null) {
      errors.push(
        createError(
          `問題ID "${q.id}" が重複しています（${prevLine}行目と${q._line}行目）。IDは一意にしてください`,
          { number: q._number, id: q.id, line: q._line },
        ),
      );
    } else {
      seen.set(q.id, q._line);
    }
  }
}
