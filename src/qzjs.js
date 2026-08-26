import { parseQuiz } from "./core/parser.js";
import { Renderer } from "./ui/renderer.js";

export default class QzJS {
  constructor(options = {}) {
    this.source = options.source ?? "";
    this.target =
      typeof options.target === "string"
        ? document.querySelector(options.target)
        : options.target ?? null;
    this.onFinish = options.onFinish ?? null;
    this.onExit = options.onExit ?? null;
    this.onError = options.onError ?? null;
    this.quiz = null;
    this.result = null;
    this.lastErrors = [];
    this.renderer = this.target
      ? new Renderer(this.target, {
          onFinish: (result) => {
            this.result = result;
            this.onFinish?.(result);
          },
          onExit: () => this.onExit?.(),
        })
      : null;
  }

  static parse(source) {
    return parseQuiz(source);
  }

  start() {
    this.result = null;
    this.lastErrors = [];
    const parsed = parseQuiz(this.source);
    if (!parsed.ok) {
      this.lastErrors = parsed.errors;
      this.onError?.(parsed.errors);
      this.renderer?.clear();
      return { ok: false, errors: parsed.errors };
    }
    this.quiz = parsed.quiz;
    this.renderer?.startQuiz(this.quiz);
    return { ok: true, quiz: this.quiz };
  }

  reset() {
    if (!this.quiz || !this.renderer) return false;
    this.result = null;
    this.renderer.startQuiz(this.quiz);
    return true;
  }

  getResult() {
    return this.result;
  }

  getErrors() {
    return this.lastErrors;
  }
}

export { QzJS, parseQuiz };
