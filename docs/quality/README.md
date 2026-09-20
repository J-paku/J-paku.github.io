---
status: active
read_when:
  - 何をどう確かめるかの基準を知りたいとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# quality/

このリポジトリが**配信物に対して**実測している4つの軸。どれも CI のゲートになっている。

| 軸 | 読む文書 |
|---|---|
| テストの置き場・書き方・検出力の示し方 | [test-strategy.md](test-strategy.md) |
| アクセシビリティ(axe・読み上げ・キーボード) | [accessibility.md](accessibility.md) |
| 日本語の改行と禁則 | [japanese-typography.md](japanese-typography.md) |
| 描画性能と転送量 | [performance.md](performance.md) |
| 公開してよい情報の線引き | [security.md](security.md) |

変更の種類ごとに何を走らせるかは [../agents/verification.md](../agents/verification.md)。
