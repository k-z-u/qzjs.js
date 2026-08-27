export function formatGroup(groups) {
  // groups: [{name, items:[]}]
  return groups.map((g) => `${g.name}: ${g.items.join(", ")}`).join(" | ");
}

export function gradeGroup(question, payload = {}) {
  const userGroups = payload?.groups;
  // payload.groups: [{name, items:[]}] or {groupName: [items]}
  let normalizedUser = [];
  if (Array.isArray(userGroups)) {
    normalizedUser = userGroups.map((g) => ({ name: String(g.name), items: (g.items ?? []).map(String) }));
  } else if (userGroups && typeof userGroups === "object") {
    normalizedUser = Object.entries(userGroups).map(([name, items]) => ({
      name: String(name),
      items: (Array.isArray(items) ? items : []).map(String),
    }));
  }
  const correctGroups = question.groups ?? [];
  if (normalizedUser.length === 0) {
    return { correct: false, userAnswer: "（未回答）", correctAnswer: formatGroup(correctGroups) };
  }
  // アイテム→グループ名 の逆引きマップで比較
  const correctMap = new Map();
  for (const g of correctGroups) for (const item of g.items) correctMap.set(item, g.name);
  const userMap = new Map();
  for (const g of normalizedUser) for (const item of g.items) userMap.set(item, g.name);

  let correct = true;
  if (userMap.size !== correctMap.size) correct = false;
  else {
    for (const [item, grp] of correctMap) {
      if (userMap.get(item) !== grp) {
        correct = false;
        break;
      }
    }
  }
  return {
    correct,
    userAnswer: formatGroup(normalizedUser) || "（未回答）",
    correctAnswer: formatGroup(correctGroups),
  };
}
