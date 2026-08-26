import { describe, expect, it } from "vitest";
import { Engine } from "../src/core/engine.js";
import { buildResult } from "../src/core/result.js";
import { normalizeText } from "../src/questions/input.js";

const makeQuiz = () => ({
  title: "数学ミニテスト",
  questions: [
    {
      id: "q1",
      type: "choice",
      topic: "比例",
      question: "y = 2x のとき、x が2倍になると y は？",
      options: ["半分", "2倍", "変わらない"],
      correctIndex: 1,
      explanation: "比例なので2倍になります。",
    },
    {
      id: "q2",
      type: "input",
      topic: "英語",
      question: "「図書館」の英単語は？",
      answers: ["library"],
      explanation: "library です。",
    },
    {
      id: "q3",
      type: "order",
      topic: "数の大小",
      question: "小さい順に並べ替え",
      items: ["3", "1", "2"],
      correctOrder: ["1", "2", "3"],
      explanation: "1 < 2 < 3 です。",
    },
  ],
});

describe("engine: 採点", () => {
  it("choice の正解・不正解", () => {
    const eng = new Engine(makeQuiz());
    const okOutcome = eng.submitCurrent({ selectedIndex: 1 });
    expect(okOutcome.correct).toBe(true);
    expect(okOutcome.userAnswer).toBe("2倍");
    expect(eng.records[0].correct).toBe(true);

    const eng2 = new Engine(makeQuiz());
    const ngOutcome = eng2.submitCurrent({ selectedIndex: 0 });
    expect(ngOutcome.correct).toBe(false);
    expect(ngOutcome.userAnswer).toBe("半分");
    expect(ngOutcome.correctAnswer).toBe("2倍");
  });

  it("input は前後空白・大文字小文字・全角半角を許容", () => {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 0 }); // q1は間違えて進む
    eng.next();
    const outcome = eng.submitCurrent({ text: "  LiBrArY " });
    expect(outcome.correct).toBe(true);
  });

  it("input は全角英数字も許容", () => {
    const quiz = makeQuiz();
    quiz.questions[1].answers = ["12"];
    const eng = new Engine(quiz);
    eng.submitCurrent({ selectedIndex: 0 });
    eng.next();
    expect(eng.submitCurrent({ text: "１２" }).correct).toBe(true);
    expect(eng.records[1].correct).toBe(true);
  });

  it("input の不正解は記録される", () => {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 1 });
    eng.next();
    const outcome = eng.submitCurrent({ text: "libraries" });
    expect(outcome.correct).toBe(false);
  });

  it("normalizeText の基本動作", () => {
    expect(normalizeText("  Ｌｉｂｒａｒｙ  ")).toBe("library");
    expect(normalizeText("１２３")).toBe("123");
    expect(normalizeText("A   B")).toBe("a b");
  });

  it("order は完全一致のみ正解", () => {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 1 });
    eng.next();
    eng.submitCurrent({ text: "library" });
    eng.next();
    const okOutcome = eng.submitCurrent({ order: ["1", "2", "3"] });
    expect(okOutcome.correct).toBe(true);

    const eng2 = new Engine(makeQuiz());
    eng2.submitCurrent({ selectedIndex: 1 });
    eng2.next();
    eng2.submitCurrent({ text: "library" });
    eng2.next();
    const ngOutcome = eng2.submitCurrent({ order: ["2", "1", "3"] });
    expect(ngOutcome.correct).toBe(false);
    expect(ngOutcome.userAnswer).toBe("2 → 1 → 3");
    expect(ngOutcome.correctAnswer).toBe("1 → 2 → 3");
  });

  it("回答済みの問題は二度採点されない", () => {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 1 });
    expect(() => eng.submitCurrent({ selectedIndex: 0 })).toThrow();
    expect(eng.answeredCount).toBe(1);
  });

  it("next は回答前には進めず、最後まで進むと finished", () => {
    const eng = new Engine(makeQuiz());
    expect(eng.finished).toBe(false);
    expect(eng.next()).toBe(false);

    eng.submitCurrent({ selectedIndex: 1 });
    expect(eng.next()).toBe(true);

    eng.submitCurrent({ text: "library" });
    eng.next();

    eng.submitCurrent({ order: ["1", "2", "3"] });
    eng.next();

    expect(eng.finished).toBe(true);
    expect(eng.current).toBeNull();
  });
});

describe("result: 集計とAI出力", () => {
  function runMixed() {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 0 }); // q1 不正解
    eng.next();
    eng.submitCurrent({ text: "library" }); // q2 正解
    eng.next();
    eng.submitCurrent({ order: ["2", "1", "3"] }); // q3 不正解
    eng.next();
    return buildResult(eng.quiz.title, eng.records);
  }

  it("スコア・accuracy・topic別集計", () => {
    const result = runMixed();
    expect(result.quizTitle).toBe("数学ミニテスト");
    expect(result.total).toBe(3);
    expect(result.correct).toBe(1);
    expect(result.incorrect).toBe(2);
    expect(result.accuracy).toBe(33);
    expect(result.topicResults["比例"]).toEqual({ total: 1, correct: 0 });
    expect(result.topicResults["英語"]).toEqual({ total: 1, correct: 1 });
    expect(result.topicResults["数の大小"]).toEqual({ total: 1, correct: 0 });
  });

  it("間違えた問題の一覧と正答ID一覧", () => {
    const result = runMixed();
    expect(result.incorrectQuestions.map((q) => q.number)).toEqual([1, 3]);
    expect(result.incorrectQuestions[0].correctAnswer).toBe("2倍");
    expect(result.correctQuestionIds).toEqual(["q2"]);
  });

  it("toAIText が安定した形式を返す", () => {
    const text = runMixed().toAIText();
    expect(text).toContain("--- qzjs.js RESULT v1 ---");
    expect(text).toContain("Quiz: 数学ミニテスト");
    expect(text).toContain("Score: 1/3");
    expect(text).toContain("Accuracy: 33%");
    expect(text).toContain("- 英語: 1/1");
    expect(text).toContain("[Q1]");
    expect(text).toContain("UserAnswer:");
    expect(text).toContain("CorrectAnswer: 2倍");
    expect(text).toContain("CorrectQuestionIDs:");
    expect(text).toContain("q2");
    expect(text).toContain("Please analyze my mistakes.");
    expect(text).toContain("--- END qzjs.js RESULT ---");
  });

  it("全問正解では IncorrectQuestions が「なし」になる", () => {
    const eng = new Engine(makeQuiz());
    eng.submitCurrent({ selectedIndex: 1 });
    eng.next();
    eng.submitCurrent({ text: "LIBRARY" });
    eng.next();
    eng.submitCurrent({ order: ["1", "2", "3"] });
    eng.next();
    const text = buildResult(eng.quiz.title, eng.records).toAIText();
    expect(text).toContain("Accuracy: 100%");
    const section = text.split("IncorrectQuestions:\n")[1];
    expect(section.startsWith("なし")).toBe(true);
  });
});
