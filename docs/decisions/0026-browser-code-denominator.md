---
status: historical
read_when:
  - 統合のカバレッジ(`npm run test:integration -- --coverage`)の分母に、あるファイルが入る・入らない理由を問われたとき
  - 単体のカバレッジの全体の床(100)か、統合のカバレッジの全体の床を下げたくなったとき
  - 統合のカバレッジの全体の床を100にしない理由を問われたとき
  - ブラウザで動くコードの決め方(`scripts/find-browser-code.mjs`)を変えたくなったとき
source_of_truth: false
last_reviewed: 2026-10-20
---

# 0026. 統合のカバレッジの分母をブラウザで動くコードにし、どのファイルも単体か統合の少なくとも1か所で100%にする

## Status

Accepted(2026-10-19、利用者の決定「ファイルごとに1か所で100%」。どのファイルも単体か統合の少なくとも一方で100%、と読む。統合の全体の床の値は 2026-10-20 に決めた)。次の部分を置き換える。

- 単体と統合の全体の床を「実測から2pt引いて切り捨てた値」にする決め方(決め方は `vitest.config.ts`・`vitest.integration.config.ts` の注釈と [../quality/test-strategy.md](../quality/test-strategy.md) の「カバレッジの床」にあり、
  統合に掛けたのは [0017](0017-screen-containers.md) の「機械が守らせる所」の「統合のカバレッジには、実測から2pt引いた全体の床を掛ける」)。
  単体の全体の床は文・分岐・関数・行のすべてで100にし、統合の全体の床は 2026-10-20 の実測を整数へ切り捨てた値にする(Decision の2・3)
- 統合のカバレッジの分母を src の全部(テストの側を除く)にしていた所(`vitest.integration.config.ts` の `coverage.include`)。分母をブラウザで動くコードだけにする
- [0018](0018-move-e2e-and-gate-all-hooks.md) の Consequences の「統合テストの全体の床(実測から2pt引いた値)は、移した後の実測で上げてよい」。統合の全体の床の決め方は Decision の2による

フックとコンポーネント(コンテナと表示部品)の統合のファイル別100%([0018](0018-move-e2e-and-gate-all-hooks.md)・[0019](0019-hooks-make-containers.md)・[0022](0022-colocate-integration-tests.md)・[0024](0024-containers-as-index.md))、
統合テストで構造上届かない行だけを E2E を名指しする注釈で外す決まり(0018)、純粋モジュールの単体のファイル別100%と変異テストの対象([0014](0014-gate-all-pure-modules.md))、
`hooks` フォルダに単体テストを置かない・どのテストでも `renderHook` を使わない([0011](0011-extreme-constraints.md))は変えない。
統合の分母から node でしか動かないファイルを外すのは、0011 が ADR を求める「対象から外す」に当たりうるので、この ADR で決めたこととする(外したファイルは単体の全体の床100で測る)

## Context

決める前(`7bf8bcb`)のこのリポジトリは次の状態だった。数値は、2026-10-20 に `7bf8bcb` の上の作業ツリーで測った。

- **統合のカバレッジの分母は src の全部だった。** `vitest.integration.config.ts` の `coverage.include` は `src/**/*.{ts,tsx}` で、テストの側(`*.test.{ts,tsx}`・`*.fixture.ts`・`*.test-helper.ts`・`__tests__` の中)を外すだけだった。
  分母は226ファイル・3722文(統合テストを1本だけ走らせた `--coverage` の報告の、走らないファイルも含めた合計。
  下の Decision の分母で統合テストの全部を走らせたときの合計 2934文と、外した44ファイルの合計 788文を足すと、同じ 3722文になる)
- **全体の割合は文 76.81%(3722 中 2859)で、床は文 74・分岐 77・関数 75・行 75 だった。** 床は 2026-10-15 の実測から2pt引いた値(`vitest.integration.config.ts` の注釈)。
  2859 は、下の Decision の分母で統合テストの全部を走らせたときに通った文の数と同じだった(外した44ファイルは、どの統合テストからも読み込まれないので、外す前も通った文は0)
- **0%のファイルは39(788文)で、どれも node でしか動かないコードだった。** `src/app/` のうち文を持つ13(ja・ko のルートの `page.tsx` 6つと作品詳細の枠の `layout.tsx` 2つ、画面の3つのローダー、`src/app/html-shell.tsx`・`src/app/locale-routes.tsx`)、
  content の読み出し(`src/lib/content/read.ts`・`validate.ts`・`validate-world.ts`)、スプライトの合成(`src/lib/pixel/` の15)、
  props の組み立て(`src/components/Directory/utils/directory-props.ts`・`src/components/Story/utils/story-props.ts`・`src/components/VillagePage/utils/` の `phase-init.ts`・`sprite-css.ts`・`stop-links.ts`・`village-props.ts`)、
  `src/lib/metadata.ts`、`src/utils/linkedom-browser-stub.ts`
- **統合テストの props は node で組むので、ブラウザのカバレッジに入らない。** 画面の props は、I/O コンテナのフォルダの `index.fixture.ts` が globalSetup として node で組み、inject で渡す([../quality/test-strategy.md](../quality/test-strategy.md) の「統合テストの約束」)。
  props を組む関数(上の props の組み立てと、それが呼ぶスプライトの合成・content の読み出し)は、ブラウザでは一度も読み込まれない
- **import のつながりで見ると、0%の39ファイルはブラウザで動くコードから届かないファイルと同じだった。** src/components の `index.tsx` 64と hooks フォルダの `use-*.ts(x)` 44の、108の入口から
  実行時の import(型だけの import を除く)でたどると、226ファイルのうち182に届き、届かない44は上の39と、文を持たない5(`src/app/` の ja・ko の `layout.tsx`・`not-found.tsx` の4と、型だけの
  `src/components/VillagePage/components/Village/utils/walk-loop/types.ts`)だった。届かない44を外すと、分母から788文が抜けて2934文になる。
  統合テストのファイル(`*.integration.test.tsx`)から実行時の import でたどっても、届かない44のどれにも届かなかった
- **届かない44は、どれも単体のカバレッジ(`vitest.config.ts`)の測る範囲に入っていた。** 単体の `coverage` は `src/**/*.{ts,tsx}` から、テストの側・`src/**/hooks/**`・`src/components/**/*.tsx` を外すだけ。
  44のうち20は純粋モジュールのファイル別100%(`scripts/gate-targets.mjs` の `COVERAGE_TARGETS`)に入り、`src/app/` の17・型だけの1・門の外のデータ6(`src/lib/pixel/` の絵の5と `linkedom` の差し替え)は単体の全体の床にだけ入っていた。
  単体の全体の床は文 95・分岐 96・関数 93・行 95(2026-10-14 の実測から2pt。`vitest.config.ts` の注釈)で、`src/app/` はどの単体テストも import しない([../quality/test-strategy.md](../quality/test-strategy.md) の 2026-10-18 の記述)

2026-10-19、利用者が「ファイルごとに1か所で100%」と決めた。どのファイルも、単体か統合の少なくとも一方で100%にする。
node で走るコードと純粋モジュール(ブラウザでも動く物を含む)は単体で、フックとコンポーネント(コンテナと表示部品)は統合で100%にする。

## Decision

1. **統合のカバレッジの分母は「ブラウザで動くコード」にする。** 決め方の正本は `scripts/find-browser-code.mjs`
   - 入口は、src/components の下の `index.tsx`(`hooks`・`__tests__` の中を除く。`scripts/find-containers.mjs` の `isEntryCandidate`)と、src の下の `hooks` フォルダの中の `use-*.ts`・`use-*.tsx`(`src/hooks/` を含む)。
     コンテナも表示部品も入口に数える
   - 入口から、実行時に読み込まれる import(import・`export … from`・`import x = require`・文字列の `import()`。型だけの import は除く)で src と content の中のファイルをたどり、届いた src の `.ts`・`.tsx` を分母にする。
     import の読み方は `scripts/read-imports.mjs`、先のファイルの決め方は `scripts/resolve-import.mjs`(層の境界検査・変異テストの指紋と同じもの)。content の中のコードも通り道としてたどる
   - テストの側(`*.test.{ts,tsx}`・`*.fixture.ts`・`*.test-helper.ts`・`__tests__` の中)は、今までどおり `coverage.exclude` で外す
   - src・content の中を指すのに見つからない import・式で組んだ `import()`・src と content の外を指す相対パスが1つでもあれば、設定を読む時点で投げる(届く先を取りこぼした集まりでは、外したファイルがブラウザで動かないと言えない)
   - 一覧は手で持たず、`vitest.integration.config.ts` が設定を読むたびに求める。`coverage.include` はファイルのパスを1つずつ並べた glob(glob で意味を持つ文字は `\` を付けて文字として当てる)
2. **統合の全体の床を、2026-10-20 の実測を整数へ切り捨てた文 98・分岐 96・関数 99・行 99 にする(`vitest.integration.config.ts`)。**
   実測は統合テスト95ファイル・351件で、分母182ファイルの文 98.46%(2934 中 2889)・分岐 96.2%(1579 中 1519)・関数 99.56%(688 中 685)・行 99.48%(2541 中 2528)。
   フックとコンポーネントのファイル別100%は残す(どのフック・コンポーネントも統合で100%になる門は、全体の床の値に依らずここにある)
   - **100にしない理由。** 届かないのは文 45・分岐 60・関数 3・行 13 で、全部が下の28ファイルにある。どれも純粋モジュールの置き場(`src/lib/`・`src/utils/`・コンポーネントの utils)のファイルで、
     画面からは届かない防御の分岐だった(製品の呼び出し元の無い関数: `src/utils/locale-path.ts` の `parseLocale`・`src/lib/preferences.ts` の `readTheme`。
     起きない値の検査: `rescue-focus.ts` の焦点が無い時・`pick-active-scene.ts` の要素でない対象と番号の無い場面。古い実行環境の代わりの道: `src/lib/weather.ts` の `AbortSignal.any` が無い時。
     ほかに `create-animation-loop.ts` の止める分岐・`stage-scale.ts` のすぐ合わせる分岐・`plan-travel.ts` など)
   - **それでも「どのファイルも少なくとも1か所で100%」は保たれる。** 28ファイルはどれも、単体のファイル別100%(`scripts/gate-targets.mjs` の `COVERAGE_TARGETS`)と変異テストの門(`break` 100。対象は同じファイルの `MUTATION_TARGETS`)に入り、
     単体のカバレッジで100%になっている(2026-10-20 に、28ファイルがどれも `COVERAGE_TARGETS` と `MUTATION_TARGETS` に入ることと、単体の `npm run test:coverage` の報告で文・分岐・関数・行のすべて100%であることを確かめた)
   - 2026-10-20 の実測で100%に届かなかった28ファイル(数は届かない文・分岐・関数・行の数)

     | ファイル                                                                                     |  文 | 分岐 | 関数 |  行 |
     | -------------------------------------------------------------------------------------------- | --: | ---: | ---: | --: |
     | `src/components/Story/components/SceneModal/utils/rescue-focus.ts`                           |   1 |    2 |    0 |   0 |
     | `src/components/Story/components/StoryBody/utils/pick-active-scene.ts`                       |   2 |    2 |    0 |   0 |
     | `src/components/VillagePage/components/Village/components/WorldMap/utils/arrange-badges.ts`  |   1 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/components/WorldMap/utils/cell-from-click.ts` |   1 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/enter-world.ts`                         |   0 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/pick-dialog.ts`                         |   0 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/plan-travel.ts`                         |   7 |    7 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/sprite-style.ts`                        |   0 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/stage-scale.ts`                         |   2 |    3 |    0 |   1 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/create-animation-loop.ts`     |   2 |    2 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/paint-camera.ts`              |   0 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/paint-lamp-veil.ts`           |   2 |    2 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/place-player.ts`              |   3 |    4 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/route-pointer.ts`             |   1 |    1 |    0 |   0 |
     | `src/components/VillagePage/components/Village/utils/walk-loop/wait-world-tiles.ts`          |   0 |    1 |    0 |   0 |
     | `src/lib/preferences.ts`                                                                     |   5 |    5 |    1 |   5 |
     | `src/lib/village/collision.ts`                                                               |   1 |    1 |    0 |   0 |
     | `src/lib/village/facade.ts`                                                                  |   1 |    1 |    0 |   1 |
     | `src/lib/village/fishing.ts`                                                                 |   2 |    3 |    0 |   0 |
     | `src/lib/village/flight.ts`                                                                  |   0 |    1 |    0 |   0 |
     | `src/lib/village/map-entries.ts`                                                             |   2 |    1 |    1 |   1 |
     | `src/lib/village/movement.ts`                                                                |   1 |    1 |    0 |   1 |
     | `src/lib/village/spot.ts`                                                                    |   1 |    2 |    0 |   0 |
     | `src/lib/village/umbrella.ts`                                                                |   1 |    1 |    0 |   1 |
     | `src/lib/village/warp.ts`                                                                    |   1 |    4 |    0 |   0 |
     | `src/lib/weather.ts`                                                                         |   4 |    3 |    0 |   2 |
     | `src/utils/locale-path.ts`                                                                   |   3 |    6 |    1 |   1 |
     | `src/utils/wrap-focus-index.ts`                                                              |   1 |    1 |    0 |   0 |
3. **単体の全体の床は、文・分岐・関数・行のすべて100にする(`vitest.config.ts`)。** node でしか動かないコード(`src/app/` のルートと画面のローダー、content の読み出し、スプライトの合成、props の組み立てなど)と純粋モジュールは単体テストで100%にする。
   純粋モジュールのファイル別100%(`COVERAGE_TARGETS`)は残す
4. **どちらの設定でも測らないファイルを残さないことを、統合の設定を読む時点で確かめる。** 当て方は Vitest と同じ(picomatch の contains・dot 付き。`test.include` を exclude に足す)で、次のどれかが外れたら投げる
   - 入口が1つ以上あり、分母(テストの側を除いた、入口から届く src のファイル)が空でない
   - src のコードのファイルの全部について、`coverage.include`・`coverage.exclude` で測る物と、1 の分母がぴったり重なる(contains は前後を固定しないので、`a.ts` の glob は `a.tsx` にも当たる)
   - テストの側でない src のコードのファイルは、統合の分母か、単体の設定の `coverage`(`vitest.config.ts` の `test.coverage.include`・`exclude` と `test.include` を、その設定から読む)の少なくとも一方に入る
   - フックとコンポーネントは、今までどおり1つ残らず統合で測られる
5. **新しい検査は一度落とす。** 4 の判定と `scripts/find-browser-code.mjs` の自己検査を、わざと壊して落ちるのを見てから採る([Consequences](#consequences))

## Consequences

- **失うもの: 統合の全体の割合から node のコードが抜ける。** 統合のカバレッジの報告だけを見ても、src の全部のうちどこまでをテストが通ったかは分からない。
  node でしか動かないコードは、代わりに単体の全体の床100が止める(Decision の3)。どちらでも測らないファイルは設定を読む時点で落ちる(Decision の4)
- **ブラウザで動く純粋モジュールは、単体で100%にし、統合では全体の床にだけ入る。** 単体のファイル別100%(0014)で100%にし、統合では全体の床(Decision の2)に数える。
  単体テストだけが通る防御の分岐(起きない値の検査など)は、統合の全体の床を下回らない間は統合で届かないまま残せる。増えて床を下回ると統合の門が落ちるので、
  統合テストで届かせるか、振る舞いを変えずに分岐の生まれない形へ書き換える。
  E2E を名指しする注釈はフックとコンテナの `index.tsx` にしか置けない(`scripts/check-coverage-ignores.mjs`)ので、純粋モジュールの行は注釈で外せない
- **統合の全体の床は、統合テストを足しても上がらない。** 床は Decision の2の実測の値で止めてあり、届く所が増えても自動では上がらない。届かない所が減った分は、床を上げない限り次に増える分の余白になる
- **決めた時点の実測と、統合テストを足した後の実測。** 2026-10-20、`7bf8bcb` の上にこの決定の統合の設定だけを入れた作業ツリーで `npm run test:integration -- --coverage` を走らせると、
  89ファイル・329件がすべて通り(約58秒。走らせ始めたときに、ほかの Vitest・Playwright の処理は無かった)、分母は182ファイルで文 97.44%(2934 中 2859)・分岐 93.98%(1579 中 1484)・関数 99.27%(688 中 683)・行 98.66%(2541 中 2507)だった。
  100%に届かないのは34ファイルで、どれも純粋モジュールの置き場(コンポーネントの utils・`src/lib/`・`src/utils/`)のファイル(0%のファイルは無い)。フックとコンポーネントのファイル別100%は、どれも落ちなかった。
  この決定と同じ変更で統合テストを足した後(95ファイル・351件)は、同じ日の実測で Decision の2の値(文 98.46%・分岐 96.2%・関数 99.56%・行 99.48%)になり、100%に届かないのは28ファイルになった。
  単体の全体の床100も、同じ変更で `src/app/` の単体テスト(17ファイル)を足した後の同じ日の実測で、`npm run test:coverage`(119ファイル・1688件)の分母118ファイルが
  文 100%(2095 中 2095)・分岐 100%(1126 中 1126)・関数 100%(468 中 468)・行 100%(1762 中 1762)になった(分母のうち `src/app/` のコードの17ファイルも、文 61・分岐 16・関数 24・行 54 のすべてを通った)。
  `src/app/` の単体テストは描かずに(`render` を使わず)、ルート・枠・画面のローダーの関数を呼んで返る React 要素の型と props、書き出すメタデータを見る。
  単体には `*.test.tsx` を置けない([../quality/test-strategy.md](../quality/test-strategy.md) の「テストの境界」)ので、子に渡す要素は JSX ではなく `createElement` で作る
- **新しい検査は落ちるのを見た(Decision の5)。** 2026-10-20、上の作業ツリーで、次のそれぞれを入れて `npm run test:integration` を走らせ、設定を読む時点で投げるのを見てから戻した
  - 入口の起点を在らないフォルダにする → 入口が1つも無いと投げた
  - `src/components/ui/` に、どこからも import されない `index.tsx` でない `.tsx` を1つ置く → 統合の分母にも単体の `coverage` にも入らないと、そのファイルを名指しして投げた(単体の設定が `src/components/**/*.tsx` を外すため)
  - ブラウザで動く `src/utils/day-phase.ts` の隣に、拡張子だけが違う `day-phase.tsx` を置く → 測る物と分母が食い違うと、`day-phase.tsx` を名指しして投げた(`src/utils/day-phase.ts` の glob が contains で当たった)
  - `scripts/find-browser-code.mjs` の型だけの import を飛ばす1行を消す → 自己検査が、型だけのファイルが分母に入ると投げた
- **設定を読む時間が増える。** 自己検査を含む `scripts/find-browser-code.mjs` の読み込みが321ms、入口からたどるのが156msだった(2026-10-20、上の作業ツリーで node から1回読んで測った)。
  統合の設定は単体の設定(`vitest.config.ts`)も読むので、単体の設定の読み込み(`scripts/gate-targets.mjs` の src のたどりと自己検査)の分も足される
- **単体の設定を変えると、統合の設定の読み込みも落ちうる。** 単体の `coverage` の include・exclude を狭めて、ブラウザで動かないファイルがどちらでも測られなくなると、`npm run test:integration` が設定を読む時点で落ちる。
  単体の設定の形(`test.coverage.include`)を読めなくなったときも投げる
- **見るのは、import の文でたどれるつながりだけ。** 次のものは分母の決め方に入らない
  - 束ねるときの差し替え。`next.config.ts` は本番の束で `linkedom` を `src/utils/linkedom-browser-stub.ts` へ差し替えるので、このファイルは本番ではブラウザで動く。
    統合テストの Vite の設定にはこの差し替えが無く、統合テストでも読み込まれないので、分母に入れず単体で測る
  - パッケージの中から src を読む形・`fs` で読むファイル・文字列で書くだけのパス
  - `src/app/` に置いたクライアントの部品(`'use client'`)。入口は src/components とフックだけなので、`src/app/` の部品はブラウザで動いても分母に入らず単体で測る。2026-10-20 の時点で `src/app/` に `'use client'` を書いたファイルは無い
- **入口から届くのに、どの統合テストも描かない部品は、分母に残って0%になり落ちる。** 使われない部品を黙って残さないための向きで、ファイル別100%の門(フックとコンポーネント)と同じ。
  入口から届かない、`index.tsx` でないコンポーネントの `.tsx` は、統合の分母にも単体の `coverage` にも入らないので、設定を読む時点で落ちる
- **統合テストから直接 import されるだけのファイルは、分母に入らない。** 入口から届かず統合テストのファイルからだけ届くファイルは、統合テストで通っても統合の分母に入らず、単体で測る。
  2026-10-20 の時点で、統合テストのファイルから届く、テストの側でない src のファイルは、どれも入口からも届いた

## Alternatives Considered

- **分母は src の全部のまま、統合の全体の床を実測から2pt引いた値のままにする** — 全体の床に node の0%が混ざり、床が100にならない。ブラウザで動くコードに統合テストの通らない行が増えても、床までは気付けない。利用者の「ファイルごとに1か所で100%」と合わない

ここから下は、この ADR を書くときに比べた案。

- **node でしか動かないファイルを、手で並べた一覧で `coverage.exclude` に入れる** — 新しい node のファイルを足し忘れる、ブラウザで動くファイルを誤って外しても気付けない。
  `src/app/` のルートグループ(`(ja)`)と動的な経路(`[slug]`)は glob で意味を持つ文字なので、パスをそのまま exclude に書くと別の物に当たる。import のつながりで決め、設定を読むたびに求める
- **分母は src の全部のまま、`thresholds.perFile` で全部のファイルを100%にする** — node でしか動かないファイルが0%で落ちる。分母を変えない限り成り立たない
- **単体と統合のカバレッジの報告を合わせて、1つの床で見る** — 2つの設定(node と実際の Chromium)の報告を合わせる道具が要る。この記録の時点では試していない
- **統合テストのファイルも入口にする** — 2026-10-20 の時点では分母が変わらない(Consequences の最後)。テストが期待の値を作るためだけに import する純粋モジュールが、部品から使われなくても分母に入るので、ブラウザで動くコードの決め方にしない
- **`next.config.ts` の束ねるときの差し替えもたどる** — 統合テストの Vite では差し替えが起きないので、差し替え先(`src/utils/linkedom-browser-stub.ts`)が分母に入って0%のまま落ちる

ここから下は、統合の全体の床の値(Decision の2)を決めるときに比べた案(2026-10-20)。

- **ブラウザで動くコードの分母のまま、統合の全体の床を100にする** — 届かない所は画面からは届かない防御の分岐なので、統合テストを足しても届かない。
  製品のコードを書き換えて分岐を無くさない限り成り立たない
- **単体が測るファイル(純粋モジュール)を統合の分母から外し、残りで100にする** — 残るのはフックとコンポーネントだけで、どれも既にファイル別100%で固めている。
  分母を減らして数字が上がるだけで、門が新しく守る物は無い
- **届かない行を `v8 ignore` の注釈で外して100にする** — 注釈を置けるのはフックとコンテナの `index.tsx` で、その行を見る E2E を名指しする形だけ(`scripts/check-coverage-ignores.mjs`)。
  純粋モジュールの行には置けない
