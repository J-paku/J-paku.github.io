# AGENTS.md

このリポジトリで作業するコードエージェント(Claude Code / Codex / Cursor / Gemini CLI など)の入口。
**この文書は知識を持たない。「今の作業でどれを読むか」を決めるためのルーターである。**

サイト本体は `https://j-paku.github.io/` に配信しているポートフォリオハブ。
Next.js 16(App Router)の静的エクスポートで、サーバもデータベースも無い。人間向けの紹介は [README.md](README.md)。

## 不変ルール(破ったら即中断して報告)

1. **locale は `location.pathname` からのみ決まる。** `?lang=`・自動リダイレクトを作らない
2. **表示文字列を `content/` の外にハードコードしない。** コンポーネントに日本語・韓国語リテラル禁止
3. **`localStorage` / `sessionStorage` へのアクセスは `src/lib/preferences.ts` 一箇所だけ。** 例外は `src/app/html-shell.tsx` のインラインスクリプト1本だけで、初回ペイント前にテーマを当てるためにある
4. **フックはフォルダ化しても `index.ts` を作らない。`hooks` フォルダには `use-` 始まりのフック以外を置かない。** コンポーネントのみ `index.tsx` が入口
5. **wip 作品は詳細ページを作らない。** カードにリンクを付けず、slug 直接アクセスは NotFound
6. **1段階 = 1セッション**(大きな改修を1回のセッションに詰め込まない)

理由と機械化の状況は [docs/architecture/boundaries.md](docs/architecture/boundaries.md) にある。

## 作業の種類 → 読む文書

左の行にひとつ当てはまったら、そこに挙がっている文書だけを読む。複数当てはまるときだけ足す。

| 作業 | 読む文書 |
|---|---|
| 表示文字列・作品・経歴・スキルの追加/修正 | [content/AGENTS.md](content/AGENTS.md) → [docs/product/domain-model.md](docs/product/domain-model.md) |
| 村の地形・会話地点・移動・当たり判定 | [docs/architecture/village.md](docs/architecture/village.md) → [content/AGENTS.md](content/AGENTS.md) |
| ドット絵・スプライトシート・パレット(昼夜・天気) | [src/lib/pixel/AGENTS.md](src/lib/pixel/AGENTS.md) → [docs/architecture/village.md](docs/architecture/village.md) |
| 村の画面・操作帯・会話窓・地図の UI | [src/components/VillagePage/AGENTS.md](src/components/VillagePage/AGENTS.md) |
| 一覧(`/list`)・作品ストーリー(`/works/<slug>`)の UI | [docs/architecture/frontend.md](docs/architecture/frontend.md) |
| コンポーネント・フックを新しく作る/分ける/移す | [docs/architecture/frontend.md](docs/architecture/frontend.md) → [docs/development/coding-guidelines.md](docs/development/coding-guidelines.md) |
| どのファイルがどの画面のものか分からない | [docs/product/feature-map.md](docs/product/feature-map.md) |
| 語の意味が分からない(地点・ワールド・作品・経歴) | [docs/product/terminology.md](docs/product/terminology.md) |
| 色・テーマ・CSS Modules の書き方 | [docs/architecture/frontend.md](docs/architecture/frontend.md) |
| ルーティング・メタデータ・言語切り替え | [docs/architecture/overview.md](docs/architecture/overview.md) |
| ブラウザ保存・外部 API 取得・コンテンツ読み込み | [docs/architecture/data-flow.md](docs/architecture/data-flow.md) |
| 外部通信・実画面のキャプチャを足してよいか | [docs/quality/security.md](docs/quality/security.md) → [docs/architecture/data-flow.md](docs/architecture/data-flow.md) |
| import の向き・レイヤー・server/client 境界 | [docs/architecture/boundaries.md](docs/architecture/boundaries.md) |
| テストの追加・修正 | [docs/quality/test-strategy.md](docs/quality/test-strategy.md) |
| テスト・E2E が落ちる | [docs/quality/test-strategy.md](docs/quality/test-strategy.md) → [docs/development/debugging.md](docs/development/debugging.md) |
| アクセシビリティ(axe が落ちた・読み上げ) | [docs/quality/accessibility.md](docs/quality/accessibility.md) |
| 日本語の改行・禁則が崩れた | [docs/quality/japanese-typography.md](docs/quality/japanese-typography.md) |
| 描画が重い・入力が落ちる・転送量 | [docs/quality/performance.md](docs/quality/performance.md) |
| CI・GitHub Pages への配信・切り戻し | [docs/operations/deployment.md](docs/operations/deployment.md) |
| 環境構築・コマンドが分からない | [docs/development/setup.md](docs/development/setup.md) → [docs/development/commands.md](docs/development/commands.md) |
| 設定ファイル・依存の版を変える | [docs/agents/verification.md](docs/agents/verification.md) |
| 文書そのものを直す | [docs/README.md](docs/README.md)(直したら `npm run docs:check`) |
| 動かない原因を調べる | [docs/development/debugging.md](docs/development/debugging.md) |
| 「なぜこの作りなのか」を知りたい・既存の設計を置き換えたい | [docs/decisions/README.md](docs/decisions/README.md) |

どれにも当てはまらないときだけ [docs/README.md](docs/README.md)(文書全体の地図)を開く。

## 読まなくてよいもの(重要)

- **`docs/` を再帰的に読まない。** 上の表が指した文書と、その文書が明示的にリンクした先だけを開く
- **`docs/decisions/` は通常作業で読まない。** 読むのは「既存の設計を置き換える」「なぜこうなっているかを問われた」ときだけ
- **`docs/operations/` は機能追加では読まない。** CI・配信の設定を触るときだけ
- **作業範囲外のディレクトリを探索しない。** 村を触るなら `src/components/Story/` と `src/components/Directory/` は開かない(逆も同じ)。
  例外は2つ — 同種の既存実装を1つだけ開いて書き方を合わせるとき、部品を `src/components/ui/` へ引き上げてよいか使用箇所を数えるとき
- **`.claude/` はリポジトリ管理外**(`.gitignore` 済み)。過去セッションの作業メモなので参照しない
- **`../portfolio-hub-spec/` はこのリポジトリの外にある参考資料**で、大半は過去の段階記録。無くても作業できる。現在の姿の正本はこのリポジトリ内の文書である

## 作業の進め方

1. この文書の不変ルールと routing 表を読む
2. 作業を分類し、**routed された文書だけ**を読む
3. 触る範囲に `AGENTS.md` があれば先に読む(`content/` `src/lib/pixel/` `src/components/VillagePage/`)
4. 着手から報告までの手順は [docs/agents/workflow.md](docs/agents/workflow.md) に従う
5. 何をどこまで走らせるかは [docs/agents/verification.md](docs/agents/verification.md)

このリポジトリで実際に起きた間違いの一覧は [docs/agents/common-mistakes.md](docs/agents/common-mistakes.md)。

## コミット

- 形式: `<type>: <日本語の要約>` + 本文は日本語の箇条書き。type は `feat` / `fix` / `hotfix` / `refactor` / `docs`
- **AI 署名を入れない**(`Co-Authored-By` も `Claude-Session` も書かない)
- **エージェントは自分でコミットしない。** 利用者が明示的に指示したときだけ実行する
