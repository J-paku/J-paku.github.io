---
status: active
read_when:
  - 既存の設計を置き換えようとするとき
  - なぜこの作りなのかを問われたとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# decisions/(ADR)

**過去の判断の記録。現在の姿の説明には使わない**(それは [../architecture/](../architecture/README.md))。
通常の機能追加では読まなくてよい。

| # | 決めたこと | 状態 |
|---|---|---|
| [0001](0001-png-sprite-sheet.md) | スプライトを SVG の data URI から PNG シートへ切り替える | Accepted |
| [0002](0002-locale-from-url-only.md) | locale を URL パスだけで決める | Accepted |
| [0003](0003-content-outside-src.md) | 表示文字列を `content/` に集め、ja/ko を同一の型で縛る | Accepted |
| [0004](0004-lint-enforced-layer-boundaries.md) | レイヤー境界を ESLint で機械的に守らせる | Accepted |
| [0005](0005-runtime-weather-fetch.md) | 村の天気だけ実行時に外部 API を呼ぶ | Accepted |
| [0006](0006-jst-fixed-day-phase.md) | 昼夜の判定を JST 固定にする | Accepted |

## 書くときの決まり

- **リポジトリ内に根拠があるものだけを書く。** コードやコミットから「たぶんこういう理由だろう」と想像して ADR を作らない
- 各 ADR は `Status` / `Context` / `Decision` / `Consequences` / `Alternatives Considered` を持つ
- 判断が覆ったら、元の ADR を消さずに `Status` を `Superseded by ####` に変え、新しい番号で書く

## 記録が無いもの

- **Vite + react-router から Next.js App Router 静的エクスポートへの移行**(2026-09-18、`8bccf34`)。
  そのコミットには本文が無く、取り込んだ Pull Request #1 の併合コミットの本文も PR の題名1行だけで、**理由を書いた一次資料がリポジトリ内に無い**ため ADR にしていない。
  同じ併合でトップが一覧から村へ替わっているので、移行はその改編の一部として進んだと見えるが、これは記録ではなく推測である。
  現在の構成そのものは [../architecture/overview.md](../architecture/overview.md) にある
