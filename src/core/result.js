export const RESULT_FORMAT_VERSION = "v1";

export function buildResult(quizTitle, records) {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const topicResults = {};
  for (const r of records) {
    const topicName = r.topic || "未分類";
    if (!topicResults[topicName]) {
      topicResults[topicName] = { total: 0, correct: 0 };
    }
    topicResults[topicName].total += 1;
    if (r.correct) topicResults[topicName].correct += 1;
  }

  const answers = records.map((r) => ({ ...r }));
  const incorrectQuestions = answers.filter((a) => !a.correct);
  const correctQuestionIds = answers.filter((a) => a.correct).map((a) => a.id);

  return {
    quizTitle,
    total,
    correct,
    incorrect: total - correct,
    accuracy,
    topicResults,
    answers,
    incorrectQuestions,
    correctQuestionIds,

    toAIText() {
      return buildAIText(this);
    },
  };
}

function buildAIText(result) {
  const L = [];
  L.push(`--- qzjs.js RESULT ${RESULT_FORMAT_VERSION} ---`);
  L.push("");
  L.push(`Quiz: ${result.quizTitle || "(無題)"}`);
  L.push(`Score: ${result.correct}/${result.total}`);
  L.push(`Accuracy: ${result.accuracy}%`);
  L.push("");

  L.push("TopicResults:");
  const topics = Object.entries(result.topicResults);
  if (topics.length === 0) {
    L.push("(なし)");
  } else {
    for (const [name, stat] of topics) {
      L.push(`- ${name}: ${stat.correct}/${stat.total}`);
    }
  }
  L.push("");

  L.push("IncorrectQuestions:");
  if (result.incorrectQuestions.length === 0) {
    L.push("なし");
  } else {
    L.push("");
    for (const q of result.incorrectQuestions) {
      L.push(`[Q${q.number}]`);
      L.push(`ID: ${q.id}`);
      L.push(`Topic: ${q.topic || "(なし)"}`);
      L.push(`Question: ${q.question}`);
      L.push(`UserAnswer: ${q.userAnswer}`);
      L.push(`CorrectAnswer: ${q.correctAnswer}`);
      if (q.explanation) L.push(`Explanation: ${q.explanation}`);
      L.push("");
    }
  }

  L.push("CorrectQuestionIDs:");
  L.push(result.correctQuestionIds.length > 0 ? result.correctQuestionIds.join(", ") : "なし");
  L.push("");
  L.push("Please analyze my mistakes.");
  L.push("Explain what I misunderstood.");
  L.push("Then create a new qzjs.js quiz focused on my weak areas.");
  L.push("");
  L.push(`--- END qzjs.js RESULT ---`);
  L.push("");

  return L.join("\n");
}
