# qzjs.js

AIが専用構文で生成したクイズを、**貼り付けるだけでブラウザ上で実行できる**インタラクティブ学習クイズエンジンです。

> AIが作ったクイズを貼るだけ。

`AI → qzjs.js → 学習 → 結果 → AI → 次の問題` という学習ループの入口になることを目指しています。

## Demo

GitHub Pages で公開されています。

**Demo URL: （初回デプロイ後に記載）**

## Features

- 専用構文（`@choice` / `@input` / `@order`）を貼るだけでクイズが動く
- 1問ずつ表示・即時採点・解説表示
- 分野別（topic別）の正答集計と苦手分野の可視化
- 間違えた問題の復習リスト
- **AI用結果出力**（`result.toAIText()`）。コピーしてAIに貼ると解説と次の問題を作ってもらえる
- 完全静的。サーバー不要、入力はブラウザ内（localStorage）のみ
- XSS安全設計：ユーザー入力は `textContent` 経由でのみ描画され、HTML/JSとして評価されない
- ダークモード対応 / レスポンシブ / キーボード操作・aria-live等のアクセシビリティ対応

## Quick Start

```bash
git clone https://github.com/k-z-u/qzjs.js.git
cd qzjs.js
npm install
npm run dev
```

ブラウザで表示されたURLを開き、テキストエリアに下記の構文を貼り付けて「クイズを開始」。

```text
@quiz "比例と反比例"

@choice
id: q1
topic: 反比例
question: xが2倍になると、yが半分になる関係は？
- 比例
- 反比例 *
- 一次方程式
explanation: xが2倍になるとyが1/2になるのが反比例です。
```

## qzjs Syntax

1行目に `@quiz "タイトル"`、その後に問題ブロックを並べます。`#` で始まる行はコメントとして無視されます。

### @choice

選択肢の末尾に `*` を付けたものが正解です（画面には表示されません）。正解はちょうど1つ指定してください。選択肢は2つ以上必要です。

```text
@choice
id: q1
topic: 反比例
question: xが2倍になると、yが半分になる関係は？
- 比例
- 反比例 *
- 一次方程式
explanation: xが2倍になるとyが1/2になるのが反比例です。
```

### @input

自由記述式。`answer:` のほかに `accept:` で複数の正解表現を許容できます。前後の空白は無視、英字の大文字小文字は区別しません。全角数字・英字も半角として比較します。

```text
@input
id: q2
topic: 計算
question: 3 × 4 は？
answer: 12
accept:
- １２
explanation: 3を4回足すと12です。
```

### @order

並べ替え問題。`items:` に出題順、`answer:` に正解順を書きます。`answer` は `items` と同じ要素の並べ替えである必要があります。UIはドラッグに依存せず「上へ／下へ」ボタンでも操作できます。

```text
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
```

### エラー表示

構文に問題がある場合はアプリがクラッシュせず、問題番号・ID・行番号付きで日本語のエラーが表示されます。

```text
3問目 (q3): answer が指定されていません。例: answer: 12（8行目）
```

## JavaScript API

ライブラリとしても利用できます。入口は必ず `src/qzjs.js` です。

```js
import QzJS from "./qzjs.js";

const quiz = new QzJS({
  source: quizText,   // qzjs構文の文字列
  target: "#quiz",    // 描画先の要素またはセレクタ
});

quiz.start();               // { ok, quiz } | { ok: false, errors }
quiz.reset();               // 同じクイズを最初から
quiz.getResult();           // 終了後: 結果オブジェクト（未終了: null）
quiz.getResult().toAIText(); // AI貼り付け用テキスト
```

結果オブジェクトの構造：

```js
{
  quizTitle: "比例と反比例",
  total: 10,
  correct: 8,
  incorrect: 2,
  accuracy: 80,
  topicResults: { "比例": { total: 3, correct: 3 }, "反比例": { total: 4, correct: 2 } },
  answers: [ /* 各問の記録 */ ],
  incorrectQuestions: [ /* 間違えた問題の詳細 */ ],
  correctQuestionIds: ["q1", "q2", /* ... */],
}
```

## AI Result Format

結果画面の「AI用結果をコピー」で、次の形式がクリップボードにコピーされます。

```text
--- qzjs.js RESULT v1 ---

Quiz: 比例と反比例
Score: 8/10
Accuracy: 80%

TopicResults:
- 比例: 3/3
- 反比例: 2/4

IncorrectQuestions:

[Q3]
ID: q3
Topic: 反比例
Question: xが2倍になると、yが半分になる関係は？
UserAnswer: 比例
CorrectAnswer: 反比例
Explanation: xが2倍になるとyが1/2になるのが反比例です。

CorrectQuestionIDs:
q1, q2, q4, ...

Please analyze my mistakes.
Explain what I misunderstood.
Then create a new qzjs.js quiz focused on my weak areas.

--- END qzjs.js RESULT ---
```

これをChatGPTなどに貼ると、弱点分析と次のqzjs.jsクイズを生成させられます。

## Development

```bash
npm install     # 依存関係のインストール
npm run dev     # 開発サーバー
npm test        # Vitestによるユニット/E2Eテスト
npm run build   # dist/ へプロダクションビルド
npm run preview # ビルド結果のローカル確認
```

構成：

```text
src/
├── qzjs.js          # ライブラリ公開API
├── main.js          # Webアプリ起動
├── sample.js        # サンプルクイズ
├── core/
│   ├── parser.js    # 構文パーサ
│   ├── validator.js # エラー整形・バリデーション補助
│   ├── engine.js    # 1問ずつの進行・採点状態管理
│   └── result.js    # 結果集計と toAIText()
├── questions/
│   ├── choice.js
│   ├── input.js
│   └── order.js
└── ui/
    ├── renderer.js  # 画面レンダリング
    └── components.js
```

## Deployment

`main` ブランチへのpushで GitHub Actions（`.github/workflows/deploy.yml`）がテスト→ビルド→GitHub Pagesへデプロイします。Pagesは **GitHub Actions方式** で公開されており、Viteの `base: "/qzjs.js/"` によりアセットが正しいパスで読み込まれます。

## License

[MIT](./LICENSE)
