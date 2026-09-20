---
status: active
read_when:
  - どの文書を読めばよいか AGENTS.md で決まらなかったとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# docs/

このリポジトリの文書の地図。**全部読むための文書ではない。**
作業の種類から読む先を決めるのは [../AGENTS.md](../AGENTS.md) で、ここはそこで決まらなかったときに開く索引である。

## どこに何があるか

| 知りたいこと | 行き先 |
|---|---|
| 今のシステムがどう組まれているか | [architecture/](architecture/README.md) |
| この村・作品・経歴という言葉が何を指すか、どんな決まりで動くか | [product/](product/README.md) |
| コードをどう書くか、どう動かすか、なぜ動かないか | [development/](development/README.md) |
| 何をどう検証するか(テスト・a11y・改行・性能) | [quality/](quality/README.md) |
| どう配信されるか、どう戻すか | [operations/](operations/README.md) |
| なぜ過去にそう決めたか | [docs/decisions/](decisions/README.md) |
| コードエージェントの作業手順・検証表・よくある間違い | [agents/](agents/README.md) |

## Source of Truth(正本の場所)

同じ規則を2箇所に書かない。以下が正本で、他の文書はリンクするだけにする。

| 知識 | 正本 |
|---|---|
| 作業の routing・不変ルール・コミット規則 | [../AGENTS.md](../AGENTS.md) |
| 現在のシステム構成・境界・画面の作り方 | [architecture/](architecture/README.md) |
| 用語 | [product/terminology.md](product/terminology.md) |
| 型・業務規則(正本はコード。ここは案内) | [product/](product/README.md) |
| 機械が見ない書き方の決まり | [development/coding-guidelines.md](development/coding-guidelines.md) |
| コマンドが何を見るか | [development/commands.md](development/commands.md) |
| 検査の基準(何を満たせば合格か) | [quality/](quality/README.md) |
| 何をどこまで走らせるか・作業手順 | [agents/](agents/README.md) |
| 配信と切り戻し | [operations/](operations/README.md) |
| 過去の設計判断 | [decisions/](decisions/README.md) |
| 表示文字列・村の地形の実データ | `content/`(→ [../content/README.md](../content/README.md)) |
| 依存の向き(機械が守らせる) | `eslint.config.mjs` |
| インストール済みの版 | `package.json` |
| 人間向けのサイト紹介 | [../README.md](../README.md) |

**版番号・コマンド名・座標などの数値を文書へ書き写すときは、正本のファイル名を併記する。**
併記が無い数値は、正本が変わったときに誰も直せない。

## 文書の状態(frontmatter の `status`)

| 値 | 意味 |
|---|---|
| `active` | 今これに従う |
| `deprecated` | 推奨しないが移行途中のため残っている |
| `historical` | 過去の記録。現在の姿の説明に使わない(`decisions/` の ADR) |
| `generated` | 自動生成。手で編集しない |

各文書の先頭には `status` / `read_when` / `source_of_truth` / `last_reviewed` を置く。
この4項目と、文書内の相対リンク・ファイルパス・`npm run` 名の実在は `npm run docs:check` が機械的に確かめる。

## 文書を直すとき

**Source of Truth が変わったときだけ直す。** 内部実装の変更・局所的なリファクタ・小さな UI 修正では直さない。
直す必要があるのは、レイヤー境界が変わった / 新しい正規のコマンドができた / 業務規則が変わった / 配信手順が変わった / [../AGENTS.md](../AGENTS.md) の routing が実態と合わなくなった、のいずれか。
