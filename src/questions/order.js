export function formatOrder(items) {
  return items.join(" → ");
}

export function gradeOrder(question, payload = {}) {
  const order = Array.isArray(payload?.order) ? payload.order.map(String) : [];
  const complete = order.length > 0 && order.every((v) => v !== "");
  return {
    correct:
      complete &&
      order.length === question.correctOrder.length &&
      order.every((v, i) => v === question.correctOrder[i]),
    userAnswer: order.length > 0 ? formatOrder(order) : "（未回答）",
    correctAnswer: formatOrder(question.correctOrder),
  };
}
