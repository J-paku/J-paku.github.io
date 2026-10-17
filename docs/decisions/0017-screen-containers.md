---
status: historical
read_when:
  - 画面や横断部品にコンテナ(`container.tsx`)を置くか迷ったとき
  - 外の世界(保存・天気・計測・SVG の取得・content の読み出し)に触れる import をどこに書くか迷ったとき
  - コンポーネントを描くテストをどこに置くかを問われたとき
source_of_truth: false
last_reviewed: 2026-10-17
---

# 0017. ファイルを utils・lib、コンテナ、表示部品の3層に分け、コンポーネントを描くテストをコンテナの統合テストへ集める

## Status

Accepted(2026-10-14、利用者の決定)。次の部分を置き換える。

- [0016](0016-testing-trophy-browser-integration.md)の「層は4つで、実行環境とファイル名で決める」の表のうち、単体の層に「コンポーネント1つだけを描くテスト(今まで「統合」と呼んでいた happy-dom の8本)」を置く部分。
  コンポーネントを描くテストはコンテナの隣の `container.browser.test.tsx` だけにし、happy-dom の8本は断定を統合テストへ移して消した
  (`IntersectionObserver` の無い環境の1件だけは統合で作れず、E2E の `tests/observer-missing.spec.ts` へ移した。[Consequences](#consequences))
- 0016 の統合の層のファイル名 `*.browser.test.tsx`(仮)。コンテナごとにちょうど1本の `container.browser.test.tsx` に決めた
- [0009](0009-widen-happy-dom-test-scope.md)の「コンポーネントを描く統合テスト」(環境に加えて props・操作で分かれる出し分けを happy-dom で見る)と、
  [0007](0007-component-tests-happy-dom.md)の置き場(コンポーネントの隣の `index.test.tsx` を happy-dom で走らせる)。どちらもコンポーネントを happy-dom で描くテストを無くした形に替わった
- [0011](0011-extreme-constraints.md)の「ファイルの境界」のうち「コンポーネントを描く統合テスト(0009)は今のまま」。同じく happy-dom でコンポーネントを描くテストを無くした形に替わった

`hooks`フォルダに単体テストを置かない・どのテストでも`renderHook`を使わない([0011](0011-extreme-constraints.md))は変えない。
DOM を使う utils と歩行ループの部品を happy-dom で見る部分(0009)、0016 の「E2E を消す条件」とフックのファイル別100%の決め方も変えない

D1・D3 の一部・D5 は [0019](0019-hooks-make-containers.md) で置き換えた(2026-10-17。D1 のうちコンテナを役割で決めて6つのフォルダだけに置く部分は、フックを1つでも呼ぶコンポーネントをコンテナ(`container.tsx`)にする形に替わり、
6つは外の世界に触れてよい「I/O コンテナ」として残った。D3 のうち表示部品に UI のフックを許す部分は、表示部品はフックを1つも呼ばない形に替わった。
D5 の `container.browser.test.tsx`(コンテナの隣・コンテナごとにちょうど1本)は、リポジトリ直下の `__tests__` の下の動作ごとの `<動作>.integration.test.tsx`(コンテナごとに1本以上)に替わった。
D2・D4・D6・D7 と、D3 の外の世界の入口の一覧は、この記録のまま)

## Context

2026-10-14、利用者がファイルを「utils・lib」「コンテナ」「表示部品」の3つの層に分け、コンポーネントを描くテストを全部コンテナの統合テストへ集めると決めた。

決める前(`6b319df`)のこのリポジトリは次の状態だった。

- **画面の `index.tsx` が、サーバでしかできないことと画面の組み立てを両方持っていた。**
  村の `src/components/VillagePage/index.tsx` は content の読み出しとスプライトシートの合成(`node:crypto`・`node:zlib` を使う)に加えて、見出し・作品への近道・起動の覆い・設定メニューを描き、
  クライアントの `Village`(`'use client'` の入口)を描いていた。画面の状態とデータのフック(`useDayPhase`・`useWeather`・`useVillage`)を呼んでいたのはその `Village` だった
- **外の世界に触れる import が、表示の部品とその下のフックに散っていた。**
  - `@/lib/preferences` — 村の3つのフック(`use-village-arrive`・`use-village-restore`・`use-course-progress`)と、設定メニューの `use-theme-choice`
  - `@/lib/weather` — 村の `use-weather`
  - `@/lib/analytics` と `next/navigation` — ページ移動の計測(`PageviewCounter`)の入口の `index.tsx`
  - `@/lib/fetch-svg-source` — 場面の再生の下位部品 SceneSvg(当時の `src/components/ui/ScenePlayer/components/SceneSvg/` の `index.tsx`)
  - 卓上時計のストア(`use-village-time`、zustand)— 村の `use-day-phase` と、卓上時計の窓の `use-clock-modal`
- **コンポーネントを描くテストは2種類あった。** happy-dom でコンポーネント1つを描く単体の8本(`index.test.tsx`。作品カードとその部品の LinksOverlay・WorkLinks・ShotMedia、経歴の CareerDetail、
  設定メニュー、ページ移動の計測、作品ストーリーの技術チップの TechChipPopover)と、実ブラウザで村の `Village` を描く統合の1本。
  0016 は統合テストを「画面単位」としたが、どのファイルを描けば画面単位になるかは決めていなかった。
  画面の `index.tsx` は content の読み出し(`node:fs`)を持つのでブラウザでは描けず、村の統合テストはその下の `Village` を描き、`index.tsx` の静的なマークアップは描いていなかった
- **単体のカバレッジはコンポーネント(`.tsx`)も測っていた。** 外していたのはフック(`src/**/hooks/**`)だけだった(`vitest.config.ts`)
- 0016 は、統合テストを足す作業をフォルダごとに複数のセッションへ分けうる段階としていた(不変ルール6「1段階 = 1セッション」、[../../AGENTS.md](../../AGENTS.md))

### 調べたこと

コンテナと表示の部品を分ける形を広めた Dan Abramov の記事 [Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)(2015)は、
2019年に冒頭へ追記(「Update from 2019」。引用はウェブアーカイブに残る同じ URL の版で確かめた)し、今はこう分けることを勧めないとしている(「I don't suggest splitting your components like this anymore.」)。
分けて役に立った主な理由は状態の複雑なロジックを他から切り離せることで、それはフックでできる、という趣旨である(「Hooks let me do the same thing without an arbitrary division.」)。

このリポジトリでは、状態のロジックは既に純粋関数とフックへ切り離している(0011)。そこで分ける目的を次の2つに絞った。

1. **統合テストの単位を決める。** 統合テストが描くのはコンテナで、1つのコンテナに1本
2. **I/O の場所を固定する。** 外の世界に触れる import を書いてよいのは、コンテナとその隣の `hooks` フォルダだけ

表示の部品からフックを無くすこと(元の記事の presentational の形)は目的にしない([Alternatives Considered](#alternatives-considered))。

## Decision

### 3つの層

| 層         | ファイル                                                        | 持つもの                                                                     |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| utils・lib | `src/utils/`・`src/lib/`・コンポーネント専用の `utils` フォルダ | 純粋関数と、外の世界に触れる入口(今までどおり)                               |
| コンテナ   | 名前が `container.tsx` のファイルと、その隣の `hooks` フォルダ  | 画面の状態・データのフック、外の世界に触れる import、ストア                  |
| 表示部品   | コンテナでないすべての `.tsx` と `src/hooks/`                   | 受け取った props を描く。その部品の DOM の中で閉じる UI のフックは使ってよい |

画面のフォルダの `index.tsx` は、サーバでだけ働くローダー(D2)で、表示部品に数えない。アプリのルート(`src/app/`)もこの3層の外にある。

### 決まり(D1〜D7)

- **D1. コンテナは名前が `container.tsx` のファイル。** 置くのは画面の3つ(`src/components/VillagePage/`・`src/components/Directory/`・`src/components/Story/`)と、
  複数の画面にまたがり外の I/O に触れる横断部品の3つ(`src/components/ui/SettingsMenu/`・`src/components/ui/PageviewCounter/`・`src/components/ui/ScenePlayer/`)だけ。
  フックが1つも無いコンテナもあってよい。フックを持つからコンテナなのではなく、役割で決める
- **D2. 画面のフォルダの `index.tsx` はサーバのローダー。** サーバでしかできないこと — `@/lib/content/read` の読み出し、`node:crypto`・`node:zlib` を使うスプライトの生成、`notFound()`、
  初回の HTML に必ず要るインラインの `<style>`・`<script>` — だけを行い、直列化できる props で `./container` を描く。
  それ以外の画面の組み立て(静的なマークアップを含む)はコンテナへ移す。アプリのルート(`src/app/`)は今までどおり画面の `index.tsx` を import する
- **D3. 表示部品(コンテナでもローダーでもないすべての `.tsx` と `src/hooks/`)は、外の世界に触れない。**
  その部品の DOM の中で閉じる UI のフック(フォーカス・スクロール・観察器・外側の押下で閉じる・`useId`・`useMemo`・`useState` など)は使ってよい。次は import しない。
  - I/O の入口: `@/lib/preferences`・`@/lib/weather`・`@/lib/analytics`・`@/lib/fetch-svg-source`・`@/lib/content/` の下・`@/lib/metadata`
  - ストア(`use-village-time`)
  - `next/navigation`
  - 画面のフック(画面のフォルダの直下の `hooks` フォルダの下)

  `@/lib/village/`・`@/lib/pixel/` は I/O の無い純粋なロジックなので使ってよい。ただし `node:` のモジュールを使う `sheet-file`・`png` はローダーだけが使う。
  型だけの import(`import type`・`import { type X }`・`export type`)は禁止しない(`Precipitation` などの型を表示部品の props に使うため。実行時に読み込まれない)

- **D4. 上の I/O・ストアの import を書いてよいのは、`container.tsx` と、`container.tsx` のあるフォルダの直下の `hooks` フォルダだけ。** 画面の状態・データのフックはその `hooks` フォルダに置く。
  例外はローダーで、D2 のサーバの読み出し(`@/lib/content/read`・`notFound()`)はローダーが行う
- **D5. コンポーネントを描くテストは、コンテナの隣の `container.browser.test.tsx` だけ(コンテナごとにちょうど1本)。**
  node でしか組めない props(content の読み出しは `node:fs` を使う)が要るコンテナは、同じフォルダに `container.fixture.ts` を置き、`export function setup(project: TestProject)` の中で `project.provide(...)` する。
  `vitest.integration.config.ts` が `src` の下の `container.fixture.ts` を全部 globalSetup に集める。
  happy-dom でコンポーネントを描くテスト(`index.test.tsx`)は、その断定を統合テストへ移してから消す。
  統合で作れなかった1件(`IntersectionObserver` の無い環境)は E2E の `tests/observer-missing.spec.ts` へ移した([Consequences](#consequences))
- **D6. 統合テストの約束は今までどおり**([../quality/test-strategy.md](../quality/test-strategy.md) の「統合テストの約束」)。実際の Chromium で、ビルド無しで走り、モックはネットワークと時間だけ、
  断定は利用者に見えるもの(role・名前・文字)で行い、`renderHook` を使わず、`hooks` フォルダにテストを置かない。
  実際のコンテンツでは作れない場合(説明の無い作品など)は、コンテナの props を変えた版をテストが直接渡す。
  ブラウザの環境の設定(ビューポートの大きさ、`prefers-reduced-motion` を CDP や `matchMedia` で再現すること)はモックではなく環境として扱い、許す
- **D7. 既存の E2E(`tests/` の spec)はこの変更では変えない。**(統合で作れない断定を受ける spec を足すことはある。D5) 統合へ移すのは 0016 の手順(統合テストが同じ欠陥を一度落とすのを見てから消す)で後から行う

### 機械が守らせる所

- D1 の6つのフォルダは `scripts/container-dirs.mjs` の一覧にし、下の2つの検査が同じものを使う。名前が `container.tsx` でも一覧の外のものはコンテナに数えない。
  `npm run test:boundary`(`scripts/check-layers.mjs`)が、一覧の外の `container.tsx` と、一覧のフォルダに `container.tsx` が無いこと(改名・移動で一覧が空振りすること)を落とす。
  ローダーは一覧のうち画面の3つのフォルダの `index.tsx` だけで、画面のコンテナを import してよいのは、同じフォルダのローダー・統合テスト・フィクスチャだけ(許す側でも同じ。これも `scripts/check-layers.mjs`)
- D3・D4 は `npm run test:boundary`(`scripts/check-layers.mjs`)が、src の import のつながりをたどって落とす(型だけの import は数えない)。
  ファイル1つずつの指定子を見る ESLint の `no-restricted-imports` では、入口を import するフックを表示部品が import する形を見逃すため、つながりを見る検査にした。
  許す側(一覧のフォルダの `container.tsx`・その隣の `hooks` フォルダ・ローダー・`src/app/`・`src/lib/`・テスト・`*.fixture.ts`・`*.test-helper.ts`)の外のファイルが、I/O の入口・ストア・`next/navigation` か、そこへ届くファイルを import すると落ちる。
  コンテナは届く道を外へ伝えない(横断部品のコンテナは表示部品が描くため)。あわせて、許す側の外のファイルがコンテナの隣の `hooks` フォルダを import すること(今は入口へ届かないフックでも)と、
  import の要らない外の世界の入口(`fetch`・`localStorage`・`sessionStorage`・`indexedDB`・`navigator.sendBeacon`・`document.cookie`・`XMLHttpRequest`・`WebSocket`・`EventSource`)を式の中で使うことを落とす。
  `require()` は数えない(ESLint の `@typescript-eslint/no-require-imports` が src の全部で落とす)。
  規則の詳しい形は [../architecture/boundaries.md](../architecture/boundaries.md) の「コンテナと表示部品」
- D5 は `npm run test:boundary`(`scripts/check-test-boundary.mjs`)が落とす。`*.test.tsx`(単体の設定が拾う名前)を src のどこかに置くこと、
  `*.browser.test.ts`・`*.browser.test.tsx` を一覧のフォルダの `container.tsx` の隣の `container.browser.test.tsx` 以外に置くこと、一覧のフォルダに `container.browser.test.tsx` が無いこと、
  `container.browser.test.tsx` が同じフォルダの `./container` を(型だけでなく)import しないこと、単体の側(`*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`)が
  `@testing-library/react`・`react-dom`(とその下)を import すること、`container.fixture.ts` を一覧のフォルダの外に置くことを見る。
  統合の設定(`vitest.integration.config.ts`)も `container.browser.test.tsx` だけを拾う
- 単体のカバレッジ(`vitest.config.ts`)は `src/components/**/*.tsx` を測る範囲から外す。コンポーネントを描くのは統合テストだけになるため。
  外した後の実測から床を測り直して上げた(コミット「test: 単体のカバレッジからコンポーネントを外し、床を測り直して上げる」。床の値の正本は `vitest.config.ts` の `coverage`)。
  統合のカバレッジ(`vitest.integration.config.ts`)には、実測から2pt引いた全体の床を掛ける

### 0011 が新しいADRを求める変更

happy-dom の8本を消すこと、コンポーネントを描くテストの置き場(テストの境界)を変えること、単体のカバレッジからコンポーネントを外すことは、このADRが決めたこととする
(0011 は「テストを消す」「テストの境界を変える」に新しいADRを求める)

### 1回のセッションで入れる

不変ルール6「1段階 = 1セッション」と、0016 の「フォルダごとに複数のセッションに分けうる」に対し、利用者の決定で、6つのコンテナと6本の統合テストを1回のセッションで入れた。
ルールを越えたのはこの変更だけで、不変ルール6そのものは変えない

## Consequences

- **コンテナは6つになった。**
  - `src/components/VillagePage/container.tsx`(`'use client'`)が画面のフック `useDayPhase`・`useWeather`・`useVillage` と卓上時計のストアを呼び、値を表示部品の `Village` へ渡す。
    フックを呼ぶ順(effect の順)は元の `Village` と同じ。卓上時計の窓(ClockModal)はストアを読まず、時計の値と設定する関数を props で受け取る(`use-clock-modal` もストアを import しない)
  - 村の `'use client'` の入口が `Village` から `container.tsx` へ上がり、起動の覆い(Boot)・見出しのロゴ(Logo)・作品への近道・一覧への出口(ExitLink)・設定メニュー(Navigation)もコンテナが描くようになった。
    スプライトの背景を当てるインラインの `<style>` と、初回ペイント前に段階を直す `PHASE_INIT` の `<script>` はローダー(`src/components/VillagePage/index.tsx`)が作り、
    コンテナは ReactNode の差し込み口の props で受けて元の位置に置く(HTML の並びを変えない)
  - 画面の3つのローダーと統合テストのフィクスチャは、それぞれ同じ純粋な組み立て関数(読み出した結果を引数で受ける)を使う。
    村は `src/components/VillagePage/utils/village-props.ts`、一覧は `src/components/Directory/utils/directory-props.ts`、
    作品ストーリーは `src/components/Story/utils/story-props.ts`(ストーリーが無ければ null を返し、`notFound()` はローダーに残る)。フィクスチャはローダーを写さない
  - 村の画面のフックは `src/components/VillagePage/hooks/` へ移した(下のフォルダ `use-village-guide`・`use-village-overlay`・`use-walk-loop` はそのまま)。
    窓の UI のフックが使う `use-dialog-focus.ts`・`use-held-direction.ts` は表示部品の側(`src/components/VillagePage/components/Village/hooks/`)に残る
  - `src/components/Directory/container.tsx`・`src/components/Story/container.tsx` はフックが無く、`'use client'` も無い。中のクライアントの島(作品カード・場面モーダルなど)は今までどおり
  - 作品ストーリーの `use-active-scene`(`IntersectionObserver` で今読んでいる場面を追う UI のフック)は、画面のフォルダの直下の `hooks` フォルダから、それを使う表示部品の
    `src/components/Story/components/StoryBody/hooks/use-active-scene.ts` へ移した。画面のフォルダの直下の `hooks` フォルダはコンテナの隣の(I/O を許す)フォルダ、という D4 に合わせるため
  - `src/components/ui/SettingsMenu/container.tsx` がテーマの保存のフック(`useThemeChoice`)を呼ぶ
  - `src/components/ui/PageviewCounter/container.tsx` は元の入口の `index.tsx` を移したもので、何も描かないので表示部品は無い
  - `src/components/ui/ScenePlayer/container.tsx` は元の ScenePlayer と同じ props を受ける。場面 SVG の原本の取得(`@/lib/fetch-svg-source`)は SceneSvg からコンテナの隣の `hooks` フォルダへ移した
- **横断部品のコンテナは、外から `container.tsx` を直接指す。** 呼び出し側は殻(`src/app/html-shell.tsx`)・`Navigation`・作品カードの ShotMedia・作品ストーリーの IntroPreview と SceneModal。
  コンポーネントの入口は `index.tsx` という決まりの例外になる。画面の3つは今までどおり、ルートがローダーの `index.tsx` を指す
- **統合テストはコンテナごとに1本の6本になった。** node で props を組む `container.fixture.ts` は、村・一覧・作品ストーリー・設定メニューの4つ。
  設定メニューは ui の文言が要り、ブラウザのテストが `@content/ja/ui` を直接 import すると content の実データの import 規則(ESLint)に掛かり、`readContent` は `node:fs` を使うのでブラウザで読めないため、node のフィクスチャが provide する。
  happy-dom でコンポーネントを描く8本は消え、`*.test.tsx` はコンポーネントのテストに使わない。happy-dom は DOM を使う utils と歩行ループの部品の単体テストで使い続ける。
  統合テストはルーターの文脈も Next の実物の Context を Provider で渡し(ページ移動の計測は `PathnameContext`)、モジュールをモックしない
- **`IntersectionObserver` の無い環境の1件は、統合で作れず E2E へ移した。** 作品カードの happy-dom のテストにあった断定(どのカードも最初から現れる・作品カードの動画に src が入る・
  画面に入りきらない写真も色が付いたまま)は、テストの中で後から `IntersectionObserver` を消すと、読み込みの時にそれを覚えた `next/link` が TypeError を投げて統合では作れない。
  そこで E2E の `tests/observer-missing.spec.ts` へ移した(作品ストーリーの `use-active-scene` の同じ場合も同じ spec で見る)。
  観察器が無いときの判定は `src/utils/observe-fallback.ts` の単体テスト(ファイル別100%・変異100%)が、フックへのつなぎはこの E2E が守る
- **単体の層に残るのは、純粋関数・`src/lib/` の入口・DOM を使う utils になった。** コンポーネントのカバレッジは統合テストだけが測る
- 既存の E2E は変えていない(足したのは上の `tests/observer-missing.spec.ts` だけ)ので、同じ振る舞いを E2E と統合テストが二重に見る期間は続く(0016)
- 村では静的なマークアップもクライアントの島に入った。性能の点数の下限は Lighthouse CI(`lighthouserc.json`)の門が見る

## Alternatives Considered

- **フックを使う部品をコンテナにする** — 利用者が退けた。フックの要らない画面(一覧・作品ストーリー)にコンテナを置くために形だけのフックを置くことになり、
  フックがあるからコンテナになるという順が逆だ、とした。コンテナは役割(画面か、外の I/O に触れる横断部品か)で決める(D1)
- **表示部品はフックを0個にする** — 利用者が退けた。一覧で並ぶ部品(作品カード3枚・場面の節4つ・技術チップ16個・場面 SVG 最大8枚)のフックを、項目ごとの Map として上へ書き直すことになる。
  また、モーダルの「マウントしている = 開いている」という前提と、村の「フックを呼ぶ順 = effect の順」([../../src/components/VillagePage/AGENTS.md](../../src/components/VillagePage/AGENTS.md) の守ること2)を崩す。
  画面の状態だけをコンテナへ上げ、UI のフックは表示部品に置く形にした(D3)
- **`'use client'` の島の入口をコンテナにする** — 利用者が3つの案から画面単位(画面 = コンテナ)を選んだので採らない(選んだ理由は記録が無い)。
  補足すると、一覧と作品ストーリーは画面の入口がサーバで、クライアントの島(作品カード・技術チップ・場面モーダルなど)が画面の中に複数ある。
  この案ではコンテナが画面ごとではなく島ごとになって統合テストの単位が画面にならず、外の I/O に触れない島もコンテナになる。役割で決める D1 と合わない
