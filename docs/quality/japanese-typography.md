---
status: active
read_when:
  - 本文の折り返しが崩れたとき
  - 改行検査が落ちたとき
  - 本文に CSS の折り返し指定を足すとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 日本語の改行

CI は配信物の複数の画面幅で改行位置を実測する(`scripts/check-ja-linebreak.mjs`)。見ているのは4つ。

1. **適用値** — `word-break: keep-all` / `overflow-wrap: break-word` / `line-break: strict` が実際に効いているか。見た目の症状ではなく computed 値そのものを見る(特異度負けで一部だけ適用される事故を防ぐ)
2. **改行位置** — 切れ目が `<wbr>`(文節境界)・空白の直後・要素境界のいずれかか
3. **禁則** — 行頭に句読点・閉じ括弧・小書き仮名・長音符が来ていないか。行末に開き括弧が来ていないか
4. **孤立行** — 2行以上の段落の最終行が1〜2文字だけになっていないか(報告のみ)

## 仕組み

文節の分割は `src/utils/ja-phrase.ts`(BudouX)。表示側は `src/components/ui/PhraseText/` が文節の間に `<wbr>` を入れる。

## してはいけないこと

- **`overflow-wrap: anywhere` を使わない。** `break-word` と違って min-content 幅の計算にも任意改行が入るため、
  事実上すべての位置が改行候補になり、**前にある `<wbr>` を飛び越えて語中で切れる**。非常口は `break-word` に留める
- flex / grid のアイテムが min-content 未満に縮まず溢れるときは、`anywhere` ではなく **そのアイテムに `min-width: 0`** を与えるか、文字サイズの側を直す
- 改行まわりの CSS を変えたら「溢れが消えたか」ではなく、**行ごとの文字列を取り出して前後を比べる**

## 測るとき

ヘッドレス環境に日本語フォントが無いと、CJK が豆腐グリフへ落ちて幅を実際より狭く測る
(`fc-list :lang=ja | wc -l` が 0 なら測定値を信用しない)。CI は `fonts-noto-cjk` を入れてから走らせている。
サーバが上がりきる前に走らせると空の結果が返るので、`npx wait-on` を挟む。

`npm run build && npm run start` で配信してから `scripts/check-ja-linebreak.mjs` を走らせる。
引数のパス列は [../operations/deployment.md](../operations/deployment.md) の実行例(= `.github/workflows/deploy.yml`)を使う。
特定の画面だけ見たいときは、そのパスだけを渡して `--verbose` を足す。
