---
status: active
read_when:
  - テストを足す・直すとき
  - どのテストを走らせるか決めるとき
  - ロジックをどこに置き、どのテストで固めるか決めるとき
source_of_truth: true
last_reviewed: 2026-10-20
---

# テスト

## 方針

人はコードを読んでレビューしない。代わりに制約(テスト・検査)を極端に多く置き、すべて通ったものを信頼する([../decisions/0011-extreme-constraints.md](../decisions/0011-extreme-constraints.md))。

層の考え方はテスティングトロフィー(静的・単体・統合・E2E)で、統合を一番厚くする([../decisions/0016-testing-trophy-browser-integration.md](../decisions/0016-testing-trophy-browser-integration.md))。
**層は実行環境とファイル名で機械的に決まる**([4層](#4層))。どれだけモックしたかでは決めない(機械で判定できないため)。
テストを書くときの拠り所は次の4つで、引用の出典は ADR 0016 にある。

1. **実際の使い方に似るほど信頼が増す。** 断定は利用者に見えるもの(role・名前・`aria-*`・要素の有無)で行う
   (Testing Library「The more your tests resemble the way your software is used, the more confidence they can give you.」)
2. **確かめられる一番小さい層に置く**(Microsoft「Write tests at the lowest possible level」)
3. **上の層でバグが出たら、下の層にテストを足す**
   (Ham Vocke「If a higher-level test spots an error and there's no lower-level test failing, you need to write a lower-level test」)
4. **本物の実装を先に使い、モックはネットワークと時間だけにする**
   (Kent C. Dodds「When you mock something you're removing all confidence in the integration between what you're testing and what's being mocked.」)

- ロジックは純粋関数(`src/lib/`・`src/utils/`・コンポーネント専用のutils)に置き、単体テスト・ファイル別カバレッジ100%・ミューテーションで固める
- フックとコンポーネントは配線だけを持つ。`hooks`フォルダに単体テストを置かず、どのテストでも`renderHook`を使わない([テストの境界](#テストの境界))。
  フックを1つでも呼ぶコンポーネント(と I/O コンテナの6つ)はコンテナで、コンテナはどれも自分の統合テストを持つ。ファイルの名前はコンテナも表示部品も `index.tsx`。フックと、フックを呼ばない表示部品は、それを使うコンテナを統合テストで描いて見る(表示部品は自分のテストを持たない)。
  コンポーネントを描くテストは、コンテナのフォルダに置く統合テスト(`*.integration.test.tsx`)だけ([統合テストの約束](#統合テストの約束)。[../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md)・[../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md)・[../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))
- 制約は上げる方向にだけ動かす。下限を下げる・テストを消す・変異テストやファイル別100%の対象から外す・テストの境界の決まりを変えるにはADRが要る

## 4層

| 層                                      | 置き場・ファイル名                                                                                                                                                                  | 対象                                                                                                                                                                                                                                                                                                                           | 環境                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 静的                                    | —                                                                                                                                                                                   | 型・lint(レイヤー境界を含む)・整形・文書の参照(`npm run typecheck`・`npm run lint`・`npm run format:check`・`npm run docs:check`)                                                                                                                                                                                              | ソースをそのまま読む                                                                                                                                                                                                 |
| 単体(Vitest)                            | 対象ファイルの隣 `*.test.ts`                                                                                                                                                        | **純粋関数**と、`fetch`・Storage を `vi.stubGlobal` で差し替えて測る `src/lib/` の入口。DOMを使う(読む・書く・DOMParser)utils(歩行ループの部品など)。**コンポーネントを描くテストと、フックを`renderHook`で呼ぶテストは置かない**([テストの境界](#テストの境界))                                                               | `environment: 'node'`(既定)。DOM を持たない。DOMを使う(読む・書く・DOMParser)utilsだけは、ファイル先頭の`// @vitest-environment happy-dom`でそのファイルだけhappy-domで走る                                          |
| 統合(Vitest Browser Mode。一番厚くする) | コンテナのフォルダの `*.integration.test.tsx`(1本ならコンテナの `index.tsx` の隣の `index.integration.test.tsx`、2本以上ならそのフォルダの `__tests__` の下。コンテナごとに1本以上) | **コンテナ(フックを1つでも呼ぶコンポーネントと、I/O コンテナ)を、フック・子と一緒に描く。** コンポーネントを描くテストはこの層だけ。村も含む。モックはネットワーク(天気など)と時間だけ                                                                                                                                         | 実ブラウザ(Chromium 1つ、headless)で、ビルド無しで走る(`vitest.integration.config.ts`・`npm run test:integration`)。ブラウザの時間帯は UTC に固定する。置き場と分け方の決まりは[統合テストの約束](#統合テストの約束) |
| E2E(Playwright)                         | `tests/**/*.spec.ts`                                                                                                                                                                | **ビルド結果でしか確かめられないもの**(静的経路・404・初回ペイント前のテーマ・言語の接頭を保つ移動・保存が塞がれた時・ビルドが焼いたスプライトの絵)と、**ページをまたぐ核心の旅程**と、**統合テストの中では作れない場合**(再読み込み・`IntersectionObserver` の無い環境・ko の文言。[E2E に残したテスト](#e2e-に残したテスト)) | `out/` を `:4173` で静的配信                                                                                                                                                                                         |

- コンポーネント1つだけを happy-dom で描いていた単体の8本(`index.test.tsx`。ADR 0016 まで「統合」と呼んでいた)は、断定を各コンテナの統合テストへ移して消した。
  `*.test.tsx` はコンポーネントのテストに使わない([../decisions/0017-screen-containers.md](../decisions/0017-screen-containers.md))。
  ただし `IntersectionObserver` の無い環境を見る1件(作品カード)は統合で作れず(テストの中で後から消すと、読み込みの時にそれを覚えた `next/link` が TypeError を投げる)、
  E2E の `tests/observer-missing.spec.ts` へ移した。観察器が無いときの判定は `src/utils/observe-fallback.ts` の単体テスト(ファイル別100%・変異100%)が、
  フックへのつなぎはこの E2E が守る
- ネットワークのモックは今の方式(`vi.stubGlobal`・Playwright の route)で行い、MSW は入れない([ADR 0016](../decisions/0016-testing-trophy-browser-integration.md))
- E2E の配信ポートは既定 `:4173` で、`E2E_PORT` で変えられる(`playwright.config.ts`)
- Vitest の設定は2つのファイルに分かれる。単体の `vitest.config.ts` は `src/**/*.test.ts` と `src/**/*.test.tsx` を拾い、統合テスト(`*.integration.test.tsx`)と `__tests__` の下は exclude で外す(拾うと node の環境で描いて落ちる)。
  統合の `vitest.integration.config.ts` は `src` の下の `*.integration.test.tsx` だけを拾う(コンテナのフォルダの外に置いた `*.integration.test.tsx` と、`*.integration.test.ts`・`*.browser.test.*` は `npm run test:boundary` が落とす)。どちらも `content/` や `tests/` は対象外。
  ファイルを分けたのは、変異テスト(`stryker.config.mjs`)が `vitest.config.ts` を読むため(ブラウザのテストを変異テストに入れない。[ミューテーションテスト](#ミューテーションテスト))
- 純粋関数に切り出せる計算は切り出してから単体テストを書く。`src/lib/village/` と `src/lib/pixel/` がその形になっている
- フィクスチャは `*.fixture.ts`(Vitest の対象から外れる名前)。統合テストの props を node で組むものは、I/O コンテナのフォルダの `index.fixture.ts`([統合テストの約束](#統合テストの約束))
- モジュール変数に覚えを持つ関数(`src/lib/fetch-svg-source.ts` の取得の覚え)は、テストごとに `vi.resetModules()` してから import し直し、空の覚えから始める

### どの層に置くか

**確かめられる一番小さい層に置く。** 小さい層(単体)から順に当てはめ、確かめたいものが再現する最初の層に置く。

- **計算だけ**(入力が同じなら出力も同じ)→ 単体
- **フック・コンポーネントの中のロジック** → 純粋関数へ移してから単体。フックそのもの(配線)は`renderHook`で呼ばず、それを使うコンテナを統合で描いて見る
- **コンポーネントの出し分け**(環境・props・操作で変わる出力。任意の項目を渡すと節が出て外すと消える、押すと開閉してフォーカスが戻る、など)→ 統合。
  そのコンポーネントを含むコンテナを描いて見る。フックを呼ぶ部品なら、それ自身がコンテナで自分の統合テストを持つ([統合テストの約束](#統合テストの約束))
- **コンテナ単位で、フック・子と一緒に動く振る舞い**(実際の配置・寸法・スクロール・rAF・歩行・時間で変わる表示)→ 統合。
  happy-dom は配置を計算せず(作品カードの `getBoundingClientRect()` は幅・高さとも 0 だった)、`ResizeObserver.observe()` は実装が無いので、寸法に頼るものは実ブラウザで見る
- **ビルド結果でしか確かめられないもの**(静的経路・`out/404.html`・初回ペイント前のテーマ・言語の接頭を保つ移動・保存が塞がれた時・ビルドが焼いたスプライトの絵)と、**ページをまたぐ核心の旅程** → E2E
- **統合テストの中では作れない場合**(ページの再読み込み・`IntersectionObserver` の無い環境・統合のフィクスチャが渡さない ko の文言)→ E2E。
  統合テストで同じ欠陥を落とせない E2E は消さずに残す([E2E に残したテスト](#e2e-に残したテスト))
- **上の層でバグが出たら、下の層にテストを足す。** E2E で見つかった欠陥は、統合か単体にもそれを落とすテストを足す
- **村(`src/components/VillagePage/`)も統合の対象にする。** 描画が実際の寸法と rAF の歩行ループに依存し、happy-dom では確かめたいものが再現しないので、
  村の画面は実ブラウザの統合テストで描く(ADR 0016。[../decisions/0009-widen-happy-dom-test-scope.md](../decisions/0009-widen-happy-dom-test-scope.md) の「村のコンポーネントを描く統合テストは引き続き作らない」を置き換えた)。
  DOMを使うutils(rAFと`performance.now`を偽物に替えた歩行ループの部品など)を単体で測るのは今までどおり。
  村のフックも`renderHook`のテストは作らず、村の画面を統合で描いて見る

### 統合テストの約束

実ブラウザでコンテナを描くテスト(コンテナのフォルダの `*.integration.test.tsx`)の約束。例は村の `src/components/VillagePage/`(画面全体を描く `src/components/VillagePage/__tests__/fishing.integration.test.tsx`、
状態コンテナを直接描く `src/components/VillagePage/components/Village/components/StopModal/__tests__/stop-actions.integration.test.tsx`、1本だけの対のファイル `src/components/VillagePage/components/Boot/index.integration.test.tsx` など)。
コンテナの定義と分け方は [../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md)、テストの置き場と名前は [../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md)、コンテナのファイルを `index.tsx` にすることと対のファイル・フィクスチャの名前は [../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md) で決めた。

- **コンテナ。** `src/components/` の下の `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)のうち、フックを1つでも呼ぶものと、I/O コンテナの6つのフォルダのものがコンテナ。ほかの `index.tsx`(フックを1つも呼ばない)は表示部品。
  ファイルの名前はどれも `index.tsx` なので、コンテナかどうかは名前ではなく中身で決まる。`container.tsx` という名前のファイルは置かない
  「フックを呼ぶ」は、呼ぶ相手の名前が `use` と大文字か数字で始まる呼び出し(`useX(…)`・`React.useX(…)`)で、React の組み込みのフック(`useState`・`useMemo`・`useId` など)も例外なく数える。`memo()`・`forwardRef()` はフックではない
  - **I/O コンテナ。** 外の世界の入口(content の読み出しを除く。読むのは画面のローダーだけ)を import してよいコンテナで、`scripts/container-dirs.mjs` の一覧の6つ(画面の `VillagePage`・`Directory`・`Story` と、横断部品の `ui/SettingsMenu`・`ui/PageviewCounter`・`ui/ScenePlayer`)
  - **状態コンテナ。** それ以外の、フックを呼ぶすべての `index.tsx`。import の制限は表示部品と同じ(外の世界の入口を import しない)。使う側はフォルダ(`.../<Name>`)を指す
  - 今は I/O コンテナ6つと、状態コンテナ16個(作品ストーリーの `StoryBody`・`SceneModal`・`SceneSection`・`TechChipPopover`・`IntroPreview`、一覧の `WorkCard`、場面の再生の `SceneSvg`、設定メニューの `SettingsMenuPanel`、
    村の起動の覆いの `Boot` と、`Village` の下の `ClockModal`・`Ground`・`Joystick`・`Lighting`・`StopModal`・`TalkBubble`・`WorldMap`)。
    どのコンテナがどのフォルダに当たるかの一覧は [../product/feature-map.md](../product/feature-map.md) の「コンテナと統合テスト」
- **置き場。** 統合テストは、そのテストが描くコンテナの `index.tsx` があるフォルダ(コンテナのフォルダ)に置く。E2E の `tests/` はそのまま。単体テスト(`src/**/*.test.ts`。utils・lib の隣)は動かさない。
  コンポーネントを描くテストはこれ以外に置かない(`npm run test:boundary` が落とす。[テストの境界](#テストの境界))
  - **1本なら対のファイル。** そのコンテナの統合テストが1本なら、`index.tsx` の隣の `index.integration.test.tsx`(例: `src/components/VillagePage/components/Boot/index.integration.test.tsx`)。
    今は村の `Boot`・`ClockModal`・`Ground`・`Joystick`・`Lighting` の5つ
  - **2本以上なら `__tests__`。** コンテナのフォルダの `__tests__` の下に、動作ごとの `<動作>.integration.test.tsx` を並べる(例: 作品カードの8本は `src/components/Directory/components/WorkCard/__tests__/`)。
    `__tests__` の下にフォルダを作らない
  - 1つのコンテナのフォルダに、対のファイルと `__tests__` を両方は置かない(`__tests__` の中が部品だけでも)。`__tests__` の下の統合テストが1本だけになったら、対のファイルに戻す
  - 置かない所: 表示部品(フックを呼ばない `index.tsx`)の隣、`hooks` フォルダの中、コンテナのフォルダでない所の `__tests__`、`__tests__` の下のフォルダ、リポジトリ直下の `__tests__`
  - **表示部品は自分のテストを持たない。** 表示部品は、それを描く親のコンテナの統合テストが覆う。表示部品がフックを呼び始めるとコンテナになるので、そのときはそのフォルダに統合テストを足す
  - `__tests__` に置けるのは `*.integration.test.tsx`・`*.test-helper.ts`・`index.fixture.ts`・`*.md` だけで、単体テストの `*.test.ts` も置かない
- **ファイルの名前と分け方。** `__tests__` の下は kebab-case の `<動作>.integration.test.tsx`(`open-modal.integration.test.tsx`・`focus-return.integration.test.tsx`・`auto-advance.integration.test.tsx` など)。
  1ファイルが動作のまとまり1つで、たいてい最上位の `describe` 1つが覆う範囲。コンテナ1つにファイルが1つ以上ある。
  統合テストはどれも、自分のフォルダのコンテナを別名 `@/components/<フォルダの道>` で(型だけでなく)import して描く
- **親と子の役割。** 親のテストは流れとつながりを見る(子が現れる、子のコールバックが親の側の結果 — 保存・移動・子どうしの間のフォーカスの戻り — に届く)。子のテストは子自身の動作を見る。
  断定を親から子へ移すときに捨てない。移した断定は全部、新しいファイルにある。子のコンポーネントも本物を描き、要素は role・名前・文字で引く。
  `renderHook` を使わず、`hooks` フォルダにテストを置かず、フックの戻り値を読まない
- **props の作り方。** 子のテストは、親の I/O コンテナの `index.fixture.ts` が `provide` した値を `inject(…)` で受ける(provide のキーは全部のフィクスチャで共通の1つの名前空間)か、手で組む。
  実際のコンテンツでは作れない分岐(説明の無い作品など)は、親でも子でも、props を変えた版をテストが直接渡してよい([../decisions/0017-screen-containers.md](../decisions/0017-screen-containers.md) の D6)
- **フィクスチャとテストの部品。** node でしか組めない props の `index.fixture.ts`(globalSetup。下の node の API の項)と、統合テストか `__tests__` の中のファイルが import する `*.test-helper.ts`・`*.fixture.ts`(部品が import する部品も)は、
  コンテナのフォルダの `__tests__` の下かコンテナの `index.tsx` の隣にだけ置く。`index.fixture.ts` は I/O コンテナの6つ(`scripts/container-dirs.mjs`)のものだけ。
  複数のコンテナのテストが使う部品は、それらのコンテナを包むいちばん近いコンテナの側に置く
  (例: 作品ストーリーの画面のテストと `TechChipPopover` のテストが使う `src/components/Story/__tests__/chip-popover.test-helper.ts`)。
  単体テストだけが使う部品(`src/lib/pixel/png.test-helper.ts` など)は、それを使う単体テストの隣に置く。
  統合テストの外のテストの側(`*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`。`__tests__` の下の部品も)は、コンポーネントを描く道具を import しない([テストの境界](#テストの境界))
- **村。** 1段階では、村の統合テストを中身を変えずに(import だけ直して)1本のまま `village.integration.test.tsx` へ移した。
  2段階で、村の画面全体(`VillagePageContainer`)を描くテストは動作ごとのファイルへ、8つの状態コンテナのテストはそれぞれのフォルダへ分け、その1本は消した。
  今は、画面全体を描くテストが `src/components/VillagePage/__tests__/` に、8つの状態コンテナのテストがそれぞれのコンテナのフォルダ(1本だけの5つは対のファイル)にある。
  状態コンテナのテストは、そのコンテナを props で直接描く(画面全体を描くテストと1つのファイルに混ぜない)。`test(…)` の名前は変えずに移した
- 以前の名前 `container.browser.test.tsx` と、「コンテナごとに隣にちょうど1本」の決まりは無くなった。
  リポジトリ直下の `__tests__` に unit ごとのフォルダで置く形(2026-10-17〜18)も無くなった([../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md))。
  コンテナの `container.tsx`・対のファイルの `container.integration.test.tsx`・フィクスチャの `container.fixture.ts` という名前(2026-10-14〜18)も無くなり、どれも `index` で始まる名前になった([../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))
- 設定は `vitest.integration.config.ts` で、`@vitest/browser-playwright` は 4.1.10 に版を固定する(peer が同じ版の vitest で、5.x は vitest 5 を求めて衝突する)
- コンテナを、フック・子と一緒に本物のまま描く。レイアウト・`ResizeObserver`・入力は差し替えない。rAF と `performance.now` は時間として扱い、下の時間の差し替えの中でだけ偽物にする
- ブラウザの環境の設定(ビューポートの大きさ、`prefers-reduced-motion` やタッチの模擬を CDP や `matchMedia` で再現すること)はモックではなく環境として扱い、使ってよい
- Vitest はブラウザのページをファイルをまたいで使い回し、ファイルごとに作り直すのは中の iframe だけなので、CDP で替えた環境は次のファイルへ持ち越す。
  替えたファイルが `afterEach` で戻す(動きを控える設定は features を空で送れば開いた時の値へ戻る)。
  タッチの模擬(`Emulation.setTouchEmulationEnabled`)だけは、切っても `pointer`・`hover` が開いた時の `fine`・`hover` へ戻らず `none` のまま残り、
  入れたことの無いページでも切る指示を1回送っただけで `none` になる(2026-10-17 の実測)。そこで、タッチの模擬を使うファイル(村の `emulateTouch` の名前を書いたファイル)は
  `vitest.integration.config.ts` がファイルごとに別のブラウザの instance(結果の行頭の名前は `touch:<ファイル>`)で走らせ、ほかのファイルとページを共にさせない。
  `emulateTouch` はその instance の外では投げ、模擬を切るのは入れたファイルだけ。村と一覧のテストは各テストの始めに、ページがマウスの端末(`(hover: hover) and (pointer: fine)`)のままであることを前提として確かめる
  (タッチの模擬を使うファイルの中では、前のテストが切った後の `none` が残るので、`pointer: coarse` でないことだけを確かめる)
- rAF が本物のまま歩く村のテストは、時間で押さない。1 マス分の押下は node の側で押し、主人公が歩き出したのをテストの iframe の中で画面の位置の動きで見届けたら、
  その場で村の枠から焦点を一度外して押しっぱなしの向きを捨てさせ(村の枠の `onBlur`)、それから離す(`vitest.integration.config.ts` の `holdUntilStep`。
  呼ぶのは `src/components/VillagePage/__tests__/village-walk.test-helper.ts` の `press`・`walk`)。
  E2E と同じく決めた時間(`HOLD_MS`)だけ押す形は、負荷の高い時に歩行ループが見るフレームとずれ、旋回を終える前に離れて歩き出さなかったり、離すのが遅れて次のマスまで歩いたりした。
  歩き出しを見てから離す形でも、離す指示が Chromium へ届くまでの遅れが1マスの歩行(256ms)を越えて行き過ぎた(どちらも 2026-10-20 の実測。数字は `holdUntilStep` の注)。
  押しっぱなしの向きを rAF で読む経路へ押した瞬間の 1 回として読ませる `tapHeld` は、node の側で押し、テストの iframe の rAF を2フレーム数えてから離す(`vitest.integration.config.ts` の `holdKey`)。
  どちらも離す指示が Chromium へ届くまでの遅れの分だけ長く押すので、押し続けると繰り返す操作(会話窓の本文送りで戻る向きなど、300ms ごと)の「1回だけ」を確かめるテストは偽の時計で叩く
- 差し替えるのはネットワークと時間だけ。`fetch` は `vi.stubGlobal` で差し替え、`afterEach` で `vi.unstubAllGlobals()` して戻す
  (村は天気の応答と、段階が替わる時に読むシートの絵の取得。シートは `Image` を差し替えて応答を決める)
- 時間は Vitest の偽の時計(`vi.useFakeTimers`)で差し替える。掛け方はファイルごとに違い、正本は村の `src/components/VillagePage/__tests__/village-time.test-helper.ts` の `startVillageClock` と各テストの `vi.useFakeTimers`。
  - 村の歩く・待つ・釣り・傘・飛ぶを見るファイル(歩行ループの眠り・池での釣り・雨の日の傘・自動移動の直線飛行・村の入力と道中の配線など)と卓上時計のファイルは、rAF・`performance.now`・タイマー・Date を全部偽の時計に載せ、
    テストが 1 フレーム 16ms ずつ進めた分だけ時間が経つ(E2E の `page.clock.install` に当たる)
  - 村の昼夜のファイル(昼夜と天気・夜の灯り)は、rAF・タイマー・`performance.now` を本物のまま使い、段階を決めるテストだけ Date を止める(`page.clock.setFixedTime` に当たる)。
    開いたまま時間帯が替わるテストは、Date と、段階を1分ごとに確かめ直す `setInterval` を止めてテストが進める
  - 村の舞台の寸法・窓の焦点・会話窓の中身・拡大地図などのファイルは、時間を差し替えない
  - 作品ストーリーと一覧は、場面の自動送りの `setTimeout` だけを止める
  - Vitest の偽の時計を入れると locator の操作が時計を進めない([ADR 0016](../decisions/0016-testing-trophy-browser-integration.md) の Consequences)ので、時間を差し替えるテストはそこに当たりうる
- 村の統合テストは、ローダーが `<style>` で差し込むスプライトの背景 CSS(`spriteBackgroundCss`)を入れておらず、ビルドが焼く `/sprites/` の PNG も無いので、村の絵は描かれない。
  絵そのもの(段階ごとの焼いたシート・釣りのコマの画素)は E2E が見る([E2E に残したテスト](#e2e-に残したテスト))
- ルーターの文脈は Next の実物の Context を Provider で渡す(モジュールのモックではない)。ページ移動の計測のテストは
  `PathnameContext`(`next/dist/shared/lib/hooks-client-context.shared-runtime`)の Provider で今の経路を渡し、経路を変えるときは別の value で描き直す
- ブラウザの操作は `vitest/browser` の `page` と `userEvent` で行う。画面の大きさは `page.viewport(幅, 高さ)` で変え、要素は `page.getByRole(…)` で引く。
  断定は利用者に見えるもの(role・名前・文字・`aria-*`・要素の有無・枠の寸法)で行う
- ブラウザでは node の API(`node:fs`・`node:zlib`・`node:crypto`)を読み込めない。それを使って組む props は、I/O コンテナのフォルダの `index.fixture.ts` が
  `export function setup(project: TestProject)` の中で node で組んで `project.provide(…)` し、テストは `inject` で受け取る(子の状態コンテナのテストも、親の I/O コンテナのフィクスチャが provide した値を受け取れる)。
  `vitest.integration.config.ts` が `index.fixture.ts` を全部拾って globalSetup に入れる(1つも拾えないと設定を読む時点で落ちる)。
  置けるのは I/O コンテナの6つのフォルダ(その `__tests__` の下か `index.tsx` の隣)だけで、ほかに置くと `npm run test:boundary` が落とす(全部拾うので、黙って走らせないため)。
  今は村・一覧・作品ストーリー・設定メニューの4つ(`src/components/VillagePage/__tests__/index.fixture.ts`・`src/components/Directory/__tests__/index.fixture.ts`・
  `src/components/Story/__tests__/index.fixture.ts`・`src/components/ui/SettingsMenu/__tests__/index.fixture.ts`)。設定メニューは ui の文言が要り、テストが `@content/ja/ui` を直接 import すると content の実データの import 規則(ESLint)に掛かり、
  `readContent` は `node:fs` を使うのでブラウザで読めないため、フィクスチャが provide する。
  画面の3つは、ローダー(`src/app/` の `*-screen.tsx`)とフィクスチャが同じ純粋な組み立て関数(読み出した結果を引数で受ける)を使う。村は `src/components/VillagePage/utils/village-props.ts`、
  一覧は `src/components/Directory/utils/directory-props.ts`、作品ストーリーは `src/components/Story/utils/story-props.ts`
  (ストーリーが無ければ null を返し、`notFound()` はローダーに残る)。組み方はこの関数1か所にあり、フィクスチャはローダーを写さない
- globalSetup が読み込む `server-only` は中身の無い版(パッケージ同梱の `empty.js`)へ alias する。
  `process.env` は、`next.config` の `trailingSlash` を `__NEXT_TRAILING_SLASH` として入れた中身に define する(`next/link` が `process.env` を読み、ブラウザには `process` が無い。
  無いと `next/link` が href の末尾のスラッシュを落とし、配信物と違う href になる)。先に束ねた依存(`next/link`)の中の `process.env` はこの置き換えを受けないが、
  Vite がブラウザで最初に読む `/@vite/env` が define の値を `globalThis.process.env` へ書き、`next/link` は実行時にそれを読む(2026-10-14 の実測)。
  そのため `next/link` が読む値はテストごとに差し替えず、この define で決める。どれも `vitest.integration.config.ts` にある
- ブラウザの時間帯は provider の `contextOptions.timezoneId` で UTC に固定する(`TZ=UTC` は node のプロセスにしか効かない)。
  外すとこの機器では `Asia/Tokyo` になった(2026-10-13 の実測)。村の統合テストは前提としてブラウザの時間帯が UTC であることを先に確かめる
- 落ちた時の画面の写しは `test-results/vitest-screenshots/`、添付は `test-results/vitest-attachments/` に出る(git は追わない)
- 走らせると React の「not wrapped in act(...)」の `console.error` が出力に混ざる。テストは通る。既知のもので、まだ手当てしていない
- カバレッジは `npm run test:integration -- --coverage` で測り、フックとコンポーネントも含む。報告は `coverage/integration` に出て、全体の床を下回るか、
  フック・コンテナ・表示部品のどれかがファイル別100%に届かないと落ちる([カバレッジの床](#カバレッジの床))

## E2E から統合への移行

テスティングトロフィーへの移行([../decisions/0016-testing-trophy-browser-integration.md](../decisions/0016-testing-trophy-browser-integration.md))で「統合へ移す」とした E2E の11本は、
[../decisions/0018-move-e2e-and-gate-all-hooks.md](../decisions/0018-move-e2e-and-gate-all-hooks.md) が決めたとおり、1つの PR で統合テストへ移した(2026-10-15)。

- **消し方。** E2E のテスト1件ごとに同じ振る舞いを断定する統合テストを書き、その E2E が落とす欠陥を入れて統合テストが落ちることと、
  ビルドした配信物で E2E も同じ欠陥で落ちることを確かめてから消した([新しい検査は必ず一度落とす](#新しい検査は必ず一度落とす))。
  どの欠陥でどの統合テストと E2E が落ちたかは、消したコミットの本文にある
- **移した先。** 村の振る舞いは村の統合テスト、作品ストーリーは作品ストーリーの統合テスト。
  どちらも 2026-10-17 にリポジトリ直下の `__tests__` へ移し([../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md))、2026-10-18 にコンテナのフォルダへ移した([../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md))。
  今は `src/components/VillagePage/` と `src/components/Story/` の下(それぞれの `__tests__` と、その下の状態コンテナのフォルダ)にある。
  統合テストが同じ欠陥を落とせなかったもの、統合テストの中では作れないものは消さずに E2E に残した([E2E に残したテスト](#e2e-に残したテスト))
- **フックのファイル別100%** は、フォルダの一覧を作らず全フックへ掛けた([カバレッジの床](#カバレッジの床))
- 6つのコンテナの統合テストを入れた段階([../decisions/0017-screen-containers.md](../decisions/0017-screen-containers.md))と、この11本を移した段階は、どちらも利用者の決定で1回のセッション・1つの PR で行った

### E2E の行き先

| 行き先                                | spec                                                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E に残す                            | `tests/not-found.spec.ts`・`tests/directory.spec.ts`・`tests/storage-blocked.spec.ts`・`tests/observer-missing.spec.ts`(`IntersectionObserver` の無い環境は統合で作れない)・`tests/journey.spec.ts` の一部(村↔作品↔一覧の移動、完走1回) |
| 統合へ移し、一部のテストを E2E に残す | `tests/layout.spec.ts`・`tests/day-night.spec.ts`・`tests/night-transition.spec.ts`(3本とも残し、段階の切り替えの断定を統合にも足した)・`tests/clock.spec.ts`・`tests/fishing.spec.ts`。残したテストと理由は下の表                      |
| 統合へ移し、spec ごと消す             | 村の dialog-focus・idle-loop・flight・umbrella と、作品ストーリーの story・scene-refetch の6本                                                                                                                                          |

journey のそれ以外のテストの行き先は、この表では決めていない。

### E2E に残したテスト

| spec                             | 残したテスト                                                                                         | 残した理由                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/fishing.spec.ts`          | 投げる・かかる・釣り上げるの各コマは足元と立ち位置を残して体だけが動き、動き終えれば歩行ループが眠る | 体の画素を構えのコマと比べるには、ビルドが焼くシートとローダーのスプライトの背景が要り、統合テストでは描かれない。右向きの張るコマに構えの絵を当てる欠陥は、コマの名前は替わるので統合テストでは落ちず、この E2E の画素の比較だけが落とした。コマの時間割・左右反転・立ち位置・歩行ループの眠りは統合テストも見る |
| `tests/layout.spec.ts`           | PC: 一覧への出口は右下に固定される (/ko/)                                                            | 統合のフィクスチャ(`src/components/VillagePage/__tests__/index.fixture.ts`)は ja の props だけを渡す。ja の出口の配置と舞台の寸法は統合テストが見る                                                                                                                                                               |
| `tests/day-night.spec.ts`        | 4段階のどれも属性だけでなく焼いたシートそのものが入れ替わる (/)                                      | 段階ごとのシートが別物で読めるかは、ビルドが焼く `/sprites/` の PNG とローダーの `<style>` が要る。段階の属性(`data-phase`)は統合テストも見る                                                                                                                                                                     |
| `tests/day-night.spec.ts`        | 夜で雨でも8か所のコースは最後まで通る (/ko)                                                          | ko の全部の地点の文言で次へを連ねる完走([../decisions/0015-trim-e2e-overlap-and-ko.md](../decisions/0015-trim-e2e-overlap-and-ko.md))。統合のフィクスチャは ja の props だけを渡す。ja の完走は統合テストが見る                                                                                                   |
| `tests/night-transition.spec.ts` | 3本とも                                                                                              | 描いた背景がその段階の焼いたシートを指し、画像として読めるかは、焼いたシートとローダーの `<style>` が要る。段階の切り替えとシート2枚の取得・decode 待ちは統合テストも見る                                                                                                                                         |
| `tests/clock.spec.ts`            | 卓上時計で 20:00 を決めると夜になり、町へ出ても続き、再読み込みで実時刻へ戻る (/)                    | 再読み込みは統合テストの中では作れない(読み込み直すとテストごと消え、ストアを手で戻しても再読み込みの代わりにならない)。再読み込みの前まで(夜になり、町へ出ても続く)は統合テストも見る                                                                                                                            |

## E2E の10本

今走っている spec の全部。

| ファイル                         | 見るもの                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/journey.spec.ts`          | 村の導線。会話 → 扉 → 作品 → 一覧、8か所を巡って経歴碑もコースに数えること、地図の高速移動(番号の印と凡例・自室と池への移動)、位置と訪問の保存、テーマ、当たり判定、会話窓の本文送りと焦点、A/B とスティック、地点の物を押すと話しかけるマスまで歩いて会話が開くこと。言語の接頭を保って作品・一覧と村を行き来する導線とタッチ端末の案内文の折り返しは ja/ko 双方で、ほかは `/` だけ                                                                                                                                                                                                                                                                                                                                                          |
| `tests/layout.spec.ts`           | ko の村で、PC の一覧への出口が右下に固定されるか。舞台の寸法(PC・縦持ち・横持ち・タブレットの枠のマスと操作帯の配置)と ja の出口は統合テストが見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tests/day-night.spec.ts`        | 時計を4段階に固定して、4段階ぶんの焼いたシート(地形・主人公)がどれもサイト内の読める PNG で別物であること(`/`だけ)と、夜で雨でも8か所のコースを ko の文言のまま完走すること。段階の属性・夜の灯り・雨と雪の層・天気の取得失敗・ja の完走は統合テストが見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/night-transition.spec.ts` | 再読み込みせずに時間帯が変わるとき。開いたまま2時間進めて夜へ移っても地形と主人公が描けるか、夜の画像が 404 の間は直前の村を残し通信が戻れば夜へ移るか、片方の画像だけ遅れても両方そろうまで昼を残すか。描いた背景が焼いたシートを指して画像として読めるかまで見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tests/clock.spec.ts`            | 自室の卓上時計で 20:00 を決めると夜になり、町へ出ても続き、再読み込みで実時刻へ戻るか(`/`だけ)。窓の操作と、再読み込みの前までは統合テストが見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/fishing.spec.ts`          | 池での釣りの主人公の体のコマ。時計を止めて左向きの各コマ(投げる・かかる・釣り上げる)の実画面を撮り、構えのコマと比べて体の画素だけが変わり足元と立ち位置は動かないか、動き終えれば歩行ループが眠るか(`/`だけ)。釣りの流れ・コマの時間割・左右反転は統合テストが見る                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tests/not-found.spec.ts`        | 存在しない経路。配信が `out/404.html` を 404 で返すか、二言語の案内がそろっているか、そこから村と一覧へ戻る導線がその言語のまま動くか                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `tests/directory.spec.ts`        | 一覧の作品カード。詳細ページを持つ作品にだけ内部リンクが付くか、持たない作品の slug へ直接入ると作品ページが出ないか(不変ルール5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tests/storage-blocked.spec.ts`  | 保存(localStorage / sessionStorage)が使えないとき。プロパティを読むだけで投げる形とメソッドが投げる形の両方で、初回ペイント前のテーマ読み込み・テーマの切り替え・会話・歩いて町へ出るまでが、捕まえられない例外(pageerror)を出さずに動くか                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/observer-missing.spec.ts` | `IntersectionObserver` が無い環境での、一覧のカードの出現・写真の色(use-reveal・use-fully-visible)と、作品ストーリーの今の場面(use-active-scene)。一覧は、どのカードも最初から現れ(opacity 1)、作品カードの動画(`#seatmap-demo video`)に src が入り、画面に入りきらない写真も色が付いたまま(grayscale 0)か。観察器がある時の対照(画面の外のカードはまだ opacity 0・grayscale 1)も見る。作品ストーリーは、場面を下へ送っても今の場面が先頭のままで、CTA が最初の場面から開くか(観察器がある時の対照は作品ストーリーの統合テスト(`src/components/Story/__tests__/` と、その下の状態コンテナのテスト)の CTA と場面の現れ方のテスト)。統合では観察器を後から消せない(読み込みの時にそれを覚えた `next/link` が TypeError を投げる)ので E2E で見る |

テストの件数は `npx playwright test --list` の末尾で数える(2026-10-15 で 71 件)。

E2E は `out/` を配る。**先に `npm run build` を済ませる。**

### 村の E2E の共通の約束

- **ファイルの中まで並列に走る**(`fullyParallel`、手元は 4 ワーカーまで)。テストは自分の context だけで村を開き、順番や他のテストが残した状態に頼らない
- **天気は既定で晴れ。** `@playwright/test` ではなく `tests/village.helpers.ts` の `test` を使うと、context に晴れの応答が敷かれ、実際の天気を待たない。雨・雪や取得失敗を確かめるテストは `stubWeather(page, 'rain' | 'snow' | 'error')` で上書きする(page の route が context の route より先に効く。同じ page に重ねたときは後から敷いた方が勝つ)。axe と日本語改行の検査スクリプトも同じ形の応答に差し替えて測る
- **歩くのは `walk(page, key, cells)`。** 1 マスごとに保存位置(sessionStorage)が変わるまで待ち、変わらない回(ぶつかった・向きだけ変えた)は `SETTLE_MS` で見切る。戻り値は到着したマス数
- 保存を塞ぐ `tests/storage-blocked.spec.ts` だけは `walk` を使えない(保存位置が変わらず、読むことも投げる)。1 マス分押して離し、主人公の描かれた位置が隣のマスへ移るのを待つ
- **spec をまたいで使う道具は `tests/village.helpers.ts` に置き、spec へ写さない。** 村を開く・歩く・押す・町へ出る(`leaveRoom`)・描画を待つ(`settleRender`・`waitTwoFrames`)・保存された現在地を読む(`readCell`)・歩行ループの眠りを待つ(`expectLoopIdle`)と、待ちの上乗せ `SLACK_MS`・昼の瞬間 `NOON_JST` など。
  spec から別の spec を import しない(相手の test() ごと二重に登録される)。名前が同じでも中身が違う物(時計の前から町へ出る clock の `leaveRoom` など)は spec に置く
- **言語に依らないテストは ja(`/`)だけで回す。** ko でも回すのは、言語の接頭を保つ導線・文言の折り返し・言語で操作を分けるもの・ko の全部の地点を通す完走だけ([../decisions/0015-trim-e2e-overlap-and-ko.md](../decisions/0015-trim-e2e-overlap-and-ko.md))。
  ja/ko を回すループの中では、ja だけのテストを `if (prefix !== '') continue` より下に置く。
  ja の側を統合テストへ移したもの(layout の一覧への出口・day-night の完走)は、統合のフィクスチャが ja の props だけを渡すので E2E に ko だけが残る。
  ko だけのテストは `if (prefix === '') continue` より下に置く。
  型は必須の欄だけを保証するので、任意の欄(`link`・`entries` など)の ja/ko の一致は単体の `src/lib/content/village-text-pair.test.ts` が見る
- **時計(`page.clock`)。** 段階だけを決めるなら `setFixedTime`(Date だけを替え、タイマーと rAF は実時間のまま)。待ちを飛ばすなら `install` する。
  `fastForward` は飛んだ先までに期限の来たタイマーを 1 度だけ呼び、その中で積まれた入れ子のタイマーは呼ばないので、入れ子の段階は次のタイマーが積まれた(文言が替わった)のを見てから 1 段ずつ進める。入れ子まで順に呼ぶなら `runFor`。
  `pauseAt` で止めた後は `runFor` で進めた分しか経たず、rAF と `setTimeout` も止まるので、それを待つ `walk`・`settleRender` は呼ばない
- **落ちた時に原因を読み分けられるようにする。** `expect` の第2引数と `expect.poll` の `message` に、満たすべき事実を書く(`'床へは 1 マス進める'` など)。
  前提(立っているマス・焦点が窓の中にあること・本当に歩いたこと)は本題の断定より先に確かめ、前提が崩れた時と本題が壊れた時を別の行で落とす。記録を後から調べる検査は、当たったフレームの番号(index)と時刻(at)をメッセージへ書き足す(統合テストの飛ぶ検査の `hitsNote` も同じ形。`src/components/VillagePage/__tests__/village-walk-flight.test-helper.ts`)

## カバレッジの床

`npm run test:coverage`は`npm run test`と同じテストをv8のカバレッジ付きで走らせ、床を下回ると落ちる。CIはこちらを走らせる(手元の`npm run test`は測らない)。

- 測る範囲・外す名前(テスト・`*.fixture.ts`・`*.test-helper.ts`・`src/**/hooks/**`・`src/components/**/*.tsx`)・床の値の正本は`vitest.config.ts`の`coverage`。数値はここへ書き写さない
- **単体の門ではフックとコンポーネントを測らない**(`vitest.config.ts`が`src/**/hooks/**`と`src/components/**/*.tsx`を外す)。どちらも単体テストを置かない層で、
  コンテナの統合テストが描いて測る([../decisions/0017-screen-containers.md](../decisions/0017-screen-containers.md))
- 画面の3つのローダー(`src/app/<名前>-screen.tsx`)は `src/components/` の外へ出たので([../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))、ルートの `src/app/**/page.tsx` と同じく単体の全体の床の分母に入る(どの単体テストも import しない。移した後の 2026-10-18 の実測は文 97.08%(2030/2091)・分岐 98.57%・関数 94.83%・行 96.93% で、床は下回らない)
- **統合の門。** `npm run test:integration -- --coverage`(`vitest.integration.config.ts`の`coverage`)はフックとコンポーネントも含めて測り、報告を`coverage/integration`へ出し、全体の床を下回ると落ちる。
  床の決め方は単体と同じく実測から2pt引いた値で、正本は`vitest.integration.config.ts`の`coverage`。数値はここへ書き写さない。
  CI(`.github/workflows/deploy.yml` の build ジョブ)は `npm run test:boundary` の後に Playwright の Chromium を入れ、これを走らせる
- **フックとコンテナと表示部品のファイル別100%:** 統合のカバレッジで、`src/**/hooks/**` の全部(`src/hooks/` を含む)と、
  `src/components/**` のすべての `.tsx`(コンテナと表示部品。テストの側(`*.test.tsx`・`__tests__` の中)は除く)を、ファイルごとに文・分岐・関数・行のそれぞれ100%にし、1つでも届かなければ落ちる
  (表示部品は [../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md))。
  画面の3つのサーバのローダー(`src/app/directory-screen.tsx`・`src/app/story-screen.tsx`・`src/app/village-screen.tsx`)は `src/components/` の外にあり、`src/app/` のほかのファイルと同じく全体の床にだけ入る。
  ビルドの時に node で content を読んでコンテナへ渡すだけでブラウザでは走らないので、統合テストでは測れない(どれも0%)。
  ローダーを `src/components/` の外へ出したので、ファイル別100%から名前を並べて外す一覧は持たない([../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))。
  対象の一覧も手で持たず、`vitest.integration.config.ts` が設定を読むたびに拾うので、新しいフック・コンテナ・表示部品は置いた時点で対象になる(フック(`HOOK_FILES`)か、コンテナと表示部品を合わせた `src/components/**` の `.tsx`(`COMPONENT_FILES`)のどちらかが1つも拾えないと設定を読む時点で落ちる。
  コンテナと表示部品は分けて数えないので、どちらか一方だけが0でもここでは落ちない。
  [../decisions/0018-move-e2e-and-gate-all-hooks.md](../decisions/0018-move-e2e-and-gate-all-hooks.md)・[../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md))。
  フックの振る舞いはそれを使うコンテナの統合テストが、コンテナの振る舞いはそのコンテナ自身の統合テストが、表示部品の振る舞いはそれを描く親のコンテナの統合テストが見る
  - フック・コンテナ・表示部品の名前がカバレッジの include から外れるか exclude(`*.fixture.ts`・`*.test-helper.ts` など)に掛かると、そのファイルは表に載らず、Vitest は空の表を100%と数えて門を黙って素通りさせる。
    そこで `vitest.integration.config.ts` は、拾ったフック・コンテナ・表示部品を Vitest と同じ当て方(picomatch の contains・dot 付き。test.include も exclude に足す)で1つずつ確かめ、掛かるものがあれば設定を読む時点で投げる。
    contains は前後を固定しないので、`*.fixture.ts` は `x.fixture.tsx` にも当たる。
    テストの部品・フィクスチャ(`*.test-helper.ts`・`*.fixture.ts`)を `hooks` フォルダの下に置くこと自体は `npm run test:boundary` が落とす([テストの境界](#テストの境界))
  - 統合テストで構造上届かない行(`IntersectionObserver` の無い環境のように、E2E だけが作れる場合)だけを、その行の前に
    `/* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */` を書いて外す。注釈を置ける場所は `scripts/check-coverage-ignores.mjs` が決め(フックとコンテナの `index.tsx` だけで、表示部品には置けない)、単体の門(純粋モジュール)の対象を E2E で外すことはしない。
    名指しした spec が git に追跡されていて、その名前の走るテストがあるかを `scripts/check-coverage-ignores.mjs`(`npm run test:boundary` が走らせる)が確かめ、
    理由(e2e の参照)の無い除外の注釈と、ほかの形の除外の注釈は落とす。注釈が指す E2E を消したり名前を変えたりすると、この検査が落ちる
  - 注釈の直後に置けるのは、1行に収まる文(`if (…) return` など)だけ。`v8 ignore next` は注釈の直後から始まる構文をまるごと外すので、
    複数行の文(`useEffect(…)` の呼び出し・ブロックを持つ `if` など)の前に置くと、その全体がカバレッジから消える。
    直後に構文の無い注釈(閉じ括弧・別の注釈の前・ファイルの終わり)は何も外さない。どちらも同じ検査が落とす。外したい所は、注釈のすぐ下の1行の文に切り出す
  - どの層のテストも通れない防御の分岐(起きない null の検査など)は注釈で外さず、振る舞いを変えずに分岐の生まれない形へ書き換える(ref のコールバックで要素を受け取る・純粋関数へ切り出して単体で測る、など)
- 単体の床は2種類ある。全体の床と、純粋モジュールのファイルごとのファイル別100%
- 全体の床は目標値ではなく、テストを消したり測られないコードを増やしたりしたときに落とすためのもの。決め方(実測から2pt引いて切り捨て)は`vitest.config.ts`の注釈にある
- ファイル別100%は`vitest.config.ts`の`FULL_COVERAGE`(文・分岐・関数・行をそれぞれ100)で、そのファイルに4つのどれかで測られない所が1つでもあれば落ちる
- 対象は**純粋モジュールの置き場(`src/lib/`・`src/utils/`・コンポーネント専用のutils)にある`.ts`の全部**で、一覧を手で並べない。
  `scripts/gate-targets.mjs`が設定を読むたびに`src`をたどって規則で選ぶので、新しいファイルは置いた時点で対象になる(足し忘れが起きない)。
  テスト・`*.d.ts`・`*.fixture.ts`・`*.test-helper.ts`・`types.ts`・`hooks`フォルダの下は外す([../decisions/0014-gate-all-pure-modules.md](../decisions/0014-gate-all-pure-modules.md))
- データのファイルは名指しで扱いを分ける。ドット絵の行列(`src/lib/pixel/`の絵)と`linkedom`の差し替えはどちらの門にも入れず、
  `src/lib/pixel/flight-art.ts`(飛ぶ姿の絵)と`src/lib/pixel/palette.ts`(色の表)は[ミューテーションテスト](#ミューテーションテスト)から外してこちらだけで固める。
  外す理由の正本は`scripts/gate-targets.mjs`の注釈
- 規則と名指しの正本は`scripts/gate-targets.mjs`(ファイル別100%の一覧は`COVERAGE_TARGETS`)で、ここへ書き写さない。名指ししたパスが実在しないと、設定を読み込む時に落ちる(名指しが空振りしたまま黙って通らないように)

## ミューテーションテスト

`npm run test:mutation`はStrykerで、対象ファイルのコードを1か所ずつ壊した版(変異)を作り、単体テストがそれぞれを落とせるかを数える。落とせない変異が1つでも残ると落ちる(`break` 100)。
時間切れ(Timeout)の変異が1つでもあるときも落ちる([../decisions/0021-fail-on-mutation-timeout.md](../decisions/0021-fail-on-mutation-timeout.md))。

- 落ちるのは、生き残り(Survived)・どのテストも通らない(NoCoverage)・時間切れ(Timeout)が1体でもあるとき。
  前の2つは`break` 100で落ちる。Strykerは時間切れを落とした数に入れて点数を出すので、時間切れは`break` 100を通ってしまい、入口の`scripts/run-mutation.mjs`が走り終えた後に落とす。
  落ちたときは、どのファイルの何行目の何の変異が時間切れかを出す
- **ループ・再帰は、変異しても終わる形に書く。** `for (let i = 0; i < n; i++)`は`i++`を`i--`にした変異で止まらなくなり、時間切れになる。
  数え上げは`src/utils/range.ts`の`range`の並びの上を回し(`reduce`・`map`も同じ)、続けるかを決める条件を持たせない。
  待ち行列で広がる探索は`src/lib/village/reach-cells.ts`のように、マス目から引いたマスを`Map`へ1度だけ入れてその`Map`の上を回す(回る数がマス目の数を超えない)。
  待ち時間(`stryker.config.mjs`では`timeoutMS`・`timeoutFactor`を既定のまま)は延ばさない。遅いだけで時間切れになった変異も落ちとして数え、コードかテストを直す
- 対象は純粋モジュールの置き場の全部から、データのファイル(ドット絵の行列・色の表)を外したもの。決め方は[カバレッジの床](#カバレッジの床)のファイル別100%と同じ規則で、
  正本は`scripts/gate-targets.mjs`の`MUTATION_TARGETS`(`stryker.config.mjs`の`mutate`がこれを使う)。一覧はここへ書き写さない。新しいファイルは置いた時点で対象になり、手で足す所は無い
- データのファイルを外すのは、文字を消した変異体を見抜くには絵や表を丸ごと写したテストが要るだけで、振る舞いは守れないから。
  色の表(`src/lib/pixel/palette.ts`)には、どこからも読まれていない色・夜にしか使われないキーの昼の値を変えるだけの変異体があり、表を丸ごと写したテストでしか落とせない
- **モジュールを読む時に投げうる変異体があるファイルは、テストの中で`vi.resetModules()`してから動的に`import`する。**
  トップレベルの検査や定数の組み立てを壊した変異体は、テストファイルの`import`の時点で投げる。するとVitestはそのファイルを収集エラーにしてテストを1本も走らせず、
  Strykerはそれを生き残り(Survived)と数える。テストの中で読み込み直せば、読み込みの失敗は個々のテストの失敗になって変異体を落とせる(例: `src/lib/pixel/` の `lantern.test.ts`)
- カバレッジは「テストがその行を通ったか」しか見ない。ミューテーションは「その行を壊したらテストが落ちるか」を見る。
  [新しい検査は必ず一度落とす](#新しい検査は必ず一度落とす)を、対象ファイルのすべての変異について機械が繰り返す形
- 落とせない変異が出たら、テストを足して落とす。対象から外す(`scripts/gate-targets.mjs`の規則や名指しを変える)・`break`を下げるにはADRが要る
- 走らせ方は3段([../decisions/0013-incremental-mutation-on-push.md](../decisions/0013-incremental-mutation-on-push.md))。gitのフックでcommitのたびに走らせることはしない。
  純粋モジュール(変異テストの対象)かそのテストを変えたときだけ、commitの直前に手で走らせる([../agents/verification.md](../agents/verification.md))。
  push(CI)と手元の既定の実行は`incremental`で前回の結果を引き継ぎ、変わった変異体だけを走らせる(CIは最も新しく保存された結果をキャッシュで持ち回り、キャッシュが無い最初のpushでは全部が走る。
  手元で結果ファイルが無いときは、`scripts/run-mutation.mjs`が同じリポジトリのほかの作業ツリーの最も新しい結果を写して引き継ぎ、どこにも無ければ全部が走る。[../decisions/0023-inherit-latest-mutation-result.md](../decisions/0023-inherit-latest-mutation-result.md))。
  全部を走らせるのは週1回、手で`npm run test:mutation -- --force`
- Strykerの`incremental`が前回と比べるのは`mutate`のファイルとテストファイルの中身だけ。それだけでは、テストがimportする別のファイル(`*.test-helper.ts`・`*.fixture.ts`・間に挟むモジュール・content)だけが変わっても気付かず、
  前回落とした変異体は、今は生き残るとしても落としたままと数える(2026-10-18に実測)。
  そこで入口の`scripts/run-mutation.mjs`が、Strykerを呼ぶ前に、テストファイルごとの指紋(テストファイル自身と、そこからimportの文をたどって届くsrc・contentのファイルの中身。型だけのimportはたどらない)を、
  結果ファイルの隣に残した前回の指紋(結果ファイルの名前の`.json`を`.test-deps.json`にしたもの。gitは追跡しない)と比べ、指紋が変わったテストが前回落とした変異体を取り除いて測り直させる。
  変えた位置に関わらず、そのテストが前回落とした変異体を全部測り直す([../decisions/0025-remeasure-kills-on-test-deps.md](../decisions/0025-remeasure-kills-on-test-deps.md))
- 指紋に入らないものは、変わっても週1回の`--force`まで見落としうる。
  依存・設定(`package-lock.json`・`stryker.config.mjs`・`vitest.config.ts`)が変わっても、CIも手元も全部は走らせずに前回の結果を引き継ぐ([../decisions/0023-inherit-latest-mutation-result.md](../decisions/0023-inherit-latest-mutation-result.md))。
  ほかに、src・contentの外のファイル、式で組んだ`import()`の先、`vi.mock`などに文字列で書くだけのパス、テストが`fs`で読むファイル(今あるものの一覧は0025のConsequences)も指紋に入らない。
  これらだけを変えたときは、手で`npm run test:mutation -- --force`を走らせる([../agents/verification.md](../agents/verification.md)の「commit の直前」)
- 逆向きに、Strykerは前回生き残った変異体を、その変異体を通るテストが増えた・変わったと分かったときしか測り直さない。
  モジュールを読む時に1回だけ評価される静的な変異体は、どのテストに通られたかの記録が残らないので、テストを直しても足しても前回の生き残りを使い回して落ち続ける。
  テストがimportする別のファイルだけを直したときは、関数の中の変異体でも同じことが起きる(どちらも2026-10-18に実測)。
  そこで`npm run test:mutation`の入口の`scripts/run-mutation.mjs`が、Strykerを呼ぶ前に結果ファイルから落とせなかった変異体(生き残り・どのテストも通らない)と時間切れを取り除き、毎回その回に測り直させる。
  落ちるかどうかは、いつもその回に測った結果で決まる。`npx stryker run`を直接叩くと、この手当てを通らず、時間切れでも落ちない

## テストの境界

`npm run test:boundary` は `scripts/check-test-boundary.mjs`・`scripts/check-layers.mjs`・`scripts/check-coverage-ignores.mjs`・`scripts/check-hook-rule.mjs` の4つを走らせる。
最初の `scripts/check-test-boundary.mjs` は、`hooks`フォルダの中に単体テストがあることと、どのテスト(統合テストと部品を含む `src` の全部のテスト)でも`renderHook`を使うことを落とす。
フックは配線だけを持ち、ロジックは純粋関数へ移して単体で見る([../decisions/0011-extreme-constraints.md](../decisions/0011-extreme-constraints.md))。
フックの振る舞いは、それを使うコンテナを統合テストで描いて見る(ADR 0016。この検査の決まりは ADR 0016 でも変えていない)。
統合テストはコンテナのフォルダにだけ置くので、`hooks`フォルダの中には置けない(置くと下の置き場の検査が落とす)。
テストの部品・フィクスチャ(`*.test-helper.ts`・`*.fixture.ts`)を`hooks`フォルダの下に置くことも落とす。統合のカバレッジ(`vitest.integration.config.ts`)はこの名前を exclude で外すので、
`hooks`フォルダの下に置くと、フックのファイル別100%の門([カバレッジの床](#カバレッジの床))の外に黙って残るため。

加えて、コンテナとコンポーネントを描くテストの置き場を見る([../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md)・[../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md)・[../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))。
コンテナは `src/components/` の下の `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)のうち、フックを呼ぶものと I/O コンテナの一覧のフォルダのもの。I/O コンテナの一覧は `scripts/container-dirs.mjs`(画面の3つと横断部品の3つ。`scripts/check-layers.mjs` と同じもの)で、それ以外のコンテナは状態コンテナ。
置き場の決め方は[統合テストの約束](#統合テストの約束)。落とすのは次のとき。

- `*.integration.test.tsx` のほかの `*.test.tsx`(単体の設定が拾う名前)を src のどこかに置く
- 統合テスト(`*.integration.test.tsx`)をコンテナのフォルダの外に置く(表示部品の隣・`hooks` フォルダの中・コンテナのフォルダでない所の `__tests__`・`__tests__` の下のフォルダ・リポジトリ直下の `__tests__`)
- 統合テストの名前が決まりと違う。コンテナの `index.tsx` の隣に置けるのは `index.integration.test.tsx` だけで、
  `__tests__` の下は kebab-case の `<動作>.integration.test.tsx`(`index.integration.test.tsx` という名前は置けない)
- コンテナのフォルダでない所(表示部品のフォルダなど)の `__tests__` か、`__tests__` の下のフォルダに、ファイルを置く(統合テストに限らず、中のどのファイルでも)
- 1つのコンテナのフォルダに、対のファイル `index.integration.test.tsx` と `__tests__` が両方ある(`__tests__` の中が部品だけでも)。`__tests__` の下の統合テストが1本だけ(対のファイルにする)
- コンテナに統合テスト(対のファイルか、そのフォルダの `__tests__` の下の `*.integration.test.tsx`)が1つも無い。表示部品がフックを呼び始めてコンテナになったときも、テストを足さなければここで落ちる
- 統合テストが、自分のフォルダのコンテナを別名 `@/components/<フォルダの道>` で(型だけでなく)import していない
- `*.integration.test.ts`・`*.browser.test.*` をどこかに置く
- `__tests__` の下に、`*.integration.test.tsx`・`*.test-helper.ts`・`index.fixture.ts`・`*.md` のほかの名前のファイルを置く(単体テストの `*.test.ts` も。どちらの設定にも拾われないまま残る)
- リポジトリ直下に `__tests__` がある
- 隣にコンテナの `index.tsx` の無い `hooks` フォルダがある(表示部品のフォルダの `hooks` も。`src/hooks/` を除く)
- コンテナを、`src/components/<名前>/`(`ui` の下は `src/components/ui/<名前>/`)の下の外に置く(`src/components/`・`src/components/ui/` の直下)。
  `scripts/check-layers.mjs` は `src/app/`・`src/lib/` を許す側として見るので、そこにコンテナを置くと外の世界に触れても見逃すため(そこでフックを呼ぶと ESLint の規則が落とす)
- I/O コンテナの6つの一覧(`scripts/container-dirs.mjs`)を変える(7つめを足すなど)。検査の自己検査が6つのパスを固定しているので、自己検査が落ちる。一覧を変えるには ADR が要る
- `container.tsx`・`container.integration.test.tsx`・`container.fixture.ts` という名前のファイルがある(どこにあっても。前の名前で、今はどれも `index` で始まる)
- `index.tsx` のあるフォルダに `index.ts`・`index.d.ts`・`index.js`・`index.jsx` を置く(フォルダの名前で import すると、道具によっては `index.tsx` より先にそちらを拾う。どの道具がどれを先に拾うかは `scripts/check-test-boundary.mjs` の注釈)
- 状態コンテナが外の世界の入口を import する
- 統合テストか `__tests__` の中のファイルが import する `*.test-helper.ts`・`*.fixture.ts`(部品が import する部品も)を、コンテナのフォルダの `__tests__` の下とコンテナの `index.tsx` の隣の外に置く(単体テストだけが使う部品は、今までどおりそのテストの隣)。
  `index.fixture.ts` を I/O コンテナの6つのフォルダ(その `__tests__` の下か `index.tsx` の隣)の外に置く
- 統合テストの外(`*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`。`__tests__` の下の部品も)がコンポーネントを描く道具(`@testing-library/react`・`react-dom` とその下。型だけの import も)を import する

統合テストの外で描く道具を落とすのは、happy-dom でコンポーネントを描くと、名前を `*.test.ts` にするだけで置き場の決まりをすり抜けるため
(統合テストの部品を単体テストが読んで描く道も同じ)。
`index.fixture.ts` の置き場を落とすのは、統合の設定が `index.fixture.ts` を全部 globalSetup に入れ、ほかに置いても黙って走るため。
フックを呼んでよい所(`src/components/` の中の `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)と、`hooks` フォルダの中の `use-*.ts`・`use-*.tsx`)は、ESLint の規則 `layer/hook-only-in-container` が `npm run lint` で見る(テストの部品は外す)。
同じ規則を `scripts/check-hook-rule.mjs` が `npm run test:boundary` で使う(下の項)。

- 例外を許す一覧は無い。村の2段階まであった待ちの一覧2つ(まだフックを呼ぶ表示部品の `PENDING_CONTAINER_FILES` と、隣に `container.tsx` の無い `hooks` フォルダの `PENDING_HOOK_DIRS`)は、
  2段階で村を移し終えて消した
- ADR 0011より前からあった村のフックのテスト4つ(`use-map-data`・`use-village-time`・`use-village-world`・`use-village-travel`)は、
  各フックのロジックを純粋関数へ移して純粋関数のテストで見るようにし、消した。フックのテストに例外の一覧は無い
- この決まりを変えるにはADRが要る
- 同じコマンドで走る `scripts/check-layers.mjs` はテストではなく層を見る(表示部品と状態コンテナが外の世界へ届く import を、つながりをたどって落とす。
  `fetch`・`localStorage` など import の要らない外の世界の入口を I/O コンテナの外で使うこと、画面のコンテナをその画面のローダー(`src/app/<名前>-screen.tsx`)と自分の画面のフォルダの統合テスト・フィクスチャの外から import することも落とす。
  I/O コンテナとその隣の `hooks` フォルダが content の読み出し(`src/lib/content/` の下)へ届くこと(content を読むのは画面のローダーだけ)と、I/O コンテナの一覧のフォルダの `index.tsx`・画面のローダーのファイルが無いことも落とす)。
  import の向き(`eslint.config.mjs` の `no-restricted-imports`)も、src と `content/` のコードのファイルの import の先のファイルを別名に書き直して同じ規則に当てて見る
  (規則 7。相対パス・再 export・型だけの import・`import()` で書いても落ちる)。
  決まりは [../architecture/boundaries.md](../architecture/boundaries.md) の「コンテナと表示部品」(import の向きは「レイヤー」)
- 同じコマンドで走る `scripts/check-coverage-ignores.mjs` は、カバレッジから行を外す注釈を見る([カバレッジの床](#カバレッジの床)のフックとコンテナのファイル別100%)
- 同じコマンドで走る `scripts/check-hook-rule.mjs` は、ESLint の規則 `layer/hook-only-in-container` をそのまま使ってフックを呼ぶ所を見る。
  まず規則の判定(偽のコードの断片から拾うフックの名前)と、`eslint.config.mjs` の掛け方(偽のパスで、規則が掛かる所と外れる所)を自己検査し、src のファイル(コンテナのフォルダの統合テストと部品を含む)が lint の対象の外になっていないことも確かめる。
  src のファイルごとに、規則が掛かるかを名前の決まり(外れるのは `src/components/` の中の `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)・`hooks` フォルダの中の `use-*.ts(x)`・テストの部品だけ)と突き合わせ、1つでも違えば落とす
  (規則の組みの `ignores` に実在のパスを足すと、そのファイルは lint も通るため。この抜け道を実際の設定に入れて拾うことも自己検査する)。
  そのうえで src の `*.ts`・`*.tsx` を全部 lint して違反を数える(`eslint-disable` の注釈で黙らせた呼び出しも数える)

## 新しい検査は必ず一度落とす

書いたテストが**本当にその欠陥を検出できるか**を、採用する前に確かめる。
修正を外す / 期待値を反転する のどちらかで **PASS → FAIL が動くこと**を見てから採用する。動かないならそのテストは無い。
制約を足すとき(検査スクリプトを足す・変異テストやファイル別100%の対象の規則を広げる)も同じで、一度落ちるのを見てから採る。

理由: このリポジトリでは過去に、直しを外しても PASS し続ける検査を書いたことがある(配信物が古いままだった)。
PASS は調査を止めるので、FAIL より危険である。

## 走らせる範囲

統合テスト(`npm run test:integration`)はビルド無しで走るが、全体は約51秒かかる(2026-10-18 の手元の実測、87ファイル・314件、`--coverage` 無し。1本だった当時の 2026-10-13 の実測は約3.4秒、`-- --coverage` 付きで約4.3秒)。
反復中は触ったコンテナの統合テストだけを狭めて走らせ(ファイル1つを `-t` で絞るなら `npm run test:integration -- src/components/VillagePage/__tests__/fishing.integration.test.tsx -t '<名前>'`、
コンテナ1つの `__tests__` なら `npm run test:integration -- src/components/Story/components/StoryBody/__tests__/`)、全体は commit の直前に1回だけ走らせる(`npm run verify` に含まれる)。

E2E の反復中は落ちた spec だけを狭く走らせる(`npx playwright test tests/journey.spec.ts -g '<名前>'`)。
**E2E の全体は手元では回さず、push で CI が回す**(E2E で commit の直前に走らせるのは、変えた範囲が指す spec だけ)。詳しくは [../agents/verification.md](../agents/verification.md)。

E2E は CI でも再試行しない(`playwright.config.ts` の `retries` は 0)。再試行で通った失敗は緑として残り、揺れる検査を隠すため。
揺れて落ちた検査は、測り方(箱を別々に読む・固定の時間で待つ)か作りの側の原因を探して直す。
