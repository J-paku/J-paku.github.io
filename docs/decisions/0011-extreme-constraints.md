---
status: historical
read_when:
  - 制約(テスト・検査・下限)を緩めたくなったとき
  - ロジックをどこに置き、どのテストで固めるか迷ったとき
  - フックのフォルダにテストを置いてよいか迷ったとき
source_of_truth: false
last_reviewed: 2026-10-14
---

# 0011. 人はコードを読んでレビューせず、制約(テスト・検査)を極端に多く置いて、すべて通ったものを信頼する

## Status

Accepted(2026-10-10、利用者の決定)。[0009](0009-widen-happy-dom-test-scope.md)のうち、村のフックを`renderHook`で呼んで単体の層で見る部分を置き換える。
コンポーネントを描く統合テスト、DOMを使うutils、歩行ループの部品をhappy-domで見る部分は0009のまま。
下の「ファイル別100%とミューテーションの対象」のうち、対象を新しく作ったファイルに限り設定の一覧へ手で足す部分は、[0014](0014-gate-all-pure-modules.md)が置き換えた(2026-10-11。純粋モジュールの全部を自動で対象にする)。
下の「ファイルの境界」のうち、フックとコンポーネントの「振る舞いはE2Eと統合テストで見る」と「フックはカバレッジも測らない」は、[0016](0016-testing-trophy-browser-integration.md)が置き換えた
(2026-10-13。フックはそれを使う画面を実ブラウザ(Vitest Browser Mode)の統合テストで描いて見て、統合テストへ移し終えたフォルダからファイル別100%で測る。
happy-dom でコンポーネントを描くテストは、ここでは「統合テスト」と呼んでいるが、0016 からは単体に数える。`hooks`フォルダに単体テストを置かない・`renderHook`を使わない決まりは変えない)

一部を [0017](0017-screen-containers.md) が置き換えた(2026-10-14。下の「ファイルの境界」の「コンポーネントを描く統合テスト(0009)は今のまま」は、
happy-dom でコンポーネントを描くテストを無くし、断定をコンテナの隣の `container.browser.test.tsx`(実ブラウザの統合テスト)へ移す形に替わった。
DOMを使うutils・歩行ループの部品の単体テスト、`hooks`フォルダに単体テストを置かない・`renderHook`を使わない決まりは変えない)

## Context

2026-10-10、利用者がこのリポジトリの中心に置く方針を決めた。拠り所は『Clean Code』の著者Robert C. Martinの投稿([出典](https://x.com/unclebobmartin/status/2080257779395154409))で、利用者の要約は次のとおり。

- 本人はもうコードを直接書かず、コードを読んでレビューすることもしない
- 代わりにテストを極端に多く置き、それを通ったものは信頼するしかない状態を作る。投稿の言葉では「extreme constraints」
- 挙げている制約は、単体テスト・ミューテーションテスト・Gherkinテスト・QA手順・品質指標・カバレッジ

決める前のこのリポジトリは次の状態だった。

- CIの門は、ソースに対してdocs:check・typecheck・lint・format:check・単体と統合のテスト(全体のカバレッジの床)、
  配信物に対してE2E・axe・Lighthouse CI・日本語改行の検査(`.github/workflows/deploy.yml`)
- カバレッジの床は全体で1つの値で、「目標値ではなく、テストを消したり測られないコードを増やしたりしたときに落とすためのもの」([../quality/test-strategy.md](../quality/test-strategy.md))。ファイルごとの下限は無かった
- テストが欠陥を本当に落とせるかは、「新しい検査は必ず一度落とす」([../quality/test-strategy.md](../quality/test-strategy.md))として人が手で壊して確かめる約束で、機械では確かめていなかった
- 0009が対象にした形の、フックを`renderHook`で呼ぶ単体テストは、`src/components/VillagePage/components/Village/hooks/`の中に4つある
  (`use-map-data`・`use-village-time`・`use-village-world`と、`use-village-overlay`の中の`use-village-travel`)

## Decision

### 方針

**人はコードを読んでレビューしない。代わりに制約(テスト・検査)を極端に多く置き、すべて通ったものを信頼する。**
「完了」はレビューではなく、すべての門を通ったことで言う。

### 今ある制約

2026-10-10の時点の制約。CIで走る順と段の正本は`.github/workflows/deploy.yml`、数値と対象の正本は各行の設定ファイルで、ここは写しである。

| 制約                                                  | 落とすもの                                                                                                                                          | 正本                                                                                     | 測る相手     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `npm run docs:check`                                  | 文書のリンク・参照パス・`npm run`名の不在、frontmatterの欠け、E2E一覧と実物の食い違い                                                               | `scripts/check-docs.mjs`                                                                 | ソース       |
| `npm run typecheck`                                   | 型の食い違い(ja・koの表示文字列が同じ型を満たさないことを含む。[0003](0003-content-outside-src.md))                                                 | `tsconfig.json`                                                                          | ソース       |
| `npm run lint`                                        | レイヤー境界(importの向き)とバレルを破るimport([0004](0004-lint-enforced-layer-boundaries.md))                                                      | `eslint.config.mjs`                                                                      | ソース       |
| `npm run format:check`                                | 整形の崩れ                                                                                                                                          | `.prettierrc`                                                                            | ソース       |
| `npm run test:coverage`                               | 単体・統合テストの失敗と、全体のカバレッジの床割れ                                                                                                  | `vitest.config.ts`の`coverage`                                                           | ソース       |
| ファイル別カバレッジ100%(`npm run test:coverage`の中) | 対象のファイルに、文・分岐・関数・行のどれかで測られない所が1つでもあること(`FULL_COVERAGE`。4つとも100)                                            | `vitest.config.ts`の`coverage.thresholds`                                                | ソース       |
| `npm run test:mutation`                               | 単体テストが落とせない変異が残ること(`break` 100)。2026-10-11からpushでは変わった変異体だけを走らせる([0013](0013-incremental-mutation-on-push.md)) | `stryker.config.mjs`の`mutate`                                                           | ソース       |
| `npm run test:boundary`                               | `hooks`フォルダの中の単体テストと、srcのテストで`renderHook`を使うこと                                                                              | `scripts/check-test-boundary.mjs`                                                        | ソース       |
| `npm run test:e2e`                                    | 実際のクリック・キー操作での振る舞いの崩れ                                                                                                          | `playwright.config.ts`と[../quality/test-strategy.md](../quality/test-strategy.md)の一覧 | 配信物`out/` |
| axe                                                   | アクセシビリティの違反                                                                                                                              | `scripts/check-a11y.mjs`                                                                 | 配信物`out/` |
| Lighthouse CI                                         | 性能・アクセシビリティ・ベストプラクティス・SEOの点数の下限割れ                                                                                     | `lighthouserc.json`                                                                      | 配信物`out/` |
| 日本語改行の検査                                      | 文節の途中での改行・禁則の崩れ・`<wbr>`の消失                                                                                                       | `scripts/check-ja-linebreak.mjs`                                                         | 配信物`out/` |

### ファイルの境界

- **ロジックは純粋関数に置く。** 置き場は`src/lib/`・`src/utils/`と、コンポーネント専用のutils。単体テストとミューテーションテストで固め、
  ファイル別のカバレッジを文・分岐・関数・行のそれぞれで100%にする
- **フックとコンポーネントは配線だけを持つ。** 単体テストを置かず、振る舞いはE2Eと統合テストで見る。
  `hooks`フォルダの中に単体テストを置く、またはsrcのどのテストでも`renderHook`を使うと、`npm run test:boundary`が落とす。例外の一覧(許可リスト)は持たない。
  フックはカバレッジも測らない(`vitest.config.ts`で`src/**/hooks/**`を外す)
- コンポーネントを描く統合テストと、DOMを使うutils・歩行ループの部品の単体テスト(0009)は今のまま

### ファイル別100%とミューテーションの対象

- **対象はファイル単位で、新しく作るロジックのファイル。** 純粋関数の置き場(上)に新しく作ったファイルを、
  `stryker.config.mjs`の`mutate`と`vitest.config.ts`のファイル別100%(`FULL_COVERAGE`)の両方へ足す。既にあるファイルを遡って全部を対象にはしない
- ドット絵の行列のようなデータのファイルは`mutate`に入れず、ファイル別100%だけで固める(理由は`stryker.config.mjs`の注釈)
- 対象の一覧の正本はこの2つの設定で、文書へ書き写さない。並べたファイルが実在しないと、どちらの設定も読み込む時に落ちる(対象の無いまま黙って通らないように)

### 制約は上げる方向にだけ動かす

- **下限を下げる・テストを消す・`mutate`から外す・テストの境界(`hooks`フォルダに単体テストを置かない・`renderHook`を使わない)を変える、には新しいADRが要る。**
  下の移行でフックのテスト4つを消したのは、このADRが決めたこととして除く
- 上げる方向(下限を上げる・テストを足す・対象を足す)はADR無しで行ってよい
- 「新しい検査は必ず一度落とす」([../quality/test-strategy.md](../quality/test-strategy.md))はそのまま。新しい制約も、一度落ちるのを見てから採る

### まだ置かない制約(候補)

- **Gherkin(受け入れの記述)** — 振る舞いをGiven/When/Thenで書き、そのまま実行できる受け入れテストにする
- **QA手順書** — 人が配信版で確かめる手順を書き残す

どちらも候補として記すだけで、置くかどうかは決めていない。

### 既存のフックのテスト4つの移行

- 4つ(`use-map-data`・`use-village-time`・`use-village-world`・`use-village-travel`)は、各フックのロジックを純粋関数へ移して純粋関数の単体テストで見るようにし、
  フックのテストを消した(2026-10-10、このADRと同じ変更)
- これで`hooks`フォルダの単体テストは無くなり、`scripts/check-test-boundary.mjs`の許可リストの仕組みも無くした。
  今は例外なく、`hooks`フォルダに単体テストを置かず、srcのどのテストでも`renderHook`を使わない

## Consequences

- 0009の「村のフックを`renderHook`で単体の層で見る」形のテストは無くなった。あった4つは同じ変更で純粋関数のテストへ移して消し、
  以後は`npm run test:boundary`がsrcのテストでの`renderHook`を落とす
- フックは全体のカバレッジの分母から外れ、フックの振る舞いを見るのはE2Eだけになった。フックにロジックが残ると、そのロジックはどの単体テストにも測られない。だからロジックを純粋関数へ移す
- 人がコードを読まないので、制約が見ていない所は誰も確かめない。今それに当たるのは、ドット絵が原画と合っているか
  (「読み取った行列が原画と合っているかは目で確かめるしかない」、[0010](0010-read-originals-by-dot-pitch.md))と、
  公開してよい情報の線引き(「約束事で、CI では検査していない」、[../quality/README.md](../quality/README.md))で、ここは今も人の目に残る
- 一度も落ちたことのない制約は、通っても何も示さない。制約を足す側の確からしさは「一度落とす」で担保する
- 制約の数値と対象の正本は設定ファイル(`vitest.config.ts`・`stryker.config.mjs`・`scripts/check-test-boundary.mjs`・`lighthouserc.json`)で、文書は写しである。変えるときは設定を先に直す

## Alternatives Considered

- **コードを人が読んでレビューして守る** — 利用者が退けた。[0004](0004-lint-enforced-layer-boundaries.md)も「文書とレビューだけで守る」を「実際に守られなかった前例がある」として退けている
- **フックを`renderHook`の単体テストで見続ける**(0009の形) — 利用者の決定で採らない。退けた理由は、「ロジックは純粋関数に置き、フックは配線だけ」という境界のほかに記録が無い
- ほかに比べた案の記録は無い
