---
status: historical
read_when:
  - レイヤーの規則を変えようとするとき
  - no-restricted-imports に落とされて回避したくなったとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 0004. レイヤー境界を ESLint で機械的に守らせる

## Status

Accepted(`eslint.config.mjs`。Next.js 移行と同じコミット `23d8f33` で導入)

## Context

「`utils` は純粋関数だけ」「`content` を読むのは `lib/content` だけ」といった約束は、
文書に書いただけでは**破られたことに気付けない**。特に `src/utils/` に I/O が混ざると、
以後「どこを見れば外部との通信が分かるか」という不変条件が崩れ、レビューが全件確認になる。

## Decision

`no-restricted-imports` をレイヤーごとに設定し、逆方向の import を **lint エラーで落とす**。

- 許可する向きは `utils ← lib ← hooks ← components ← app` の一方向
- `content/` の実データを読めるのは `src/lib/content/` だけ。型(`content/types/`)は全レイヤーから可
- `content/` は `src/` を import しない
- バレル(`from '.'` / `from '..'`)を全ファイルで禁止

禁止理由をメッセージ本文に書き、落ちた人がその場で理由を読めるようにする。

## Consequences

- 規則の正本が文書ではなく設定ファイルになった。**文書は写しであり、変えるときは設定を先に直す**
- レイヤー override は rule 全体を置き換えるため、**バレル禁止の指定を各 override に毎回同梱する**必要がある
- 型だけを下の層から取りたい場合に、再 export ではなく直接 import する書き方が強制される
- 回避したくなったときは、まず配置が間違っていないかを疑う([../../AGENTS.md](../../AGENTS.md) の routing 表を見る)

## Alternatives Considered

- **文書とレビューだけで守る** — 実際に守られなかった前例がある(同じ概念の判定が2箇所に増える類)
- **フォルダ分割だけで表現する** — import の向きは表現できない
