export function formatMatch(pairs) {
  return pairs.map(([l, r]) => `${l}→${r}`).join(" / ");
}

export function gradeMatch(question, payload = {}) {
  const userPairs = payload?.pairs;
  // payload.pairs: array of [left, right] or object map
  let normalizedUser = [];
  if (Array.isArray(userPairs)) {
    normalizedUser = userPairs.map(([l, r]) => [String(l), String(r)]);
  } else if (userPairs && typeof userPairs === "object") {
    normalizedUser = Object.entries(userPairs).map(([l, r]) => [String(l), String(r)]);
  }
  const correctPairs = question.pairs ?? [];
  if (normalizedUser.length === 0) {
    return { correct: false, userAnswer: "（未回答）", correctAnswer: formatMatch(correctPairs) };
  }
  // 順不同で比較：左辺をキーにして右辺が一致するか
  const correctMap = new Map(correctPairs);
  const userMap = new Map(normalizedUser);
  let correct = true;
  if (userMap.size !== correctMap.size) correct = false;
  else {
    for (const [k, v] of correctMap) {
      if (userMap.get(k) !== v) {
        correct = false;
        break;
      }
    }
  }
  const userAnswer = formatMatch(normalizedUser);
  return { correct, userAnswer: userAnswer || "（未回答）", correctAnswer: formatMatch(correctPairs) };
}
