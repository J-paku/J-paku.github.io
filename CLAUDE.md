# Claude Code

このプロジェクトの指示の本体は [AGENTS.md](AGENTS.md)。まずそれを読む。

- `docs/` を再帰的に読まない。[AGENTS.md](AGENTS.md) の routing 表が指した文書だけを開く
- 触るディレクトリに `AGENTS.md` があれば、ファイルを変更する前に読む
- 完了条件・検証の走らせ方は [docs/agents/verification.md](docs/agents/verification.md)。ローカルの PASS だけで「完了」と言わない
- 設計仕様書 portfolio-hub-spec はこのリポジトリの外(リポジトリと同じ階層の portfolio-hub-spec/)にある参考資料で、大半は過去の段階記録。現在の姿の正本はこのリポジトリ内の文書

利用者のホームに `.claude/CLAUDE.md`・`.claude/rules/` があればそれにも従う(リポジトリの外にある任意の個人設定で、無くても作業できる)。

## 方針: extreme constraints

このリポジトリでは人がコードを読んでレビューしない。代わりに制約(テスト・検査)を極端に多く置き、すべて通ったものを信頼する([docs/decisions/0011-extreme-constraints.md](docs/decisions/0011-extreme-constraints.md))。

- 「完了」はレビューではなく、すべての門を通ったことで言う。何を走らせるかは上の verification.md
- 制約を下げない。下限を下げる・テストを消す・ミューテーションの対象から外す・テストの境界(`hooks`フォルダに単体テストを置かない・`renderHook`を使わない)を変えるにはADRが要る
