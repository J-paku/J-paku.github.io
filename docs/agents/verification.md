---
status: active
read_when:
  - 変更を確かめる前
  - 「完了」と報告する前
source_of_truth: true
last_reviewed: 2026-10-14
---

# 何を走らせるか

**狭いものから。** 些細な変更で毎回すべてを走らせない。コマンドの中身は [../development/commands.md](../development/commands.md)。

| 変えたもの | 走らせるもの |
|---|---|
| `content/` の文言(既存キーの書き換え) | `npm run typecheck` → `npm run build` |
| `content/` に作品・経歴・地点を追加 | `npm run typecheck` → `npm run test`(村なら) → `npm run build` → 関連 spec |
| `content/world.ts`(地形・構造物・地点) | `npm run test`(`validate-world` と `village`)→ `npm run build` → `npx playwright test tests/journey.spec.ts` |
| 純粋モジュール(`src/lib/` `src/utils/`・コンポーネント専用の utils)の追加・変更。どれも変異テストとファイル別100%の対象(規則の正本は `scripts/gate-targets.mjs`) | 隣の `*.test.ts` → `npm run typecheck` → `npm run test:coverage` → `npm run test:mutation`(既定は変わった変異体だけ。変えたファイルを別の純粋モジュールが import しているとき・依存・設定を変えたときは `npm run test:mutation -- --force`)。`src/lib/pixel/` と外部境界は下の行も足す |
| `hooks` フォルダの下へファイルを足す | `npm run test:boundary` → その画面の統合テスト(`npm run test:integration`。その画面の統合テストがまだ無ければ spec) |
| 統合テスト(`*.browser.test.tsx`)の追加・変更、`vitest.integration.config.ts` | `npm run test:integration`(ビルド不要。設定を変えたときは `npm run test:integration -- --coverage`) → `npm run test:boundary`。落ちた時の画面の写しは `test-results/vitest-screenshots/` |
| `src/lib/pixel/`(絵・パレット) | `npm run test` → `npm run build` → 見た目を目視 → `npx playwright test tests/day-night.spec.ts` |
| `src/lib/preferences.ts` / `weather.ts` / `analytics.ts` / `fetch-svg-source.ts`(外部境界) | 隣の `*.test.ts`(あれば) → `npm run typecheck` → 関連 spec |
| 1画面の中のコンポーネント | `npm run typecheck` → `npm run lint` → `npm run test:boundary` → `npm run test:integration`(コンポーネントを描くテストは統合にだけある) → `npm run build` → その画面の spec |
| `src/components/ui/`(横断部品) | 上に加えて**使っている全画面**の spec |
| 村の操作・レイアウト | `npm run build` → `tests/journey.spec.ts` と `tests/layout.spec.ts` |
| CSS(色・トークン) | `npm run build` → axe(色を変えたなら必ず) |
| 本文の折り返しに関わる CSS | `npm run build` → 日本語改行検査 → [../quality/japanese-typography.md](../quality/japanese-typography.md) |
| import の向き・フォルダ構成 | `npm run lint` → `npm run test:boundary`(コンテナと表示部品の分け方) → `npm run typecheck` → `npm run build` |
| 設定(`next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` / `vitest.integration.config.ts` / `playwright.config.ts`) | `npm run typecheck` → `npm run lint` → `npm run test:coverage`(`vitest.config.ts` を変えたとき) → `npm run test:integration -- --coverage`(`vitest.integration.config.ts` を変えたとき) → `npm run build` → `npm run test:e2e` 全体 |
| `vitest.config.ts`の`coverage`(測る範囲・床) | `npm run test:coverage`。床を変えたら、一度だけ実測より上に置いて落ちるのを見てから戻す |
| `lighthouserc.json`(経路・下限) | `npm run build` → `npm run start`と`npx wait-on http://localhost:4173` → `npx -y @lhci/cli@0.15.1 collect && npx -y @lhci/cli@0.15.1 assert`(版の正本は`.github/workflows/deploy.yml`) |
| 依存の版(`package.json` / `package-lock.json`。Dependabot(`.github/dependabot.yml`)の PR を取り込むときも) | PRを開き、そのPRのCI(`.github/workflows/deploy.yml`のbuildジョブ)が通ったことを確かめる。手元での再現([../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」)はCIが落ちた原因を手元で追うときに使う |
| `scripts/` | そのスクリプトを実際に引数付きで実行 |
| `.github/workflows/` | PRを開き、そのPRのCI(buildジョブ)が通ったことを確かめる。CIが落ちた原因を手元で追うときは [../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」 |
| 文書(`docs/` / `*.md`) | `npm run docs:check` |

## commit の直前

そこまでに触った範囲に関係なく、**`npm run verify` を1回通す**。
中身は docs:check → lint → format:check → test:coverage → test:boundary → test:integration → build の直列で、前段が落ちたら後段は走らない(正本は `package.json` の `scripts`)。

これに、上の表で変えた範囲が指すものだけを足す。

- E2E は表が指す spec だけ(`npx playwright test tests/journey.spec.ts` のように)
- `npm run test:mutation` は、純粋モジュール(変異テストの対象。`scripts/gate-targets.mjs` の `MUTATION_TARGETS`)かそのテストを変えたときだけ。
  既定は前回の結果を引き継ぎ、変わった変異体だけを走らせる。git のフックで毎回走らせることはしない。
  変異体を全部走らせるのは週1回、手で `npm run test:mutation -- --force`([../decisions/0013-incremental-mutation-on-push.md](../decisions/0013-incremental-mutation-on-push.md))

`npm run typecheck` を入れないのは、`npm run build` の `next build` が同じ `tsconfig.json` で型を検査するから。
2026-10-11 に src のソース・単体テスト(`src/lib/village/is-moving.test.ts`)・E2E の spec(`tests/flight.spec.ts`)へそれぞれわざと型の誤りを入れ、`tsc --noEmit` と `next build` が3つとも同じ誤り(TS2322)で落ちるのを確かめた。
`typecheck` は反復中の速い確認として上の表に残す。

表が指していないかぎり、**E2E の全体・変異テスト・axe・Lighthouse CI・日本語改行検査は手元で走らせない。**
CI(`.github/workflows/deploy.yml`)が `main` への push のたびにこれらを走らせ、`deploy` ジョブは `needs: build` なので、どれか1つでも落ちれば公開されない。
手元で同じものを回すのは、同じ門を2回通るだけである。そのかわり**完了は CI が通ったことで言う**(ローカルの PASS だけで完了と言わない)。

例外は、表の「依存の版」と「`.github/workflows/`」の行。そのときは門そのもの(道具の版・CI の手順)が変わるので、`main`へ直接pushせず、表のとおりPRを開いてそのPRのCIが通ってから取り込む(手元での再現はCIが落ちた原因を追うときだけ)。

配信に関わる変更なら、さらに配信版で受け入れ確認を繰り返す([../operations/deployment.md](../operations/deployment.md))。

## 反復中の走らせ方

E2E の全体は数分かかる(2026-10-11 の手元の実測で約3分44秒)。修理のたびに全体を回さない。

- 反復中: 落ちた spec と新しく書いた spec だけ(`npx playwright test tests/journey.spec.ts -g '<名前>'`)
- 統合テスト(`npm run test:integration`)はビルド無しで数秒なので、反復中も全体を回してよい([../quality/test-strategy.md](../quality/test-strategy.md) の「走らせる範囲」)
- E2E の全体は手元では回さず、push で CI が回す。CI で落ちた spec が出たら、その spec だけを手元で狭く直してから push し直す
- CI も E2E を再試行しない(`playwright.config.ts` の `retries` は 0)。1 回だけ落ちて次は通る揺れも、再実行で流さず原因を直す

## 走らせたと言ってよい条件

- **実際に実行した出力を見たときだけ**「通った」と書く
- 実行できなかった検証は、何を確かめていないかを明示する
- 他のエージェントやワーカーの「直した」という報告は、**ファイルか diff を自分で見るまで根拠にならない**
