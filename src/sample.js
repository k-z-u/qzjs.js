export const SAMPLE_QUIZ = `@quiz "中学総合チェック 10問"

@choice
id: q1
topic: 比例
question: y = 3x のとき、x が 3倍になると y はどうなる？
- 3倍になる *
- 1/3 になる
- 変わらない
explanation: y = 3x は正比例なので、x が3倍になると y も3倍になります。

@choice
id: q2
topic: 反比例
question: x が 2倍になると y が半分になる関係は？
- 比例
- 反比例 *
- 一次方程式
explanation: x が2倍になると y が1/2になるのが反比例です。

@input
id: q3
topic: 計算
question: 3 × 4 は？
answer: 12
accept:
- １２
explanation: 3を4回足すと12になります。

@choice
id: q4
topic: 理科
question: 水の化学式は？
- H2O *
- CO2
- O2
explanation: 水は水素2つと酸素1つでできています。

@order
id: q5
topic: 数の大小
question: 小さい順に並べ替えよう
items:
- 10
- 2
- 7
answer:
- 2
- 7
- 10
explanation: 2 < 7 < 10 です。

@input
id: q6
topic: 英語
question: 「図書館」を表す英単語は？
answer: library
explanation: library が 図書館 という意味です。

@choice
id: q7
topic: 幾何
question: 一辺 5cm の正方形の面積は？
- 25cm2 *
- 20cm2
- 10cm2
explanation: 5 × 5 = 25 なので 25cm2 です。

@order
id: q8
topic: 英語
question: アルファベット順に並べ替えよう
items:
- grape
- apple
- lemon
answer:
- apple
- grape
- lemon
explanation: apple → grape → lemon の順になります。

@input
id: q9
topic: 理科
question: 太陽系でいちばん内側をまわる惑星は？
answer: 水星
explanation: 太陽にいちばん近い惑星は水星です。

@input
id: q10
topic: 割合
question: 100 の 25% はいくつ？
answer: 25
explanation: 100 × 0.25 = 25 です。
`;
