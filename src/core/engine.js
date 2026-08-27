import { gradeChoice } from "../questions/choice.js";
import { gradeInput } from "../questions/input.js";
import { gradeOrder } from "../questions/order.js";
import { gradeMatch } from "../questions/match.js";
import { gradeGroup } from "../questions/group.js";
import { gradeCloze } from "../questions/cloze.js";
import { gradeNumeric } from "../questions/numeric.js";
import { gradeHotspot } from "../questions/hotspot.js";

const GRADERS = {
  choice: gradeChoice,
  input: gradeInput,
  order: gradeOrder,
  match: gradeMatch,
  group: gradeGroup,
  cloze: gradeCloze,
  numeric: gradeNumeric,
  hotspot: gradeHotspot,
};

export class Engine {
  constructor(quiz) {
    this.quiz = quiz;
    this.records = [];
    this.index = 0;
    this._currentAnswered = false;
  }

  get total() {
    return this.quiz.questions.length;
  }

  get current() {
    return this.quiz.questions[this.index] ?? null;
  }

  get answeredCount() {
    return this.records.length;
  }

  get finished() {
    return this.index >= this.total;
  }

  submitCurrent(payload) {
    const q = this.current;
    if (!q) throw new Error("現在の問題がありません");
    if (this._currentAnswered) throw new Error("この問題にはすでに回答済みです");

    const grader = GRADERS[q.type];
    if (!grader) throw new Error(`未対応の問題タイプ: ${q.type}`);
    const outcome = grader(q, payload ?? {});
    this._currentAnswered = true;

    const record = {
      number: this.index + 1,
      id: q.id,
      type: q.type,
      topic: q.topic,
      question: q.question,
      explanation: q.explanation,
      userAnswer: outcome.userAnswer,
      correctAnswer: outcome.correctAnswer,
      correct: outcome.correct,
    };
    this.records.push(record);
    return outcome;
  }

  next() {
    if (!this._currentAnswered || this.finished) return false;
    this.index += 1;
    this._currentAnswered = false;
    return true;
  }
}
