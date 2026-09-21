---
status: active
read_when:
  - 村の描画が重い・入力が落ちるとき
  - 画像やスプライトの持ち方を変えるとき
  - 依存や書体の読み込み方を変えるとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 性能

このサイトで実際に問題になったのは**描画コストと転送量**の2つだけ。描画コストは村で、転送量は村のシートと全ページ共通の束・書体の CSS で起きた。

## 数百要素で共有する背景画像に SVG の data URI を使わない

村の舞台は数百マスあり、全マスが同じシートを共有する。SVG 画像はビットマップと違い
**描画のたびに要素ごとに SVG 文書のライフサイクル(style / layout / paint)が走る**ため、
1回の Paint の中に同じ処理が数百回並ぶ。舞台が再描画されるたびに主スレッドが止まり、その間のキー入力が落ちる。

**PNG に置き換える**(`image-rendering: pixelated`)。切り替えたときの実測値は
[ADR 0001](../decisions/0001-png-sprite-sheet.md) にある(この文書では再掲しない)。
村での使われ方は [../architecture/village.md](../architecture/village.md)。

## 焼くシートの枚数を増やさない

枚数の正本は `src/lib/pixel/sprites.ts`(地形・建物と主人公を時間帯の段階ぶんずつ + 天気の分)。
時間帯や天気を足すと枚数が掛け算で増える。足す前に「`data-phase` の切り替えだけで済ませられないか」を考える。

## 調べ方

「たまにキーが効かない」「言語で挙動が違う」は主スレッドの停止を疑う。

1. `PerformanceObserver('longtask')` と rAF の間隔で**停止の時刻**を取る
2. その時刻のトレース(`devtools.timeline`)で **Paint の中に何が何回あるか**を数える
3. JS プロファイルで `(program)` が支配的なら、JS ではなく描画側

E2E で入力を送る前は `document.fonts.ready` と rAF 2回を待つ(書体到着の再描画を跨がない)。

## 書体

Google Fonts から配信し、`unicode-range` で分割済み。**コンテンツに文字を足してもフォント側の作業は発生しない。**
Noto Sans の太さは `wght@400..700` の範囲で要求する(正本は `src/app/html-shell.tsx`)。可変フォントなので `400;500;700` と列挙しても届くファイルは同じで、描画を止める CSS だけが太さの数だけ膨らむ。

## 全ページ共通の束にサーバ用の依存を入れない

BudouX(`src/utils/ja-phrase.ts`)が import する linkedom(サーバ用の DOM 実装)は、`next.config.ts` の alias でブラウザ向けの束からだけ `src/utils/linkedom-browser-stub.ts` に差し替えている。
budoux の `browser` フィールドを Turbopack も webpack も当てないため、この差し替えを外すと linkedom 一式が全ルート共通の束に戻る。
