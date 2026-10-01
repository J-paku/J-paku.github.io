---
status: active
read_when:
  - 何をどう確かめるかの基準を知りたいとき
source_of_truth: false
last_reviewed: 2026-10-01
---

# quality/

このリポジトリの品質の5つの軸。上の4つは CI のゲートになっている(単体・統合テストはソースを、E2E・axe・改行検査・Lighthouse CI は配信物 `out/` を測る。手順の正本は `.github/workflows/deploy.yml`)。
最後の公開してよい情報の線引きは約束事で、CI では検査していない。

| 軸 | 読む文書 |
|---|---|
| テストの置き場・書き方・検出力の示し方・カバレッジの床(`vitest.config.ts`) | [test-strategy.md](test-strategy.md) |
| アクセシビリティ(axe・読み上げ・キーボード) | [accessibility.md](accessibility.md) |
| 日本語の改行と禁則 | [japanese-typography.md](japanese-typography.md) |
| 描画性能と転送量・Lighthouse CIの下限(`lighthouserc.json`) | [performance.md](performance.md) |
| 公開してよい情報の線引き | [security.md](security.md) |

変更の種類ごとに何を走らせるかは [../agents/verification.md](../agents/verification.md)。
