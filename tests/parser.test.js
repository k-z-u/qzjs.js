import { describe, expect, it } from "vitest";
import { parseQuiz } from "../src/core/parser.js";
import { formatErrors } from "../src/core/validator.js";
import { SAMPLE_QUIZ } from "../src/sample.js";

function parseOk(text) {
  const res = parseQuiz(text);
  if (!res.ok) throw new Error(formatErrors(res.errors));
  return res.quiz;
}

const messagesOf = (text) => parseQuiz(text).errors.map((e) => e.message).join("\n");
const errorsOf = (text) => parseQuiz(text).errors;

describe("parser: 正常系", () => {
  it("@choice を解析できる（* は正解指定として消える）", () => {
    const quiz = parseOk(`
@quiz "比例と反比例"

@choice
id: q1
topic: 反比例
question: xが2倍になると、yが半分になる関係は？
- 比例
- 反比例 *
- 一次方程式
explanation: xが2倍になるとyが1/2になるのが反比例です。
`);
    expect(quiz.title).toBe("比例と反比例");
    expect(quiz.questions).toHaveLength(1);
    const q = quiz.questions[0];
    expect(q.type).toBe("choice");
    expect(q.id).toBe("q1");
    expect(q.topic).toBe("反比例");
    expect(q.question).toContain("yが半分になる関係");
    expect(q.options).toEqual(["比例", "反比例", "一次方程式"]);
    expect(q.correctIndex).toBe(1);
    expect(q.explanation).toContain("反比例です");
  });

  it("@input を解析できる（answer + accept）", () => {
    const quiz = parseOk(`
@quiz "計算"

@input
id: q2
topic: 計算
question: 3 × 4 は？
answer: 12
accept:
- １２
- twelve
explanation: 3を4回足すと12です。
`);
    const q = quiz.questions[0];
    expect(q.type).toBe("input");
    expect(q.answers).toEqual(["12", "１２", "twelve"]);
  });

  it("@order を解析できる", () => {
    const quiz = parseOk(`
@quiz "数の大小"

@order
id: q3
topic: 数の大小
question: 小さい順に並べよう
items:
- 10
- 2
- 7
answer:
- 2
- 7
- 10
explanation: 2 < 7 < 10 です。
`);
    const q = quiz.questions[0];
    expect(q.type).toBe("order");
    expect(q.items).toEqual(["10", "2", "7"]);
    expect(q.correctOrder).toEqual(["2", "7", "10"]);
  });

  it("サンプルクイズがエラーなく解析でき、3タイプを含む", () => {
    const quiz = parseOk(SAMPLE_QUIZ);
    expect(quiz.questions).toHaveLength(10);
    const types = new Set(quiz.questions.map((q) => q.type));
    expect(types.has("choice")).toBe(true);
    expect(types.has("input")).toBe(true);
    expect(types.has("order")).toBe(true);
  });
});

describe("parser: 異常系", () => {
  it("@quiz がない場合はエラー", () => {
    const msgs = messagesOf(`@choice
id: q1
question: テスト？
- A *
- B`);
    expect(msgs).toContain("@quiz");
  });

  it("問題が0件の場合はエラー", () => {
    const msgs = messagesOf('@quiz "空"');
    expect(msgs).toMatch(/問題が 1つもありません/);
  });

  it("question がない場合はエラー", () => {
    const errs = errorsOf(`@quiz "t"

@choice
id: q1
- A *
- B`);
    expect(errs.some((e) => e.message.includes("question が指定されていません"))).toBe(true);
  });

  it("id 重複はエラー（両方の行番号つき）", () => {
    const errs = errorsOf(`@quiz "t"

@choice
id: dup
question: 1問目？
- A *
- B

@choice
id: dup
question: 2問目？
- C *
- D`);
    const dup = errs.find((e) => e.message.includes("重複"));
    expect(dup).toBeTruthy();
    expect(dup.line).toBe(9);
    expect(dup.message).toContain("3行目");
  });

  it("choice の正解指定0件はエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@choice
id: q1
question: どれ？
- A
- B`);
    expect(msgs).toMatch(/正解の選択肢がありません/);
  });

  it("choice の正解指定が複数はエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@choice
id: q1
question: どれ？
- A *
- B *`);
    expect(msgs).toMatch(/1つだけにしてください/);
  });

  it("choice の選択肢不足はエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@choice
id: q1
question: どれ？
- A *`);
    expect(msgs).toMatch(/選択肢が少なすぎます/);
  });

  it("input の answer なしはエラー（仕様例の文言）", () => {
    const errs = errorsOf(`@quiz "t"

@choice
id: ok
question: ダミー？
- A *
- B

@input
id: bad
topic: 計算
question: 3 × 4 は？
explanation: 解説`);
    const target = errs.find((e) => e.message.startsWith("answer が指定されていません"));
    expect(target).toBeTruthy();
    expect(target.number).toBe(2);
    expect(target.id).toBe("bad");
  });

  it("order の items なしはエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@order
id: q1
question: 並べて
answer:
- 1
- 2`);
    expect(msgs).toMatch(/items が指定されていません/);
  });

  it("order の answer なしはエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@order
id: q1
question: 並べて
items:
- 1
- 2`);
    expect(msgs).toMatch(/answer が指定されていません/);
  });

  it("order の内容不一致はエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@order
id: q1
question: 並べて
items:
- 1
- 2
answer:
- 1
- 3`);
    expect(msgs).toMatch(/内容が一致しません/);
  });

  it("order の個数不一致はエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@order
id: q1
question: 並べて
items:
- 1
- 2
answer:
- 1`);
    expect(msgs).toMatch(/数が一致しません/);
  });

  it("不明な問題タイプはエラー", () => {
    const msgs = messagesOf(`@quiz "t"

@multi
id: q1
question: 選べ`);
    expect(msgs).toMatch(/不明な問題タイプ "@multi"/);
  });

  it("エラーには問題番号・ID・行番号が入る", () => {
    const errs = errorsOf(`@quiz "t"

@input
id: a1
question: 1+1は？
answer: 2

@input
id: b2
question: 2+2は？`);
    const target = errs.find((e) => e.message.startsWith("answer"));
    expect(target.number).toBe(2);
    expect(target.id).toBe("b2");
    expect(target.line).toBe(8);
  });
});
