---
status: active
read_when:
  - 変更を確かめる前
  - 「完了」と報告する前
source_of_truth: true
last_reviewed: 2026-10-01
---

# 何を走らせるか

**狭いものから。** 些細な変更で毎回すべてを走らせない。コマンドの中身は [../development/commands.md](../development/commands.md)。

| 変えたもの | 走らせるもの |
|---|---|
| `content/` の文言(既存キーの書き換え) | `npm run typecheck` → `npm run build` |
| `content/` に作品・経歴・地点を追加 | `npm run typecheck` → `npm run test`(村なら) → `npm run build` → 関連 spec |
| `content/world.ts`(地形・構造物・地点) | `npm run test`(`validate-world` と `village`)→ `npm run build` → `npx playwright test tests/journey.spec.ts` |
| `src/utils/` `src/lib/` の純粋関数 | 隣の `*.test.ts` → `npm run typecheck` |
| `src/lib/pixel/`(絵・パレット) | `npm run test` → `npm run build` → 見た目を目視 → `npx playwright test tests/day-night.spec.ts` |
| `src/lib/preferences.ts` / `weather.ts` / `analytics.ts` / `fetch-svg-source.ts`(外部境界) | 隣の `*.test.ts`(あれば) → `npm run typecheck` → 関連 spec |
| 1画面の中のコンポーネント | `npm run typecheck` → `npm run lint` → `npm run build` → その画面の spec |
| `src/components/ui/`(横断部品) | 上に加えて**使っている全画面**の spec |
| 村の操作・レイアウト | `npm run build` → `tests/journey.spec.ts` と `tests/layout.spec.ts` |
| CSS(色・トークン) | `npm run build` → axe(色を変えたなら必ず) |
| 本文の折り返しに関わる CSS | `npm run build` → 日本語改行検査 → [../quality/japanese-typography.md](../quality/japanese-typography.md) |
| import の向き・フォルダ構成 | `npm run lint` → `npm run typecheck` → `npm run build` |
| 設定(`next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` / `playwright.config.ts`) | `npm run typecheck` → `npm run lint` → `npm run test:coverage`(`vitest.config.ts` を変えたとき) → `npm run build` → `npm run test:e2e` 全体 |
| `vitest.config.ts`の`coverage`(測る範囲・床) | `npm run test:coverage`。床を変えたら、一度だけ実測より上に置いて落ちるのを見てから戻す |
| `lighthouserc.json`(経路・下限) | `npm run build` → `npm run start`と`npx wait-on http://localhost:4173` → `npx -y @lhci/cli@0.15.1 collect && npx -y @lhci/cli@0.15.1 assert`(版の正本は`.github/workflows/deploy.yml`) |
| 依存の版(`package.json` / `package-lock.json`。Dependabot(`.github/dependabot.yml`)の PR を取り込むときも) | ローカルで CI を丸ごと再現 → [../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」を全部 |
| `scripts/` | そのスクリプトを実際に引数付きで実行 |
| `.github/workflows/` | ローカルで CI 相当を再現 → [../operations/deployment.md](../operations/deployment.md) |
| 文書(`docs/` / `*.md`) | `npm run docs:check` |

## commit の直前

そこまでに触った範囲に関係なく、**1回だけ全体を通す**。

```bash
npm run docs:check && npm run typecheck && npm run lint && npm run format:check && npm run test:coverage && npm run build && npm run test:e2e
```

配信に関わる変更なら、さらに配信版で受け入れ確認を繰り返す([../operations/deployment.md](../operations/deployment.md))。

## 反復中の走らせ方

E2E とビルドは1分を超える。修理のたびに全体を回さない。

- 反復中: 落ちた spec と新しく書いた spec だけ(`npx playwright test tests/journey.spec.ts -g '<名前>'`)
- 全体は commit の直前に1回。そこで新しく落ちたものが出たら、その spec だけを狭く直してからもう一度全体

## 走らせたと言ってよい条件

- **実際に実行した出力を見たときだけ**「通った」と書く
- 実行できなかった検証は、何を確かめていないかを明示する
- 他のエージェントやワーカーの「直した」という報告は、**ファイルか diff を自分で見るまで根拠にならない**
