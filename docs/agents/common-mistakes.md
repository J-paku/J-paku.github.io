---
status: active
read_when:
  - 実装に入る直前
  - 同じ場所を2度直しているとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# このリポジトリでよくある間違い

**一般論ではなく、ここで実際に起きたものだけ。**
症状と行き先だけを並べる。**規則の本文はそれぞれの正本にあり、ここには書かない。**

## コンテンツ

| やりがちなこと | 正本 |
|---|---|
| ja だけ直して ko を忘れる | [../architecture/data-flow.md](../architecture/data-flow.md) |
| 地点を `content/world.ts` に足して文言を足さない(逆も) | [../product/business-rules.md](../product/business-rules.md) |
| 作品ファイルを足して `read.ts` の登録表に入れ忘れる | [../../content/AGENTS.md](../../content/AGENTS.md) |
| コース外の地点に `order` を付けてしまう | [../product/business-rules.md](../product/business-rules.md) |
| 表示文字列をコンポーネントに直接書く | [../../AGENTS.md](../../AGENTS.md) 不変ルール2 |

## 構成

| やりがちなこと | 正本 |
|---|---|
| バレル(`index.ts` の再 export)を作る。フックのフォルダにも作る | [../architecture/boundaries.md](../architecture/boundaries.md) |
| `src/utils/` に I/O を置く / `src/lib/` に純粋関数を置く | [../architecture/data-flow.md](../architecture/data-flow.md) |
| 下の層の型を上の層から再 export する | [../architecture/boundaries.md](../architecture/boundaries.md) |
| `'use client'` を必要より上に置く | [../architecture/boundaries.md](../architecture/boundaries.md) |
| `read.ts` をクライアントから読む(`server-only` が落とす) | [../architecture/data-flow.md](../architecture/data-flow.md) |

## スタイル

| やりがちなこと | 正本 |
|---|---|
| 色リテラルを書く / ダーク側の再定義を忘れる | [../architecture/frontend.md](../architecture/frontend.md) |
| `overflow-wrap: anywhere` で溢れを止める | [../quality/japanese-typography.md](../quality/japanese-typography.md) |
| ベンダープレフィックスを手で書く | [../development/debugging.md](../development/debugging.md) |

## 絵と性能

| やりがちなこと | 正本 |
|---|---|
| 数百マスが共有する背景に SVG の data URI を使う | [../decisions/0001-png-sprite-sheet.md](../decisions/0001-png-sprite-sheet.md) |
| 時間帯や天気を足してシートの枚数を増やす | [../quality/performance.md](../quality/performance.md) |
| 天気の色が時間帯で変わらないのをバグだと思う | [../../src/lib/pixel/AGENTS.md](../../src/lib/pixel/AGENTS.md) |

## 検証

| やりがちなこと | 正本 |
|---|---|
| `npm run build` せずに E2E を走らせて古い `out/` を測る | [../development/setup.md](../development/setup.md) |
| dev サーバの画面で受け入れを判断する(WSL で古いバンドル) | [../development/setup.md](../development/setup.md) |
| 書いた検査を一度も落とさずに採用する | [../quality/test-strategy.md](../quality/test-strategy.md) |
| PASS を無条件に信じる(対象 URL・件数を数えない) | [../development/debugging.md](../development/debugging.md) |
| ルートを消して検査スクリプトの引数から消し忘れる | [../quality/accessibility.md](../quality/accessibility.md) |
| ヘッドレスに日本語フォントが無いまま文字幅を測る | [../development/setup.md](../development/setup.md) |
| 他のエージェントの「直した」を実物確認なしで信じる | [verification.md](verification.md) |

## 報告

| やりがちなこと | 正本 |
|---|---|
| ローカルの PASS だけで「完了」と書く | [verification.md](verification.md) |
| 「動作変更なし」を根拠なしで書く | [workflow.md](workflow.md) |
| 依頼と関係ない改善を diff に混ぜる | [../development/coding-guidelines.md](../development/coding-guidelines.md) |
