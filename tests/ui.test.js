// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { Renderer } from "../src/ui/renderer.js";

const QUIZ = {
  title: "テストクイズ",
  questions: [
    {
      id: "q1",
      type: "choice",
      topic: "たしざん",
      question: "1+1は？",
      options: ["1", "2", "3"],
      correctIndex: 1,
      explanation: "解説1です。",
    },
    {
      id: "q2",
      type: "input",
      topic: "計算",
      question: "2+2は？",
      answers: ["4"],
      explanation: "解説2です。",
    },
    {
      id: "q3",
      type: "order",
      topic: "数の大小",
      question: "小さい順に並べ替え",
      items: ["b", "a", "c"],
      correctOrder: ["a", "b", "c"],
      explanation: "解説3です。",
    },
  ],
};

function findButton(rootEl, label) {
  return [...rootEl.querySelectorAll("button")].find((b) => b.textContent === label);
}

describe("Renderer E2E（jsdom）", () => {
  let root;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement("div");
    document.body.append(root);
  });

  it("トップから結果・AI出力・コピーまで一通り動く", async () => {
    const onExit = vi.fn();
    const onFinish = vi.fn();
    const renderer = new Renderer(root, { onFinish, onExit });

    renderer.startQuiz(QUIZ);

    // Q1: choice
    expect(root.querySelector(".quiz-counter").textContent).toBe("1 / 3");
    const radios = [...root.querySelectorAll('input[type="radio"]')];
    expect(radios).toHaveLength(3);
    const submitQ1 = findButton(root, "回答する");
    expect(submitQ1.disabled).toBe(true);
    radios[1].click();
    expect(submitQ1.disabled).toBe(false);
    submitQ1.click();

    const verdict1 = root.querySelector(".verdict");
    expect(verdict1.textContent).toBe("正解！");
    expect(root.textContent).toContain("解説1です。");
    expect(radios.every((r) => r.disabled)).toBe(true);

    // Q2: input（わざと間違える）
    findButton(root, "次の問題").click();
    expect(root.querySelector(".quiz-counter").textContent).toBe("2 / 3");
    const textInput = root.querySelector(".text-input");
    const submitQ2 = findButton(root, "回答する");
    expect(submitQ2.disabled).toBe(true);
    textInput.value = "5";
    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(submitQ2.disabled).toBe(false);
    submitQ2.click();

    const verdict2 = root.querySelector(".verdict");
    expect(verdict2.textContent).toBe("不正解");
    const values = [...root.querySelectorAll(".fb-value")].map((el) => el.textContent);
    expect(values).toContain("5");
    expect(values).toContain("4");
    expect(findButton(root, "回答する")).toBeUndefined();

    // Q3: order（下へボタンで入れ替えて正解にする）
    findButton(root, "次の問題").click();
    expect(root.querySelector(".quiz-counter").textContent).toBe("3 / 3");
    const rows = () => [...root.querySelectorAll(".order-row .order-item-text")].map((el) => el.textContent);
    expect(rows()).toEqual(["b", "a", "c"]);
    const firstRowButtons = root.querySelectorAll(".order-row")[0].querySelectorAll("button");
    expect(firstRowButtons[0].disabled).toBe(true); // 上へは先頭で無効
    firstRowButtons[1].click(); // 下へ
    expect(rows()).toEqual(["a", "b", "c"]);
    findButton(root, "回答する").click();
    expect(root.querySelector(".verdict").textContent).toBe("正解！");

    // 結果画面
    findButton(root, "結果を見る").click();
    expect(onFinish).toHaveBeenCalledTimes(1);
    const result = onFinish.mock.calls[0][0];
    expect(result.total).toBe(3);
    expect(result.correct).toBe(2);
    expect(result.accuracy).toBe(67);

    expect(root.textContent).toContain("2 / 3 問正解");
    expect(root.textContent).toContain("67%");
    expect(root.textContent).toContain("分野別");
    expect(root.textContent).toContain("要復習");
    expect(root.textContent).toContain("間違えた問題");
    expect(root.textContent).toContain("2+2は？");

    // AI出力とコピー
    const aiOutput = root.querySelector(".ai-output");
    expect(aiOutput.value).toContain("--- qzjs.js RESULT v1 ---");
    expect(aiOutput.value).toContain("[Q2]");
    expect(aiOutput.value).toContain("--- END qzjs.js RESULT ---");

    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn(async () => {}) },
      configurable: true,
    });
    findButton(root, "AI用結果をコピー").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(aiOutput.value);
    expect(document.getElementById("toast-region").textContent).toContain("コピーしました");

    // ホームへ戻る
    findButton(root, "ホームに戻る").click();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("もう一度挑戦で最初の問題に戻る", () => {
    const renderer = new Renderer(root, {});
    renderer.startQuiz(QUIZ);

    // Q1
    [...root.querySelectorAll('input[type="radio"]')][0].click();
    findButton(root, "回答する").click();
    findButton(root, "次の問題").click();

    // Q2
    const textInput = root.querySelector(".text-input");
    textInput.value = "4";
    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    findButton(root, "回答する").click();
    findButton(root, "次の問題").click();

    // Q3
    root.querySelectorAll(".order-row")[0].querySelectorAll("button")[1].click();
    findButton(root, "回答する").click();

    // 結果画面からリトライ
    findButton(root, "結果を見る").click();
    findButton(root, "もう一度挑戦").click();
    expect(root.querySelector(".quiz-counter").textContent).toBe("1 / 3");
    expect(findButton(root, "回答する")).toBeTruthy();
  });

  it("ユーザー入力をHTMLとして挿入しない（XSS対策）", () => {
    const hostile = {
      title: "XSS",
      questions: [
        {
          id: "x1",
          type: "choice",
          topic: "",
          question: '<img src=x onerror="window.__pwned=1">',
          options: ["<script>window.__pwned=1</script>", "安全"],
          correctIndex: 1,
          explanation: "<b>太字</b>ではなく文字列",
        },
      ],
    };
    const renderer = new Renderer(root, {});
    renderer.startQuiz(hostile);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector(".question-heading").textContent).toBe(
      '<img src=x onerror="window.__pwned=1">',
    );
  });
});
