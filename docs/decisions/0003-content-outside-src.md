---
status: historical
read_when:
  - 表示文字列の置き場所を変えようとするとき
  - ja/ko の型を分けたくなったとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 0003. 表示文字列を `content/` に集め、ja/ko を同一の型で縛る

## Status

Accepted(不変ルール2。型は `content/types/`、読み込みは `src/lib/content/read.ts`)

## Context

二言語のサイトで、翻訳の抜けは**画面を開くまで気付けない**類の欠陥になる。
また ja と ko の対称が崩れると、ko だけ古い文面が残るといった形で静かに劣化する。

## Decision

- 表示文字列をすべて `content/`(`ja` / `ko`)へ置き、コンポーネントへハードコードしない
- **型の定義元を `content/types/` に置く**(データ側が型を持ち、`src/` はそれを参照する)
- `ko` は `ja` と同じ型を満たす。キーの過不足は `tsc --noEmit` が落とす
- ko の欠けを ja で黙って埋めない。ビルドを失敗させる
- 作品はバレルや glob で集めず、`read.ts` の登録表に明示 import で並べ、実ファイルと突き合わせる

## Consequences

- 翻訳漏れが型エラーとして出る。実行時の言語フォールバックは持たない
- `content/` は `src/` を import しないデータ層になり、ja/ko の対称を目で確認できる
- 作品を足すときは**ファイル追加 + 登録表に2行**という手順が固定される(漏れはビルドが落とす)
- 文言を1つ足すだけでも両言語を触ることになる

## Alternatives Considered

- **JSON の翻訳ファイル + キー参照** — 型が効かず、キーの綴り違いが実行時まで残る
- **ko を optional にして ja へフォールバック** — 抜けが表に出ないまま配信されるため採らない
