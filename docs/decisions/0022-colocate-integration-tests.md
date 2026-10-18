---
status: historical
read_when:
  - 統合テストをどこに置き、どう名付けるかを問われたとき
  - 統合テストをリポジトリ直下などの1か所へ集め直したくなったとき
  - 表示部品(`index.tsx`)に自分のテストを置きたくなったとき
source_of_truth: false
last_reviewed: 2026-10-18
---

# 0022. 統合テストをコンテナのフォルダに置き、1本なら隣の `container.integration.test.tsx`、2本以上ならそのフォルダの `__tests__` に置く

## Status

Accepted(2026-10-18、利用者の決定)。統合テスト(`*.integration.test.tsx`)とその部品を、リポジトリ直下の `__tests__` から、そのテストが描くコンテナ(`container.tsx`)のフォルダへ移す。
[0019](0019-hooks-make-containers.md) の次の部分を置き換える。

- Decision の「テストの置き場」のうち、統合テストを `src/` の外のリポジトリ直下の `__tests__` に置き、
  unit のフォルダ(`src/components/` の下のフォルダの道を kebab-case にしたもの)と、その下の状態コンテナの名前の kebab-case のフォルダで分ける部分。
  I/O コンテナの6つの外にある状態コンテナが自分で unit になる部分も、unit が無くなるので無くなる。
  ただし、コンテナ(`container.tsx`)を `src/components/<名前>/`(`ui` の下は `src/components/ui/<名前>/`)の下に限る検査は残す([機械が守らせる所](#機械が守らせる所))
- 同じ節の、統合テストが1本でも動作ごとの名前(`<動作>.integration.test.tsx`)にする部分。1本のときは対のファイル `container.integration.test.tsx` になる
- 同じ節の、`container.fixture.ts` を unit のフォルダの直下に、統合テストだけが使う `*.test-helper.ts` をそれを使う unit のフォルダに置く部分
- 「機械が守らせる所」のうち、上の置き場に合わせた検査(コンテナに対応する `__tests__` のフォルダ・どのコンテナにも対応しないフォルダ・1つの unit の中で名前が重なること・`container.fixture.ts` が unit のフォルダの直下にあること)と、
  テストを見る道具をリポジトリ直下の `__tests__` へ向けた部分
- 「カバレッジ」の「表示部品は、今までどおり全体の床にだけ入る」と、Alternatives Considered の「すべての `.tsx` をファイル別100%にする — 採らない」。表示部品もファイル別100%にする([カバレッジ](#カバレッジ))
- Alternatives Considered の「統合テストをコンテナの隣に置く — 利用者がリポジトリ直下の `__tests__` を選んだ」

[0011](0011-extreme-constraints.md) は、テストの境界を変えるには新しいADRを求める。統合テストの置き場と名前は、0019 がテストの境界として決めたものなので、このADRで決める。

次のものは変えない。

- `hooks`フォルダにテストとテストの部品を置かない・どのテストでも`renderHook`を使わない(0011)
- フック(`hooks` フォルダの中のファイル)と全部の `container.tsx` の、統合のカバレッジのファイル別100%(0018・0019)と、統合テストで届かない行だけを E2E を名指しする注釈で外す決まり(0018)
- コンテナと表示部品の定義とファイルの形(0019)、コンテナごとに統合テストが1本以上あること、統合テストが自分のコンテナを(型だけでなく)import して描くこと
- 統合テストの側は何を import してもよく、統合テストの外のテストの側(`*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`)はコンポーネントを描く道具(`@testing-library/react`・`react-dom` とその下)を import しないこと
- 単体テスト(`*.test.ts`)をモジュールの隣に置くこと、E2E を `tests/` に置くこと
- 親と子の役割と props の作り方(0019)、モックはネットワークと時間だけ(0017 の D6)

## Context

決める前(`ba8229c`)のこのリポジトリは次の状態だった。

- **統合テストは87本で、全部がリポジトリ直下の `__tests__` の下にあった**(0019)。統合テストの部品の20個(`*.test-helper.ts` が16個、`container.fixture.ts` が4個)も同じ所にあった
- `__tests__` の下は、I/O コンテナの6つの unit のフォルダ(`story`・`directory`・`village-page`・`ui/settings-menu`・`ui/pageview-counter`・`ui/scene-player`)と、その下の状態コンテナの名前の kebab-case のフォルダに分かれていた。
  例えば一覧の作品カード WorkCard(`src/components/Directory/components/WorkCard/container.tsx`)の統合テストの8本は、`__tests__` の下の `directory` の下の `work-card` にあり、
  `src` の中の WorkCard のフォルダにはテストのファイルが1つも無かった
- `container.tsx` は22個(I/O コンテナが6つ、状態コンテナが16個)で、どれも統合テストを1本以上持っていた。1本だけのものは村の Boot・ClockModal・Ground・Joystick・Lighting の5つで、残る17個は2本以上だった
- 表示部品(フックを呼ばない `index.tsx`)は自分のテストを持たず、それを描くコンテナの統合テストに覆われていた。
  統合のカバレッジのファイル別100%はフックと `container.tsx` だけに掛かり、表示部品は全体の床にだけ入っていた(0019 の「カバレッジ」)
- 0019 は、Alternatives Considered で「統合テストをコンテナの隣に置く」を、利用者がリポジトリ直下の `__tests__` を選んだとして採らなかった(2026-10-17)

2026-10-18、利用者が統合テストをコンテナの隣へ移すと決めた。理由は利用者の次の言葉(利用者の言葉を日本語にした。以下も同じ)。

- 「WorkCard のフォルダの `container.tsx` の隣に、対になるテストのファイルが無い。テストに包まれているという感じがまったくしないので、人が自分で確かめに行かなければならない」

形は、AskUserQuestion での利用者の答えで決めた。

- 置き場: 「`__tests__` は、テストの役割が2つ以上のときに作りたい。`index.integration.test` のような形で対にして作り、1つなら」(答えはここで途切れた)。
  途切れた所を確かめる問いに、利用者は「合っている: 1つは対、2つから `__tests__`」と答えた
- 自分のテストを持つもの: 「コンテナだけが自分のテストを持つ」
- 表示部品のカバレッジ: 「表示部品も100%」

## Decision

### 置き場と名前

1. **統合テスト(`*.integration.test.tsx`)は、`container.tsx` のあるフォルダ(以下「コンテナのフォルダ」)にだけ置く。**
   - そのコンテナの統合テストが1本なら、`container.tsx` の隣の `container.integration.test.tsx`(対のファイル)
   - 2本以上なら、コンテナのフォルダの `__tests__` の下の `<動作>.integration.test.tsx`(kebab-case。名前は 0019 の動作ごとの名前のまま)。`__tests__` の下にフォルダを作らない
   - 1つのコンテナのフォルダに、対のファイルと `__tests__` を両方は置かない。`__tests__` の下の統合テストが1本だけなら、対のファイルにする
   - ほかの所には置かない。表示部品(`index.tsx`)の隣、`hooks` フォルダの中、コンテナのフォルダでない所の `__tests__`、`__tests__` の下のフォルダ、リポジトリ直下の `__tests__` のどれも落ちる
   - 統合テストは、自分のフォルダのコンテナを import する。対のファイルは `./container`、`__tests__` の下は `../container` で、同じファイルを別名で書いた `@/components/.../container` も数える。
     型だけの import は数えない。全部の `container.tsx` が統合テストを1本以上持つ(今までどおり)
   - 対のファイルの名前は、対にする相手の `container.tsx` に合わせて `container.integration.test.tsx` にする。利用者が形の例に挙げた `index.integration.test` の名前は採らない。
     0019 の Alternatives Considered が `index.integration.test.tsx` を退けた理由(画面のフォルダの `index.tsx` はサーバのローダーで、テストの名前と描く相手がずれる)がそのまま当たり、
     表示部品は自分のテストを持たない(下の2)ので、`index.tsx` に対にするテストも無い
2. **表示部品は自分のテストを持たない。** 自分のテストを持つのはコンテナだけ。表示部品は、それを描く親のコンテナの統合テストが覆う
3. **統合テストの部品(統合テストか `__tests__` の中のファイルが import する `*.test-helper.ts`・`*.fixture.ts`。部品が import する部品も)と `container.fixture.ts` は、コンテナのフォルダの `__tests__` の下か、`container.tsx` の隣にだけ置く。**
   - `container.fixture.ts`(node でしか組めない props を組む globalSetup)は、I/O コンテナの6つ(一覧の正本は `scripts/container-dirs.mjs`)のものだけ
   - 複数のコンテナのテストが使う部品は、それらのコンテナを包むいちばん近いコンテナの側に置く。
     例えば作品ストーリーの画面のテストと TechChipPopover のテストが使う部品は、2つを包む作品ストーリーの I/O コンテナの側の `src/components/Story/__tests__/chip-popover.test-helper.ts`
   - 単体テストだけが使う部品(`src/lib/pixel/png.test-helper.ts`・`src/lib/village/movement.fixture.ts` など)は、今までどおりそれを使う単体テストの隣に置く
4. **`__tests__` に置ける名前は `*.integration.test.tsx`・`*.test-helper.ts`・`container.fixture.ts`・`*.md` だけ**(0019 のまま)。単体テストの `*.test.ts` は今までどおりモジュールの隣に置き、`__tests__` には置かない
5. **リポジトリ直下の `__tests__` は無くす。** あれば落ちる
6. **`container.tsx` は、今までどおり `src/components/<名前>/`(`ui` の下は `src/components/ui/<名前>/`)の下にだけ置ける。** unit は無くなるが、この置き場の決まりは残す。
   `src/app/`・`src/lib/` などに置くと、`scripts/check-layers.mjs` がそこを許す側として見るので、そのコンテナが外の世界に触れても見逃すため

### この記録と同じ作業で移すもの

統合テストの87本と部品の20個を、上の置き場へ移す。移すときにテスト(`test(…)` の名前と断定)は変えず、消さない。

統合テストが1本だけの5つのコンテナでは、その1本の名前を `container.integration.test.tsx` に変える。前の置き場は、どれもリポジトリ直下の `__tests__` の下の `village-page` の下の、コンテナの名前の kebab-case のフォルダだった。

| コンテナ   | 前の名前                            | 移した先                                                                                             |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Boot       | `logo-flight.integration.test.tsx`  | `src/components/VillagePage/components/Boot/container.integration.test.tsx`                          |
| ClockModal | `pick-time.integration.test.tsx`    | `src/components/VillagePage/components/Village/components/ClockModal/container.integration.test.tsx` |
| Ground     | `sprite-cells.integration.test.tsx` | `src/components/VillagePage/components/Village/components/Ground/container.integration.test.tsx`     |
| Joystick   | `knob-drag.integration.test.tsx`    | `src/components/VillagePage/components/Village/components/Joystick/container.integration.test.tsx`   |
| Lighting   | `light-boxes.integration.test.tsx`  | `src/components/VillagePage/components/Village/components/Lighting/container.integration.test.tsx`   |

残る82本は、統合テストを2本以上持つ17個のコンテナのフォルダの `__tests__` の下へ、名前を変えずに移す
(例: 作品カードの8本は `src/components/Directory/components/WorkCard/__tests__/`、村の画面全体を描く33本は `src/components/VillagePage/__tests__/`)。
部品の20個も名前を変えずに、前に置いていたフォルダに当たるコンテナの `__tests__` の下へ移す。unit のフォルダの直下にあったものは I/O コンテナの `__tests__`、
状態コンテナのフォルダにあったもの(StopModal・TalkBubble・WorldMap の部品)はその状態コンテナの `__tests__` で、どれも上の3の「いちばん近いコンテナ」に当たる

### カバレッジ

- **表示部品も、統合のカバレッジでファイル別100%(文・分岐・関数・行)にする。** この ADR で決め、門(`vitest.integration.config.ts` のファイル別の閾値)は、この ADR の後の commit で掛けた。
  画面の3つのサーバのローダー(画面のフォルダの `index.tsx`。表示部品ではない)は、ビルドの時に node でだけ走り統合テスト(ブラウザ)では測れないので、
  門に入れず全体の床にだけ入れる。外すのは名前を並べた一覧(`SCREEN_LOADERS`)で、一覧が画面のフォルダの一覧(`scripts/container-dirs.mjs` の `SCREEN_CONTAINER_DIRS`)の `index.tsx` と同じか・名前が実物にあるかを設定を読む時点で確かめる
- フックと `container.tsx` のファイル別100%と、E2E を名指しする注釈で外す決まりは変えない

### 機械が守らせる所

- **`npm run test:boundary` が上の置き場を守らせる。** 次のときに落ちる
  - 統合テストがコンテナのフォルダの外にある(表示部品の隣・`hooks` フォルダの中・コンテナのフォルダでない所の `__tests__`・`__tests__` の下のフォルダ・リポジトリ直下の `__tests__`)
  - 統合テストの名前が決まりと違う。`container.tsx` の隣に置けるのは `container.integration.test.tsx` だけで、
    `__tests__` の下は kebab-case の `<動作>.integration.test.tsx`(`container.integration.test.tsx` という名前は置けない)
  - コンテナのフォルダでない所の `__tests__` か、`__tests__` の下のフォルダに、ファイルがある(統合テストに限らず、中のどのファイルでも)
  - 1つのコンテナのフォルダに、対のファイルと `__tests__` が両方ある(`__tests__` の中が部品だけでも)。`__tests__` の下の統合テストが1本だけ
  - `container.tsx` に統合テストが1本も無い。統合テストが自分のフォルダのコンテナを(型だけでなく)import していない
  - 統合テストか `__tests__` の中のファイルが import する `*.test-helper.ts`・`*.fixture.ts`(部品が import する部品も)が、コンテナのフォルダの `__tests__` の下と `container.tsx` の隣の外にある
    (単体テストだけが使う部品は、今までどおりそのテストの隣)。`container.fixture.ts` が I/O コンテナの6つのフォルダの外にある
  - `__tests__` の下に、`*.integration.test.tsx`・`*.test-helper.ts`・`container.fixture.ts`・`*.md` のほかの名前のファイルがある
  - リポジトリ直下に `__tests__` がある
  - `container.tsx` が `src/components/<名前>/`(`ui` の下は `src/components/ui/<名前>/`)の下の外にある(`src/app/`・`src/lib/` など、`src/components/`・`src/components/ui/` の直下。上の6)
  - I/O コンテナの6つの一覧(`scripts/container-dirs.mjs`)を変える(7つめを足すなど)。検査の自己検査が6つのパスを固定しているので、自己検査が落ちる。一覧を変えるには ADR が要る

  0019 の「どのコンテナにも対応しない `__tests__` のフォルダ」と「1つの unit の中で、状態コンテナの kebab-case の名前が重なる」は、unit が無くなり、
  テストがコンテナのフォルダの中に入るので、上の「コンテナのフォルダでない所の `__tests__`」に替わる

- **単体の `vitest.config.ts` は、統合テスト(`*.integration.test.tsx`)と `__tests__` の下を拾わない。** 統合テストは `src` の下へ入り、名前が単体の `include` の `src/**/*.test.tsx` に当たるので、exclude で外す。
  拾うと node の環境で描いて落ちる。変異テスト(Stryker)も単体の設定を使うので、統合テストを走らせない
- **テストを見る道具は新しい置き場を見る。** tsc(`tsconfig.json`)・ESLint・Prettier(`npm run format:check`)・`scripts/check-docs.mjs`・`scripts/check-layers.mjs`(テストは import を許す側)・`scripts/check-hook-rule.mjs`(lint の対象の外になっていないこと)。
  リポジトリ直下の `__tests__` を指していた所はそれを外し、移した先が見落とされて検査の外に出ることを作らない。統合の `vitest.integration.config.ts` は、統合テストと `container.fixture.ts` を新しい置き場から拾う

## Consequences

- **コンテナのフォルダを開けば、そのコンテナのテストが見える。** 統合テストが1本なら `container.tsx` の隣に `container.integration.test.tsx` があり、2本以上なら隣に `__tests__` がある。
  利用者が挙げた、テストのファイルを探しに行く手間([Context](#context))が無くなる
- **統合テストの本数が1本と2本の間で変わると、ファイルを動かす。** 1本から2本へ増やすときは、対のファイルを `__tests__` の下の動作の名前のファイルへ移してから2本目を足す。
  2本から1本へ減るときは、残る1本を対のファイルへ戻す。どちらも動かし忘れると `npm run test:boundary` が落ちる
- **失うもの: 統合テストの全部がリポジトリ直下の1か所に集まっていた形。** 1つのフォルダを開いて統合テストの全部を見渡すことはできなくなり、`__tests__` は1か所から17か所に分かれる。
  全部を並べるには `git ls-files '*.integration.test.tsx'` のように名前で探す
- **単体テストと統合テストが同じ `src` の下に並ぶ。** 層は今までどおりファイル名で決まる(`*.test.ts` は単体、`*.integration.test.tsx` は統合)。単体の設定は、統合テストを名前と `__tests__` で外し続ける
- **表示部品のどの分岐も、それを描く親のコンテナの統合テストが通らなければ落ちる。** 門は、この ADR の後の commit で掛けた。
  0019 が費用が大きいとして退けた形で、利用者がそれを選んだ
- **部品にフックを1つ足してコンテナにすると、そのフォルダに統合テストが要る**(0019 のまま)。置き場はそのフォルダの中になる(1本なら隣の対のファイル)

## Alternatives Considered

- **リポジトリ直下の `__tests__` に置いたままにする**(0019 の形) — 利用者が退けた([Context](#context))
- **本数に依らず、いつもコンテナのフォルダの `__tests__` に置く** — 採らない。利用者は確かめの問いに「合っている: 1つは対、2つから `__tests__`」と答えた([Context](#context))
- **対のファイルの名前を `index.integration.test.tsx` にする** — 採らない([置き場と名前](#置き場と名前)の1の最後)
- **表示部品にも自分のテストを置く** — 採らない。利用者の決定は「コンテナだけが自分のテストを持つ」
- ほかに比べた案の記録は無い
