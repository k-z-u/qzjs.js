// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import QzJS from "../src/qzjs.js";

const VALID_SOURCE = `@quiz "ライブラリテスト"

@choice
id: c1
topic: 例題
question: 正しいのは？
- A
- B *
explanation: Bが正解です。
`;

const INVALID_SOURCE = `@quiz "壊れたクイズ"

@input
id: i1
question: 答えは？
`;

describe("QzJS ライブラリAPI", () => {
  let target;

  beforeEach(() => {
    document.body.replaceChildren();
    target = document.createElement("div");
    target.id = "quiz-root";
    document.body.append(target);
  });

  it("start → 回答 → getResult().toAIText()", () => {
    const app = new QzJS({ source: VALID_SOURCE, target: "#quiz-root" });
    const res = app.start();
    expect(res.ok).toBe(true);

    const radios = target.querySelectorAll('input[type="radio"]');
    radios[1].click(); // 正解「B」を選択
    [...target.querySelectorAll("button")].find((b) => b.textContent === "回答する").click();
    [...target.querySelectorAll("button")].find((b) => b.textContent === "結果を見る").click();

    const result = app.getResult();
    expect(result).not.toBeNull();
    expect(result.total).toBe(1);
    expect(result.correct).toBe(1);
    expect(typeof result.toAIText()).toBe("string");
    expect(result.toAIText()).toContain("--- qzjs.js RESULT v1 ---");
  });

  it("reset で最初の問題に戻る", () => {
    const app = new QzJS({ source: VALID_SOURCE, target });
    app.start();
    expect(app.reset()).toBe(true);
    expect(target.querySelector(".quiz-counter").textContent).toBe("1 / 1");
    expect(app.getResult()).toBeNull();
  });

  it("構文エラー時はクラッシュせず errors を返す", () => {
    const app = new QzJS({ source: INVALID_SOURCE, target });
    const res = app.start();
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(app.getErrors().length).toBe(res.errors.length);
    expect(app.getResult()).toBeNull();
    expect(target.textContent).toBe("");
  });

  it("QzJS.parse で静的に解析できる", () => {
    const parsed = QzJS.parse(VALID_SOURCE);
    expect(parsed.ok).toBe(true);
    expect(parsed.quiz.questions).toHaveLength(1);
  });
});
