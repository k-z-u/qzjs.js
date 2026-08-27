import { Engine } from "../core/engine.js";
import { buildResult } from "../core/result.js";
import {
  buildChoiceWidget,
  buildInputWidget,
  buildOrderWidget,
  buildMatchWidget,
  buildGroupWidget,
  buildClozeWidget,
  buildNumericWidget,
  buildHotspotWidget,
  button,
  copyToClipboard,
  el,
  progressBar,
  showToast,
} from "./components.js";
import { renderClozeQuestion } from "../questions/cloze.js";

function answerRow(label, value) {
  return el("div", {
    className: "fb-row",
    children: [
      el("span", { className: "fb-label", text: label }),
      el("span", { className: "fb-value", text: value }),
    ],
  });
}

function praiseFor(accuracy) {
  if (accuracy >= 100) return "全問正解！完璧です。";
  if (accuracy >= 80) return "よくできました！";
  if (accuracy >= 60) return "いい感じ。あと少し！";
  if (accuracy >= 40) return "まずまず。間違いを復習しましょう。";
  return "間違えた問題から復習してみましょう。";
}

export class Renderer {
  constructor(root, { onFinish, onExit } = {}) {
    this.root = root;
    this.onFinish = onFinish;
    this.onExit = onExit;
    this.engine = null;
  }

  clear() {
    this.root.replaceChildren();
  }

  startQuiz(quiz) {
    this.engine = new Engine(quiz);
    this.renderQuestion();
  }

  renderQuestion() {
    const eng = this.engine;
    const q = eng.current;
    const n = eng.index + 1;
    const total = eng.total;
    this.clear();

    const screen = el("section", { className: "quiz-screen" });

    const header = el("header", {
      className: "quiz-header",
      children: [
        el("p", { className: "quiz-title", text: eng.quiz.title || "(無題のクイズ)" }),
        el("p", { className: "quiz-counter", text: `${n} / ${total}` }),
        progressBar(eng.answeredCount, total, `進捗 ${eng.answeredCount} / ${total} 問回答済み`),
      ],
    });

    const card = el("article", { className: "card question-card" });
    const metaChildren = [el("span", { className: "qnum", text: `Q${n}` })];
    if (q.topic) metaChildren.push(el("span", { className: "chip", text: q.topic }));
    // タイプバッジ
    const typeLabel = { match: "組み合わせ", group: "分類", cloze: "穴埋め", numeric: "数値", hotspot: "画像" }[q.type];
    if (typeLabel) metaChildren.push(el("span", { className: "chip chip--type", text: typeLabel }));
    card.append(
      el("div", { className: "question-meta", children: metaChildren }),
      el("h2", {
        className: "question-heading",
        text: q.type === "cloze" ? renderClozeQuestion(q.question) : q.question,
        attrs: { tabindex: "-1" },
      }),
    );

    let widget;
    if (q.type === "choice") widget = buildChoiceWidget(q);
    else if (q.type === "input") widget = buildInputWidget();
    else if (q.type === "order") widget = buildOrderWidget(q);
    else if (q.type === "match") widget = buildMatchWidget(q);
    else if (q.type === "group") widget = buildGroupWidget(q);
    else if (q.type === "cloze") widget = buildClozeWidget(q);
    else if (q.type === "numeric") widget = buildNumericWidget(q);
    else if (q.type === "hotspot") widget = buildHotspotWidget(q);
    else widget = buildInputWidget();
    card.append(widget.root);

    const feedback = el("div", {
      className: "feedback-slot",
      attrs: { role: "status", "aria-live": "polite" },
    });

    const submit = button("回答する", {
      variant: "primary",
      attrs: widget.ready() ? {} : { disabled: true },
    });
    const actions = el("div", { className: "quiz-actions", children: [submit] });

    const handleSubmit = () => {
      if (!widget.ready() || submit.disabled) return;
      const outcome = eng.submitCurrent(widget.getPayload());
      widget.lock();
      actions.replaceChildren();
      submit.disabled = true;
      this.showFeedback(feedback, outcome, q, n, total);
    };
    submit.addEventListener("click", handleSubmit);
    widget.onChange(() => {
      submit.disabled = !widget.ready();
    });
    if (widget.onEnter) {
      widget.onEnter(() => {
        if (widget.ready()) handleSubmit();
      });
    }

    screen.append(header, card, actions, feedback);
    this.root.append(screen);

    if (widget.focus) widget.focus();
  }

  showFeedback(container, outcome, q, n, total) {
    container.replaceChildren();
    const ok = outcome.correct;

    const box = el("div", {
      className: `feedback ${ok ? "feedback--ok" : "feedback--ng"}`,
    });
    const verdict = el("p", {
      className: `verdict ${ok ? "verdict--ok" : "verdict--ng"}`,
      text: ok ? "正解！" : "不正解",
      attrs: { tabindex: "-1" },
    });
    box.append(verdict);

    if (!ok) {
      box.append(answerRow("あなたの回答", outcome.userAnswer));
      box.append(answerRow("正解", outcome.correctAnswer));
    }

    if (q.explanation) {
      box.append(
        el("div", {
          className: "explanation",
          children: [
            el("p", { className: "explanation__label", text: "解説" }),
            el("p", { className: "explanation__body", text: q.explanation }),
          ],
        }),
      );
    }

    const isLast = n >= total;
    const nextBtn = button(isLast ? "結果を見る" : "次の問題", {
      variant: "primary",
      onClick: () => {
        this.engine.next();
        if (this.engine.finished) this.renderResult();
        else this.renderQuestion();
      },
    });
    box.append(el("div", { className: "quiz-actions quiz-actions--row", children: [nextBtn] }));

    container.append(box);
    verdict.focus();
  }

  renderResult() {
    const eng = this.engine;
    const result = buildResult(eng.quiz.title, eng.records);
    this.onFinish?.(result);
    this.clear();

    const screen = el("section", { className: "result-screen" });
    const heading = el("h2", { className: "result-heading", text: "結果", attrs: { tabindex: "-1" } });

    const scoreCard = el("div", {
      className: "card result-card",
      children: [
        el("p", { className: "result-score", text: `${result.correct} / ${result.total} 問正解` }),
        el("p", { className: "result-accuracy", text: `${result.accuracy}%` }),
        el("p", { className: "result-message", text: praiseFor(result.accuracy) }),
        progressBar(result.correct, result.total, `全体スコア ${result.correct} / ${result.total}`),
      ],
    });

    const topicCard = el("section", {
      className: "card topic-card",
      children: [el("h3", { className: "section-title", text: "分野別" })],
    });
    const topicEntries = Object.entries(result.topicResults);
    if (topicEntries.length === 0) {
      topicCard.append(el("p", { className: "muted", text: "分野情報はありません。" }));
    }
    for (const [name, stat] of topicEntries) {
      const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      const badges = [];
      if (stat.total >= 1 && pct < 60) {
        badges.push(el("span", { className: "badge badge--weak", text: "要復習" }));
      }
      if (pct === 100) {
        badges.push(el("span", { className: "badge badge--perfect", text: "満点" }));
      }
      topicCard.append(
        el("div", {
          className: "topic-row",
          children: [
            el("span", { className: "topic-name", text: name }),
            progressBar(stat.correct, stat.total, `${name} ${stat.correct} / ${stat.total}`),
            el("span", { className: "topic-score", text: `${stat.correct} / ${stat.total}` }),
            ...(badges.length > 0
              ? [el("span", { className: "topic-badges", children: badges })]
              : []),
          ],
        }),
      );
    }

    const wrongCard = el("section", {
      className: "card wrong-card",
      children: [el("h3", { className: "section-title", text: "間違えた問題" })],
    });
    if (result.incorrectQuestions.length === 0) {
      wrongCard.append(
        el("p", { className: "muted", text: "間違えた問題はありません。全問正解です。" }),
      );
    } else {
      for (const w of result.incorrectQuestions) {
        const item = el("article", { className: "wrong-item" });
        item.append(el("p", { className: "wrong-qnum", text: `Q${w.number}` }));
        item.append(el("p", { className: "wrong-question", text: w.question }));
        item.append(answerRow("あなたの回答", w.userAnswer));
        item.append(answerRow("正解", w.correctAnswer));
        if (w.explanation) {
          item.append(
            el("div", {
              className: "explanation",
              children: [
                el("p", { className: "explanation__label", text: "解説" }),
                el("p", { className: "explanation__body", text: w.explanation }),
              ],
            }),
          );
        }
        wrongCard.append(item);
      }
    }

    const aiCard = el("section", {
      className: "card ai-card",
      children: [
        el("h3", { className: "section-title", text: "AIに結果を渡す" }),
        el("p", {
          className: "muted ai-desc",
          text:
            "この結果をChatGPTなどのAIに貼ると、間違えたところの解説や次の問題を作ってもらえます。",
        }),
      ],
    });
    const aiOutput = el("textarea", {
      className: "ai-output",
      attrs: { readonly: "", rows: "12", "aria-label": "AI用の結果テキスト" },
    });
    aiOutput.value = result.toAIText();
    const copyBtn = button("AI用結果をコピー", {
      variant: "primary",
      onClick: async () => {
        const okCopy = await copyToClipboard(aiOutput.value);
        showToast(okCopy ? "コピーしました" : "コピーできませんでした");
      },
    });
    aiCard.append(aiOutput, el("div", { className: "quiz-actions", children: [copyBtn] }));

    const retryBtn = button("もう一度挑戦", {
      variant: "ghost",
      onClick: () => this.startQuiz(eng.quiz),
    });
    const exitBtn = button("ホームに戻る", {
      variant: "ghost",
      onClick: () => this.onExit?.(),
    });

    screen.append(
      heading,
      scoreCard,
      topicCard,
      wrongCard,
      aiCard,
      el("div", { className: "quiz-actions quiz-actions--row", children: [retryBtn, exitBtn] }),
    );
    this.root.append(screen);
    heading.focus();
  }
}
