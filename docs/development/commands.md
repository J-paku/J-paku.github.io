---
status: active
read_when:
  - どのコマンドを走らせるか決めるとき
  - CI が落ちた原因を切り分けるとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# コマンド

**正本は `package.json` の `scripts`。** ここには「そのコマンドが何を見て、何を見ないか」を書く。
変更の種類ごとにどれを走らせるかは [../agents/verification.md](../agents/verification.md)。

| コマンド | 見るもの | 見ないもの |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit`。ja/ko の翻訳キーの過不足もここで落ちる | 実行時の挙動・配信物 |
| `npm run lint` | ESLint。レイヤー境界とバレル禁止の違反もここで落ちる | 整形(Prettier は別) |
| `npm run format:check` | Prettier の整形。CI が落とす | `*.md`(整形対象外) |
| `npm run test` | Vitest。`src/**/*.test.ts` の**純粋関数だけ**。DOM 環境を持たない | コンポーネントの描画・ブラウザ挙動 |
| `npm run build` | `next build` + `scripts/verify-export.mjs`。content の整合性検査もここで走る | 画面の見た目・操作 |
| `npm run test:e2e` | Playwright。`out/` を静的配信して実操作で確かめる | **`out/` は作らない。先に `npm run build`** |
| `npm run docs:check` | 文書の相対リンク・参照ファイル・`npm run` 名・frontmatter の実在。**実在は git の追跡対象で判定する**(まだ `git add` していないファイルは「無い」と出る) | 文書の内容が正しいかどうか |
| `npm run dev` | 開発サーバ(`:3000`) | 配信物。→ [setup.md](setup.md) |
| `npm run start` | `out/` を `:4173` で配信 | — |
| `npm run lint:fix` / `npm run format` | 自動修正 | — |

CI だけが走らせるものが2つある(`scripts/check-a11y.mjs` と `scripts/check-ja-linebreak.mjs`)。
どちらも**配信中のサーバが要る**(`npm run start` を先に上げ、`npx wait-on http://localhost:4173` を挟む)。
**引数のパス列の正本は `.github/workflows/deploy.yml`**、そのまま貼れる実行例は
[../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」にある。

## 落ちたときの読み方

- `content の整合性検査に失敗` → [../product/business-rules.md](../product/business-rules.md)
- `no-restricted-imports` → [../architecture/boundaries.md](../architecture/boundaries.md)(メッセージに禁止理由が入っている)
- `verify-export:` で始まる → [../operations/deployment.md](../operations/deployment.md)
- axe の違反 → [../quality/accessibility.md](../quality/accessibility.md)
- 改行検査の違反 → [../quality/japanese-typography.md](../quality/japanese-typography.md)
