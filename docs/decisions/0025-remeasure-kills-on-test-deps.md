---
status: historical
read_when:
  - テストの補助のファイルや、テストが間に挟んで import するファイルを変えたときに、変異テストがどこまで測り直すかを問われたとき
  - 変異テストの結果ファイルの隣の指紋のファイルを消したくなったとき・CI で持ち回るのをやめたくなったとき
  - 変異テストが、変えた所より多くの変異体を測り直す理由を問われたとき
source_of_truth: false
last_reviewed: 2026-10-19
---

# 0025. 変異テストは、テストから import をたどって届くファイルが変わったら、そのテストが前回落とした変異体を測り直す

## Status

Accepted(2026-10-19、利用者の決定)。次の部分を補う(置き換えはしない)。

- [0013](0013-incremental-mutation-on-push.md) の Consequences のうち、`mutate` のファイルが import する別のファイルの変更は鍵にも入らず、そこだけが変わった push では次の全体の実行まで見落としうる部分。
  テストから import をたどって届く src・content のファイルが変わると、次の実行でそのテストが前回落とした変異体を測り直すようになる
- [0023](0023-inherit-latest-mutation-result.md) の Consequences のうち、週1回の `--force` に頼る所に 0013 の穴(`mutate` のファイルやテストが import する別のファイルの変更)が入っている部分と、
  写す元と import する別のファイルが違っても比べない部分。上と同じく、届く src・content のファイルは比べるようになる
- [../agents/verification.md](../agents/verification.md) の、テストが import する補助のファイルだけを変えたとき・変えたファイルを別の純粋モジュールが import しているときに `--force` を付ける決まりをやめる

0023 の、依存パッケージ・設定(`stryker.config.mjs`・`vitest.config.ts`)の変更を全部は測り直さず週1回の `--force` に任せる部分は変えない。
0013 の走らせ方の3段・対象・しきい値と、`0910cf4` からの落とせなかった変異体(Survived・NoCoverage)を引き継がない扱い、[0021](0021-fail-on-mutation-timeout.md) の判定(時間切れを落とす・時間切れを引き継がない)も変えない。
測り直す範囲が広がる向きの変更で、[0011](0011-extreme-constraints.md) が ADR を求める「下げる」向きではないが、0013・0023 が書いた穴の範囲が変わるので記録する

## Context

決める前(`56dcd31`)のこのリポジトリは次の状態だった。

- **Stryker が前回の結果と比べるのは、変異体のあるファイルとテストファイルの中身だけだった。** @stryker-mutator/core 10.0.0 の
  `node_modules/@stryker-mutator/core/dist/src/mutants/mutant-test-planner.js` の `incrementalDiff` は、今の変異体・今のテスト・前回の結果の `files` と `testFiles` に名前の出るファイルだけを読み(`readAllOriginalFiles`)、
  `node_modules/@stryker-mutator/core/dist/src/mutants/incremental-differ.js` の `diff` がその中身の差分で変異体とテストの同じさを決める。
  前回落とした(Killed)変異体は、落としたテストが同じなら使い回す(同じファイルの `mutantCanBeReused`)
- **そのため、テストが import する別のファイルだけが変わると、前回落とした変異体を落としたままと数えていた。** `stryker.config.mjs` の `incremental` の注釈に、
  2026-10-18 の実測として、前回落とした変異体は今は生き残るとしても落としたままと数えるとある。
  逆向き(前回の生き残りを使い回す)は、`0910cf4` から `scripts/run-mutation.mjs` が落とせなかった変異体(Survived・NoCoverage)を引き継がずに毎回測り直している。
  時間切れ(Timeout)を同じ扱いに足したのは 0021(0021 の Context と Decision の2)
- **テストファイルの中は、テストごとではなくファイルごとに比べていた。** @stryker-mutator/vitest-runner 10.0.0 は、テストの結果に位置を付けない
  (`node_modules/@stryker-mutator/vitest-runner/dist/src/vitest-helpers.js` の `convertTestToTestResult` が付けるのは id・名前・かかった時間・ファイル名だけ)。
  Stryker は位置の無いテストをファイルの全部にわたると見る(上の `incremental-differ.js` の `closeLocations`)ので、テストファイルが1文字でも変わると、そのファイルのテストを全部変わったと見る
- **埋め方は、手で `--force` を付けることだった。** [../agents/verification.md](../agents/verification.md) は、テストが import する補助のファイル(`*.test-helper.ts`・`*.fixture.ts`)だけを変えたときと、
  変えたファイルを別の純粋モジュールが import しているときに `npm run test:mutation -- --force` を求めていた。CI(`.github/workflows/deploy.yml`)は `npm run test:mutation` を引数無しで走らせるので、この決まりは CI では効かない
- **Vitest が走らせる単体テスト(`vitest.config.ts`)から import をたどると、補助のファイル(`*.test-helper.ts`・`*.fixture.ts`)に届くものがある。** どの補助のファイルにどのテストが届くかは、
  下の Decision で足した `node scripts/fingerprint-tests.mjs` が出す
- **2026-10-19 に手元で測った。** `56dcd31` の上の作業ツリーで、同じ時間にほかの重い作業は走らせていない。下の Decision の入口は、テストファイル自身を指紋に入れる(Decision の1)前の版で測った
  - 決める前の入口で、補助のファイル `src/lib/village/movement.fixture.ts` を変えて `npm run test:mutation` を走らせると、Stryker は「4074 of 4074 mutant result(s) are reused」と出し、1体も測り直さなかった
  - 下の Decision の入口で、指紋の無い最初の実行は 4074体のうち使い回しが0体で、293秒・点数100。何も変えない次の実行は 4074体すべてを使い回し、37秒
  - そこから `movement.fixture.ts` を変えると、テストファイル4件のテストが前回落とした変異体225体を取り除いて測り直し(使い回しは 3849体)、47秒。
    元へ戻すと、4件・212体を測り直し(使い回しは 3862体)、46秒

2026-10-19、利用者が「影響を受けるテストだけを無効にする」を選んだ。テストの補助のファイル・間に挟んで import するファイルが変わったら、そのファイルに届くテストの前回の結果だけを消す。
依存(`package-lock.json`)・設定(`stryker.config.mjs`・`vitest.config.ts`)の変更は、0023 のとおり週1回の `--force` に任せる。増分の実行の速さは保つ。

## Decision

1. **テストファイルごとに、テストファイル自身と、そこから import をたどって届くファイルの中身の指紋を取る。** 取り方の正本は `scripts/fingerprint-tests.mjs`
   - テストファイルは Vitest に選ばせる(`stryker.config.mjs` の `vitest` の `configFile` を Vitest に渡し、走らせるファイルを聞く)。`vitest.config.ts` の include・exclude を書き写さない
   - import の読み方は `scripts/read-imports.mjs`、先のファイルの決め方は `scripts/resolve-import.mjs`(層の境界検査と同じもの)。型だけの import はたどらない。
     src・content の中を指すのに見つからない import があれば落とす
   - テストファイル自身と届いたファイルのパスと中身の SHA-256 を並べ、その並びの SHA-256 をそのテストファイルの指紋にする
   - **テストファイル自身も指紋に入れる。** 今の Stryker がテストファイルの変更をファイルごとに見る(Context)のは、ランナーがテストの位置を出さないからで、テストごとに比べているのではない。
     ランナーが位置を出すようになると Stryker の比べ方がテストごとに変わるので、そうなってもテストファイルのどこが変わったときもそのファイルのテストが前回落とした変異体を見落とさないよう、指紋の側でもファイルごとに見る
   - 指紋は結果ファイルの隣に置く。名前は結果ファイルの名前から `.json` を除き `.test-deps.json` を付けたもの。git は追跡しない(結果ファイルと同じ)
2. **Stryker を呼ぶ前に、前回の指紋と比べて取り除く。** `scripts/run-mutation.mjs` が、前回の結果ファイルの `testFiles` にあるテストファイルのうち、指紋が違うか、前回と今のどちらかの指紋に無いもののテストが落とした変異体
   (Killed で、`killedBy` にそのテストが1つでも入るもの)を結果ファイルから取り除き、測り直すテストファイルの数と取り除いた数を1行出す。取り除いた変異体は Stryker から見て新しい変異体になり、その回に測り直される
   - 前回の指紋が無い(初めて・指紋の無い結果を引き継いだ・指紋の形の版が違う)ときは、全部のテストファイルを変わったと見る
   - `--force` のときも同じに取り除く(どのみち全部を測り直す)
3. **今の指紋は、取り除いた結果ファイルを書いた後、Stryker を呼ぶ前に書く。** 結果ファイルに残る Killed は、どれも落としたテストの指紋が今と同じものだけになる。
   そのため、この後 Stryker が投げても、割り込まれて途中の結果を書いても、結果ファイルと指紋は食い違わない
4. **ほかの作業ツリーの結果を写すとき(0023 の Decision の2)は、写す元の結果ファイルの隣の指紋を前回の指紋として使う。** 無ければ前回の指紋が無いのと同じ。
   指紋を先に、結果ファイルを後に読む(どの作業ツリーの入口も、取り除いた結果ファイルを先に、指紋を後に書くので、この順なら食い違わない組みを読む)
5. **走り終えたら、その回の結果ファイルで変異体を落としたテストのファイルが、全部今の指紋にあるかを見る。** 無ければ終了コードを 1 にする。
   Vitest に選ばせたテストファイルと Stryker が走らせたテストファイルが食い違うと、指紋に無いテストは毎回「変わった」と見られ、見落としにはならないが毎回測り直して黙って遅くなるため
6. **判定は走るたびに自己検査する。** `scripts/fingerprint-tests.mjs` を読み込むたびに、偽のファイルと偽の結果ファイルで、届くファイルのたどり方・指紋の比べ方・取り除く変異体の選び方を確かめ、期待と違えば投げる
7. **CI は、指紋を結果と一緒に持ち回る。** `.github/workflows/deploy.yml` の結果のキャッシュの復元と保存の `path` に指紋のファイルを足す。鍵と保存の条件は変えない
8. **依存・設定の変更は、0023 のとおり週1回の `--force` に任せる。** 指紋に入れない

## Consequences

- **失うもの: 増分の実行の速さの一部。** 届くファイルが変わったテストが前回落とした変異体(Killed)は、変わった位置に関わらず全部を測り直す。
  テストファイルの指紋には、そのテストが import する `mutate` のファイル自身も入るので、`mutate` のファイルを1行変えても、そのファイルに届くテストが前回落とした Killed の変異体
  (そのファイルの変異体と、そのテストが落とした別のファイルの変異体)を、変えた位置と関係なく全部測り直す。今までは Stryker が変わった所の変異体だけを測り直していた。
  多くのテストが届くファイル(content や共通の utils)を変えると、それだけ多くを測り直す。
  規模は Context の実測で、補助のファイル1つ(`src/lib/village/movement.fixture.ts`)を変えると、テストファイル4件のテストが落とした225体を測り直して47秒(何も変えない実行は37秒)。
  `mutate` のファイルを変えたとき・多くのテストが届くファイルを変えたときの数は、この記録の時点では測っていない
- **この仕組みを入れた後の最初の実行は、前回落とした変異体を全部測り直す。** 前回の指紋がまだ無いため。手元で指紋の無い結果を写したときも同じ。
  Context の実測では、4074体のうち1体も使い回さず293秒だった
- **CI では、この仕組みを入れる前に保存した結果は戻らず、入れた後の最初の push は全部を走らせる。** `actions/cache` はキャッシュの `path` の並びをキャッシュの版(version)に混ぜるので、
  `path` に指紋のファイルを足すと、`restore-keys` の接頭辞(`stryker-incremental-`)が合っても、足す前に保存したものは復元されない。
  これは検討のときに Actions の仕様から判断したもので、入れた後の最初の push の `Restore Stryker incremental result` のログ(`Cache restored from key` か `Cache not found`)で確かめる
- **見るのは、src と content の中で、テストから import の文でたどれるファイルだけ。** 次のものは指紋に入らず、変わっても測り直さない(次の週1回の `--force` まで前回の結果を使う)。
  たどらなかった import(式で組んだ `import()`・src と content の外を指す相対パス)の数は、`node scripts/fingerprint-tests.mjs` が出す
  - 依存パッケージと設定(`package-lock.json`・`stryker.config.mjs`・`vitest.config.ts`)。0023 のまま
  - src と content の外のファイル(`scripts/` など)
  - 式で組んだ `import()` の先・`vi.mock` や `vi.importActual` に文字列で書くだけのパス・`fs` で読むファイル。指紋は import の文だけを読む。
    2026-10-19 の時点で `src` と `content` にある `fs` の読み出しは次のもの
    - `src/components/VillagePage/components/Village/utils/marker-colors.test.ts` が、`src/components/VillagePage/components/Village/components/WorldMap/world-map.module.css` を読む
    - `src/utils/scene-durations.test.ts` が、`public/works/` の下の場面の SVG を読む(src と content の外でもある)
    - `src/lib/content/read.ts` と `src/lib/content/validate.test.ts` が、`content/ja/works` のファイルの一覧を読む。
      `read.ts` が import する作品のファイルの中身は指紋に入るが、どこからも import しないファイルを足しただけの変更(一覧だけが変わる)は入らない
    - `src/utils/linkedom-browser-stub.test.ts` が、依存パッケージの budoux の `node_modules/budoux/module/` の下の `.js` を読む(依存パッケージの変更に当たる)
  - 型だけの import の先(実行時に読み込まれないので、変わってもテストの結果は変わらない)
- **Killed でない結果の引き継ぎは変わらない。** CompileError・RuntimeError・Ignored は今までどおり引き継ぎ、届くファイルが変わっても測り直さない。
  Survived・NoCoverage(`0910cf4` から)と Timeout(0021 から)は今までどおり毎回測り直す
- **`npx stryker run` を直接叩くと、取り除きも指紋の書き込みも走らない。** その後に `npm run test:mutation` を走らせると、直接叩いた回の結果がその前の指紋と組みになり、
  直接叩いた後に届くファイルを前の中身へ戻した変更を見落としうる。この仕組みの無い版の入口で結果ファイルを書き換えた作業ツリーから結果を写すときも同じ
- **手元の実行の最初に、Vitest にテストファイルを聞いて import をたどる時間が足される。** かかった時間は `node scripts/fingerprint-tests.mjs` が出す。この記録の時点では、変異テストの全体の時間と比べて測っていない
- 指紋のファイルが消えたり読めなかったりしても見落としにはならない(全部のテストファイルを変わったと見る)。指紋の取り方を変えて形の版を上げたときも同じ
- 単独で `node scripts/fingerprint-tests.mjs` を走らせると、何も書かずに、補助のファイルごとに届くテストファイルと、次の実行が取り除く変異体の数を出す。補助のファイルを変える前に、どれだけ測り直すかを見られる

## Alternatives Considered

- **今のまま、補助のファイルを変えたときに手で `--force` を付ける** — 決まりが手元の作業者にしか効かず(CI は引数無しで走らせる)、忘れると見落とす。利用者が「影響を受けるテストだけを無効にする」を選んだ

ここから下は、この ADR を書くときに比べた案。

- **届くファイルのどれかが変わったら、前回の結果を全部捨てる** — 1つの変更で全部を走らせ、増分の実行の速さを失う。利用者の「影響を受けるテストだけ」と合わない
- **変異体のあるファイル自身は、その変異体を比べるときだけ指紋から外す(そのファイルの中は Stryker の場所ごとの比べ方に任せる)** — 同じファイルの別の所が変わっても、前回落とした変異体を今も落とせるとは限らない。
  テストファイルごとの指紋ではなく、届くファイルごとの中身を残して変異体ごとに比べる形になり、判定も増える。採らなかった
- **テストファイル自身は指紋から外し、テストファイルの中は Stryker の比べ方に任せる** — Stryker の比べ方は、ランナーがテストの位置を出すかどうかで、ファイルごとかテストごとかが変わる(Context)。
  ランナーの版が変わったときに、測り直す範囲が黙って狭まりうる。採らなかった(Decision の1)
- **`vitest.config.ts` の include・exclude と同じ規則を書いてテストファイルを選ぶ** — 規則を2か所に持つと食い違う。Vitest に選ばせる
- **指紋を Stryker が走り終えた後に書く** — 割り込まれて途中の結果が書かれると、それが古い指紋と組みになり、届くファイルを前の中身へ戻したときに見落とす。取り除いた後に書けば、どの終わり方でも食い違わない
- **依存・設定のファイルも指紋に入れる** — 利用者が、0023 のまま週1回の `--force` に任せると決めた
