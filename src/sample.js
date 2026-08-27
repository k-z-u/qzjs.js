export const SAMPLE_QUIZ = `@quiz "中学総合チェック 14問 - 全タイプ"

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

@match
id: q7
topic: アメリカの気候
question: 地域と気候を組み合わせよう
pairs:
- 五大湖周辺 => 冷帯
- フロリダ南部 => 亜熱帯
- ロッキー山脈 => 高山帯
- 西部内陸 => 乾燥帯
explanation: 地形と位置から気候を対応させます。

@group
id: q8
topic: アメリカの気候
question: 気候区分ごとに分類しよう
groups:
- 東部:
  - 冷帯
  - 温暖湿潤
  - 亜熱帯
- 西部:
  - ステップ
  - 地中海性
  - 西岸海洋性
explanation: 東部は湿潤、西部は乾燥や地中海性が分布します。

@cloze
id: q9
topic: アメリカの気候
question: アメリカ東部は北から {冷帯|れいたい} → {温帯|おんたい} → {亜熱帯|あねったい} となる。
explanation: 北ほど寒く、南ほど暖かくなります。

@numeric
id: q10
topic: 理科
question: 質量54g、体積20cm³の物質の密度は？
answer: 2.7
unit: g/cm³
tolerance: 0.01
explanation: 54÷20=2.7 g/cm³ です。単位は省略可、違う単位は不正解になります。

@choice
id: q11
topic: 幾何
question: 一辺 5cm の正方形の面積は？
- 25cm2 *
- 20cm2
- 10cm2
explanation: 5 × 5 = 25 なので 25cm2 です。

@order
id: q12
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
id: q13
topic: 理科
question: 太陽系でいちばん内側をまわる惑星は？
answer: 水星
yomi: すいせい
explanation: 太陽にいちばん近い惑星は水星です。yomi で「すいせい」も正解になります。

@numeric
id: q14
topic: 割合
question: 100 の 25% はいくつ？
answer: 25
tolerance: 0
explanation: 100 × 0.25 = 25 です。
`;
