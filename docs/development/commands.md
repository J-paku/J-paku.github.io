---
status: active
read_when:
  - どのコマンドを走らせるか決めるとき
  - CI が落ちた原因を切り分けるとき
source_of_truth: true
last_reviewed: 2026-10-11
---

# コマンド

**正本は `package.json` の `scripts`。** ここには「そのコマンドが何を見て、何を見ないか」を書く。
変更の種類ごとにどれを走らせるかは [../agents/verification.md](../agents/verification.md)。

| コマンド | 見るもの | 見ないもの |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit`。ja/ko の翻訳キーの過不足もここで落ちる | 実行時の挙動・配信物 |
| `npm run lint` | ESLint。レイヤー境界とバレル禁止の違反もここで落ちる | 整形(Prettier は別) |
| `npm run format:check` | Prettier の整形。CI が落とす | `package.json` の glob(`src/` `content/` `scripts/` `tests/` の下の決まった拡張子)の外。`*.md`・直下の設定ファイル(`next.config.ts` など)・JSON・`.github/` の YAML など |
| `npm run test` | Vitest。`src/**/*.test.{ts,tsx}`を走らせる。既定はDOMを持たないnode環境で、ファイル先頭に`// @vitest-environment happy-dom`があるもの(統合テストの部品・DOMを使う(読む・書く・DOMParser)utils・`renderHook`で呼ぶフック)だけhappy-domで走る | 実ブラウザでの配置・寸法・スクロール(happy-domは配置を計算しない) |
| `npm run test:coverage` | `npm run test`と同じテストをv8のカバレッジ付きで走らせ、`vitest.config.ts`の床(`coverage.thresholds`)を下回ると落ちる。床は全体の床と、純粋モジュールのファイル別100%の2種類。ファイル別100%の対象は`scripts/gate-targets.mjs`の`COVERAGE_TARGETS`で、`src`をたどって純粋モジュールの置き場(`src/lib/`・`src/utils/`・コンポーネント専用のutils)の`.ts`を自動で選ぶ(新しいファイルは置いた時点で入る)。CIはこちら | `src/`の外(`content/`・`scripts/`)のカバレッジ。E2Eが通ったコードも数えない |
| `npm run test:boundary` | `scripts/check-test-boundary.mjs`。`hooks`フォルダの中に単体テスト(`*.test.ts`・`*.test.tsx`)が無いか、許可リストに実在しないテストが残っていないか。git の追跡ではなく作業ツリーを見るので、未追跡のテストも数える。許可リストの正本はスクリプトの`ALLOWED_HOOK_TESTS` | テストの中身・フックの振る舞い(E2Eが見る) |
| `npm run test:mutation` | Stryker の変異テスト。純粋モジュールの置き場の全部(`scripts/gate-targets.mjs`の`MUTATION_TARGETS`。`src`をたどって自動で選び、ドット絵の行列・色の表のデータは外す)を1か所ずつ壊した変異体を作り、単体テストがすべて落とせるかを数える。1体でも生き残ると落ちる。CIは`test:coverage`・`test:boundary`の後に走らせる。既定は前回の結果を引き継いで変わった変異体だけを走らせ(`incremental`。CIは結果をキャッシュで持ち回る)、全部を走らせるのは`npm run test:mutation -- --force`(週1回、手で。[../decisions/0013-incremental-mutation-on-push.md](../decisions/0013-incremental-mutation-on-push.md)) | 対象の外(コンポーネント・フック・データのファイル)。E2E。既定の実行では、対象のファイルがimportする別のファイルだけの変更(全部を走らせるまで前回の結果を使う。手元では依存パッケージ・設定の変更も同じ。CIはキャッシュの鍵で依存・設定の変更を拾う) |
| `npm run build` | `scripts/build-sprites.mjs`(スプライトシートの PNG を焼く)→ `next build` → `scripts/verify-export.mjs`。content の整合性検査もここで走る | 画面の見た目・操作 |
| `npm run test:e2e` | Playwright。`out/` を静的配信して実操作で確かめる | **`out/` は作らない。先に `npm run build`** |
| `npm run docs:check` | 文書の相対リンク・参照パス・`npm run` 名の実在、`docs/` の frontmatter、どこからもリンクされない `docs/` の文書(孤児)、[../quality/test-strategy.md](../quality/test-strategy.md) の E2E 一覧と見出しの本数が `tests/` の spec の実物と合うか。項目の正本は `scripts/check-docs.mjs` の冒頭。**実在は git の追跡対象で判定する**(まだ `git add` していないファイルは「無い」と出る) | 文書の内容が正しいかどうか |
| `npm run verify` | commit の直前に1回通すもの([../agents/verification.md](../agents/verification.md) の「commit の直前」)。docs:check → lint → format:check → test:coverage → test:boundary → build を直列で走らせ、前段が落ちたら後段は走らない。型は build の中の `next build` が同じ `tsconfig.json` で検査するので、`npm run typecheck` は含めない | E2E・変異テスト・axe・Lighthouse CI・日本語改行検査(CI が push のたびに走らせる)。変えた範囲が指す spec と `npm run test:mutation` は別に足す |
| `npm run dev` | 開発サーバ(`:3000`) | 配信物。→ [setup.md](setup.md) |
| `npm run start` | `out/` を `:4173` で配信 | — |
| `npm run lint:fix` / `npm run format` | 自動修正 | — |

`npm run test:e2e` が配信に使うポートは既定 `:4173` で、`E2E_PORT` で変えられる(`npm run start` は `:4173` 固定)。

CI だけが走らせるものが3つある(`scripts/check-a11y.mjs` と `scripts/check-ja-linebreak.mjs`、Lighthouse CI)。
どれも**配信中のサーバが要る**(`npm run start` を先に上げ、`npx wait-on http://localhost:4173` を挟む)。
**引数のパス列の正本は `.github/workflows/deploy.yml`**、そのまま貼れる実行例は
[../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」にある。
Lighthouse CIだけは測る経路と基準の正本が`lighthouserc.json`で、基準の根拠は[../quality/performance.md](../quality/performance.md)。

## 落ちたときの読み方

- `content の整合性検査に失敗` → [../product/business-rules.md](../product/business-rules.md)
- `no-restricted-imports` → [../architecture/boundaries.md](../architecture/boundaries.md)(メッセージに禁止理由が入っている)
- `verify-export:` で始まる → [../operations/deployment.md](../operations/deployment.md)
- axe の違反 → [../quality/accessibility.md](../quality/accessibility.md)
- 改行検査の違反 → [../quality/japanese-typography.md](../quality/japanese-typography.md)
- `does not meet global threshold`(カバレッジが床を下回った)→ [../quality/test-strategy.md](../quality/test-strategy.md)
- Lighthouse CIの`assert`が落ちた → [../quality/performance.md](../quality/performance.md)
