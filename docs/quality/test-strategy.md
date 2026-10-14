---
status: active
read_when:
  - テストを足す・直すとき
  - どのテストを走らせるか決めるとき
  - ロジックをどこに置き、どのテストで固めるか決めるとき
source_of_truth: true
last_reviewed: 2026-10-13
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
  フックは、それを使う画面を統合テストで描いて見る(統合の層は設定が入ったところで、テストはまだ村の1本だけ。[移行中](#移行中))
- 制約は上げる方向にだけ動かす。下限を下げる・テストを消す・変異テストやファイル別100%の対象から外す・テストの境界の決まりを変えるにはADRが要る

## 4層

| 層 | 置き場・ファイル名 | 対象 | 環境 |
|---|---|---|---|
| 静的 | — | 型・lint(レイヤー境界を含む)・整形・文書の参照(`npm run typecheck`・`npm run lint`・`npm run format:check`・`npm run docs:check`) | ソースをそのまま読む |
| 単体(Vitest) | 対象ファイルの隣 `*.test.ts`、コンポーネントの隣 `index.test.tsx` | **純粋関数**と、`fetch`・Storage を `vi.stubGlobal` で差し替えて測る `src/lib/` の入口。DOMを使う(読む・書く・DOMParser)utils(歩行ループの部品など)。**コンポーネント1つだけを描くテスト**(環境・props・操作で分かれる出し分け)。いまは作品カード(`src/components/Directory/components/WorkCard/index.test.tsx`)とその部品のLinksOverlay・WorkLinks・ShotMedia、経歴のCareerDetail、設定メニューのSettingsMenu、ページ移動の計測のPageviewCounter、作品ストーリーの技術チップのTechChipPopoverの8本。**フックを`renderHook`で呼ぶテストは置かない**([テストの境界](#テストの境界)) | `environment: 'node'`(既定)。DOM を持たない。DOMを使う(読む・書く・DOMParser)utilsとコンポーネントを描くテストだけは、ファイル先頭の`// @vitest-environment happy-dom`でそのファイルだけhappy-domで走る |
| 統合(Vitest Browser Mode。一番厚くする) | `*.browser.test.tsx`(名前は仮) | **画面単位のコンポーネントを、フック・子と一緒に描く。** 村も含む。モックはネットワーク(天気)と時間だけ | 実ブラウザ(Chromium 1つ、headless)で、ビルド無しで走る(`vitest.integration.config.ts`・`npm run test:integration`)。ブラウザの時間帯は UTC に固定する。今は村の1本だけ([移行中](#移行中)) |
| E2E(Playwright) | `tests/**/*.spec.ts` | **ビルド結果でしか確かめられないもの**(静的経路・404・初回ペイント前のテーマ・言語の接頭を保つ移動・保存が塞がれた時)と、**ページをまたぐ核心の旅程**。今はフック(配線)の振る舞いもここで見ていて、統合へ移す予定([移行中](#移行中)) | `out/` を `:4173` で静的配信 |

- コンポーネント1つだけを happy-dom で描く上の8本は、ADR 0016 まで「統合」と呼んでいた。環境が happy-dom なので単体に数える。ファイルは `index.test.tsx` のまま
- ネットワークのモックは今の方式(`vi.stubGlobal`・Playwright の route)で行い、MSW は入れない([ADR 0016](../decisions/0016-testing-trophy-browser-integration.md))
- E2E の配信ポートは既定 `:4173` で、`E2E_PORT` で変えられる(`playwright.config.ts`)
- Vitest の設定は2つのファイルに分かれる。単体の `vitest.config.ts` は `src/**/*.test.ts` と `src/**/*.test.tsx` を拾い、`src/**/*.browser.test.{ts,tsx}` を exclude で外す。
  統合の `vitest.integration.config.ts` は `src/**/*.browser.test.{ts,tsx}` だけを拾う(名前は `*.browser.test.tsx` で付けるが、設定は `.ts` も拾う)。どちらも `content/` や `tests/` は対象外。
  ファイルを分けたのは、変異テスト(`stryker.config.mjs`)が `vitest.config.ts` を読むため(ブラウザのテストを変異テストに入れない。[ミューテーションテスト](#ミューテーションテスト))
- 純粋関数に切り出せる計算は切り出してから単体テストを書く。`src/lib/village/` と `src/lib/pixel/` がその形になっている
- フィクスチャは `*.fixture.ts`(Vitest の対象から外れる名前)
- モジュール変数に覚えを持つ関数(`src/lib/fetch-svg-source.ts` の取得の覚え)は、テストごとに `vi.resetModules()` してから import し直し、空の覚えから始める

### どの層に置くか

**確かめられる一番小さい層に置く。** 小さい層(単体)から順に当てはめ、確かめたいものが再現する最初の層に置く。

- **計算だけ**(入力が同じなら出力も同じ)→ 単体
- **フック・コンポーネントの中のロジック** → 純粋関数へ移してから単体。フックそのもの(配線)は`renderHook`で呼ばず、それを使う画面を統合で描いて見る
- **コンポーネント1つの、環境で分かれる出し分け**(URL のハッシュ・`matchMedia`・`IntersectionObserver` の有無)→ 単体(happy-dom)。
  実ブラウザでは作りにくい環境(`IntersectionObserver` が無い等)を `vi.stubGlobal` で作り、画面に何が出るかを見る
- **コンポーネント1つの、props・操作で変わる出力**(任意の項目を渡すと節が出て外すと消える、押すと開閉してフォーカスが戻る)→ 単体(happy-dom)
- **画面単位で、フック・子と一緒に動く振る舞い**(実際の配置・寸法・スクロール・rAF・歩行・時間で変わる表示)→ 統合。
  happy-dom は配置を計算せず(作品カードの `getBoundingClientRect()` は幅・高さとも 0 だった)、`ResizeObserver.observe()` は実装が無いので、寸法に頼るものは実ブラウザで見る
- **ビルド結果でしか確かめられないもの**(静的経路・`out/404.html`・初回ペイント前のテーマ・言語の接頭を保つ移動・保存が塞がれた時)と、**ページをまたぐ核心の旅程** → E2E
- **上の層でバグが出たら、下の層にテストを足す。** E2E で見つかった欠陥は、統合か単体にもそれを落とすテストを足す
- **村(`src/components/VillagePage/`)も統合の対象にする。** 描画が実際の寸法と rAF の歩行ループに依存し、happy-dom では確かめたいものが再現しないので、
  村の画面は実ブラウザの統合テストで描く(ADR 0016。[../decisions/0009-widen-happy-dom-test-scope.md](../decisions/0009-widen-happy-dom-test-scope.md) の「村のコンポーネントを描く統合テストは引き続き作らない」を置き換えた)。
  DOMを使うutils(rAFと`performance.now`を偽物に替えた歩行ループの部品など)を単体で測るのは今までどおり。
  村のフックも`renderHook`のテストは作らず、村の画面を統合で描いて見る
- 統合テストへ移し終えるまでは、画面単位の振る舞いは今までどおり E2E で見る([移行中](#移行中))

### コンポーネントを描く単体テストの約束

happy-dom でコンポーネント1つを描くテスト(`index.test.tsx`)の約束。統合テストの約束は[次の節](#統合テストの約束)。

- 確かめるのは利用者に見えるもの(role・`aria-*`・`inert`・要素の有無)。クラス名に頼るときは、部品と同じ CSS Modules を
  テストでも import して引く(Vitest は CSS を処理せず、CSS Modules を `_<キー>_<ファイル名のハッシュ>` を返す Proxy に置き換える)
- 環境の差し替えは `vi.stubGlobal` で行い、`afterEach` で `vi.unstubAllGlobals()` と URL(`history.replaceState`)を戻す
- `fetch` も差し替えて外へ通信させない。happy-dom は相対 URL を `http://localhost:3000` へ取りに行く
- 実データは `readContent('ja')` から条件で選ぶ(slug を名指ししない)。`server-only` は単体と同じく mock する

### 統合テストの約束

実ブラウザで画面を描くテスト(`*.browser.test.tsx`)の約束。例は村の `src/components/VillagePage/components/Village/index.browser.test.tsx`。

- 画面単位のコンポーネントを、フック・子と一緒に本物のまま描く。レイアウト・rAF・`ResizeObserver` は差し替えない
- 差し替えるのはネットワークと時間だけ。`fetch` は単体と同じく `vi.stubGlobal` で差し替え、`afterEach` で `vi.unstubAllGlobals()` して戻す(村は天気の応答)。
  Vitest の偽の時計を入れると locator の操作が時計を進めない([ADR 0016](../decisions/0016-testing-trophy-browser-integration.md) の Consequences)ので、時間を差し替えるテストはそこに当たりうる
- ブラウザの操作は `vitest/browser` の `page` と `userEvent` で行う。画面の大きさは `page.viewport(幅, 高さ)` で変え、要素は `page.getByRole(…)` で引く。
  断定は単体と同じく利用者に見えるもの(role・名前・`aria-*`・要素の有無・枠の寸法)で行う
- ブラウザでは node の API(`node:fs`・`node:zlib`・`node:crypto`)を読み込めない。それを使って組む props は、設定の globalSetup が node で組んで `provide` し、テストは `inject` で受け取る。
  村は `src/components/VillagePage/container.fixture.ts` が `provide('villageJa', …)` し、テストが `inject('villageJa')` する。
  組み方は `src/components/VillagePage/index.tsx` の写しなので、あちらを変えたらフィクスチャも合わせる(`exit` は要素なので渡せず、テストが組む)
- globalSetup が読み込む `server-only` は中身の無い版(パッケージ同梱の `empty.js`)へ alias し、`process.env` は空の入れ物に define する(`next/link` が `process.env` を読み、ブラウザには `process` が無い)。
  どちらも `vitest.integration.config.ts` にある
- ブラウザの時間帯は provider の `contextOptions.timezoneId` で UTC に固定する(`TZ=UTC` は node のプロセスにしか効かない)。
  外すとこの機器では `Asia/Tokyo` になった(2026-10-13 の実測)。村の統合テストは前提としてブラウザの時間帯が UTC であることを先に確かめる
- 落ちた時の画面の写しは `test-results/vitest-screenshots/`、添付は `test-results/vitest-attachments/` に出る(git は追わない)
- 走らせると React の「not wrapped in act(...)」の `console.error` が出力に混ざる。テストは通る。既知のもので、まだ手当てしていない
- カバレッジは `npm run test:integration -- --coverage` で測り、フックも含む。報告は `coverage/integration` に出て、床はまだ無い([カバレッジの床](#カバレッジの床))

## 移行中

テスティングトロフィーへの移行([../decisions/0016-testing-trophy-browser-integration.md](../decisions/0016-testing-trophy-browser-integration.md))の途中にある。
今の実物と、これから入るものを分けて書く。移行が終わったらこの節を消す。

### 今の実物(2026-10-13)

- **統合の層の基盤は入った。** 設定は `vitest.integration.config.ts`(`@vitest/browser-playwright` は 4.1.10 に版を固定。peer が同じ版の vitest で、5.x は vitest 5 を求めて衝突する)で、
  `npm run test:integration` で走る。単体の `vitest.config.ts` は `src/**/*.browser.test.{ts,tsx}` を外し、変異テストは今までどおり単体だけで回る
- **統合テストは1本。** `src/components/VillagePage/components/Village/index.browser.test.tsx` が実際の Chromium で村の画面を描き、
  ビューポート 1280×720 で枠が 640×576(64px のマス)、600×900 へ変えると 600×540(60px のマス)に描き直されるかを見る。差し替えるのは天気の `fetch` だけ。
  `src/components/VillagePage/components/Village/hooks/use-stage-scale.ts` の `observe` を外すと落ちるのを見てから採った([新しい検査は必ず一度落とす](#新しい検査は必ず一度落とす))
- CI(`.github/workflows/deploy.yml` の build ジョブ)は `npm run test:boundary` の後に Playwright の Chromium を入れ、`npm run test:integration -- --coverage` を走らせる。カバレッジは数字を出すだけで床は無い
- このテストは、VillagePage が `<style>` で差し込むスプライトの背景 CSS(`spriteBackgroundCss`)を入れていないので、村の絵は描かれない。絵を見る統合テストを作るときに渡し方を決める
- フックの振る舞いは今も主に E2E が見ている。単体の門(`npm run test:coverage`)はフックを測らない([カバレッジの床](#カバレッジの床))。
  フック(`hooks`フォルダの下、2026-10-13 に数えて43ファイル)のうち村(`src/components/VillagePage/`)の30は、統合テストが村を描くようになったが、そのテストが見るのは枠の寸法だけで、ほかの振る舞いは E2E でしか確かめていない
- E2E は下の15本のまま。まだ1本も統合へ移していない
- ファイル別100%を掛けるフックのフォルダの一覧は、まだ空(一覧を持つ設定もまだ無い)

### フォルダごとの移行(基盤の後)

- 統合テストを足し終えたフォルダから順に、そのフォルダのフックへファイル別100%を掛ける。掛けたフォルダの一覧は減らせないよう機械で検査する。
  全部移したら一覧を消し、「全フック」を対象にする規則にする
- 重なる E2E は、**統合テストが同じ欠陥を一度落とすのを見てから消す**([新しい検査は必ず一度落とす](#新しい検査は必ず一度落とす)。
  消すことは [ADR 0016](../decisions/0016-testing-trophy-browser-integration.md) が決めた。どの欠陥でどの統合テストが落ちたかは消すコミットの本文に書く)。消したら下の15本の表からも外す
- 不変ルール「1段階 = 1セッション」([../../AGENTS.md](../../AGENTS.md))に従い、フォルダの移行は複数のセッションに分けうる

### E2E の行き先(予定)

| 行き先 | spec |
|---|---|
| E2E に残す | `tests/not-found.spec.ts`・`tests/directory.spec.ts`・`tests/storage-blocked.spec.ts`・`tests/journey.spec.ts` の一部(村↔作品↔一覧の移動、完走1回) |
| 統合へ移す | `tests/layout.spec.ts`・`tests/day-night.spec.ts`・`tests/night-transition.spec.ts`・`tests/clock.spec.ts`・`tests/dialog-focus.spec.ts`・`tests/fishing.spec.ts`・`tests/idle-loop.spec.ts`・`tests/flight.spec.ts`・`tests/umbrella.spec.ts`・`tests/story.spec.ts`・`tests/scene-refetch.spec.ts` |

journey のそれ以外のテストの行き先は、この表では決めていない。

## E2E の15本

今走っている spec の全部。統合へ移す予定のものも、消すまではここに残す([移行中](#移行中))。

| ファイル | 見るもの |
|---|---|
| `tests/journey.spec.ts` | 村の導線。会話 → 扉 → 作品 → 一覧、8か所を巡って経歴碑もコースに数えること、地図の高速移動(番号の印と凡例・自室と池への移動)、位置と訪問の保存、テーマ、当たり判定、会話窓の本文送りと焦点、A/B とスティック、地点の物を押すと話しかけるマスまで歩いて会話が開くこと。言語の接頭を保って作品・一覧と村を行き来する導線とタッチ端末の案内文の折り返しは ja/ko 双方で、ほかは `/` だけ |
| `tests/layout.spec.ts` | 舞台の寸法。PC・縦持ち・横持ち・タブレットで操作帯の配置が崩れないか |
| `tests/day-night.spec.ts` | 時計を4段階に固定した空と、4段階ぶんの焼いたシートがどれも別物であること、夜の町の灯り(種類ごとの数・主人公の灯りが付いて回るか)と昼は描かれないこと、Open-Meteo の応答を差し替えた雨・雪の有無と取得失敗、夜で雨でも8か所のコースを完走すること(完走だけ ja/ko 双方で、ほかは `/` だけ) |
| `tests/night-transition.spec.ts` | 再読み込みせずに時間帯が変わるとき。開いたまま2時間進めて夜へ移っても地形と主人公が描けるか、夜の画像が 404 の間は直前の村を残し通信が戻れば夜へ移るか、片方の画像だけ遅れても両方そろうまで昼を残すか |
| `tests/clock.spec.ts` | 自室の卓上時計。決めた時刻が空の段階と夜の灯りへ効くか、町へ出ても続き再読み込みで実時刻へ戻るか、取消し・Escape・X では変わらないか、窓の中を矢印キー・Z/X・スティックと A/B で操作できるか(`/`だけ) |
| `tests/dialog-focus.spec.ts` | 村の枠に重ねる窓(会話窓・拡大地図・卓上時計の窓)の手製の Tab の輪。末尾の Tab で先頭へ、先頭(会話窓は見出しも)の Shift+Tab で末尾へ回るか、Escape で閉じると村の枠へ焦点が戻るか。縦持ちの画面で部屋の左右の壁際に出した吹き出しが、測り直しの後も枠の中へ押し戻されたままか(`/`だけ) |
| `tests/fishing.spec.ts` | 池での釣り。吹き出しから直接投げる → 浮き → 巻物 → 経験の会話窓と、竿先から浮きへの糸(振っている間は隠す・左向きの反転)、投げている間の移動の止め方、全部釣り上げた後の考え事の吹き出し、主人公の体のコマ(投げる・かかる・釣り上げる)と、時計を止めて撮った実画面の画素・動き終えた後の歩行ループの眠り、動きを控える設定の静止コマ、タッチ操作の A で投げて B で中断。投げる 3 本は ja(Z)と ko(吹き出しのボタン)で別の入力の経路を通す |
| `tests/idle-loop.spec.ts` | 歩行ループの眠りと目覚め。止まっている間と会話窓を開いている間は次のフレームを頼まず眠るか、方向キー・スティック・タップの最初の1回と会話窓を閉じた後の入力で歩き出し、画面の大きさが変わると新しいマス寸法で描き直すか |
| `tests/flight.spec.ts` | 自動移動の直線飛行。地図の地点・地図の自室(扉の隣まで飛んでから扉へ入る)・「次へ」で飛ぶコマ(`player-fly-`)と影の `data-flying` が出て、降りると戻り、降りたマスだけで到着するか。rAF ごとに写した影の位置が出発と着地を結ぶ線分に乗って家の上を越えるか、真ん中の 1/3 が前後の 1/3 のそれぞれ 2 倍を超えて進み前後がそろう加減速と、降りる前の 1/4 で横にも縦にも緩む着地と、距離で決まる飛ぶ長さ、主人公が影より上に浮いて降りると重なるか、飛ぶ間の方向キーで降りるマスも向きも変わらないか。動きを控える設定と舞台のタップでは飛ばずに 1 マスずつ歩き、雨の日も飛ぶ間は傘の無いコマで降りると傘へ戻るか |
| `tests/umbrella.spec.ts` | 雨の日の傘。自室から町へ出ると戸口で傘を取り出して開くコマが順に出て、開き終えるまでは押しても動かず、その後は傘を差したコマで歩くか、自宅の扉へ入る時は町に留まったまま畳んでしまうコマが順に出てから部屋へ移り、傘の無いコマに戻るか。晴れ・雪では一度も出さず扉も待たずに通るか、動きを控える設定では途中のコマも入力の錠も無く最初から差しているか |
| `tests/not-found.spec.ts` | 存在しない経路。配信が `out/404.html` を 404 で返すか、二言語の案内がそろっているか、そこから村と一覧へ戻る導線がその言語のまま動くか |
| `tests/directory.spec.ts` | 一覧の作品カード。詳細ページを持つ作品にだけ内部リンクが付くか、持たない作品の slug へ直接入ると作品ページが出ないか(不変ルール5) |
| `tests/storage-blocked.spec.ts` | 保存(localStorage / sessionStorage)が使えないとき。プロパティを読むだけで投げる形とメソッドが投げる形の両方で、初回ペイント前のテーマ読み込み・テーマの切り替え・会話・歩いて町へ出るまでが、捕まえられない例外(pageerror)を出さずに動くか |
| `tests/scene-refetch.spec.ts` | 作品ストーリーの場面の絵。取得に失敗した場面が、同じページのままモーダルを開き直すと取り直されて絵が出るか、成功した絵は取り直さないか |
| `tests/story.spec.ts` | 作品ストーリーの場面モーダルと本文の配線。CTA が今読んでいる場面から開くか、場面の文が画面に入ると現れるか、前へ・次へで端のボタンが無効になってフォーカスが隣へ移るか、時計を止めて自動送りが場面の周期ちょうどで進み一時停止の間は送らないか、自動送りで端へ着く時は無効になるボタンのフォーカスだけを逃がすか、Esc・閉じる・余白で閉じると開いたボタンへフォーカスが戻り背景の固定が解けるか |

テストの件数は `npx playwright test --list` の末尾で数える(2026-10-11 で 130 件)。

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
  型は必須の欄だけを保証するので、任意の欄(`link`・`entries` など)の ja/ko の一致は単体の `src/lib/content/village-text-pair.test.ts` が見る
- **時計(`page.clock`)。** 段階だけを決めるなら `setFixedTime`(Date だけを替え、タイマーと rAF は実時間のまま)。待ちを飛ばすなら `install` する。
  `fastForward` は飛んだ先までに期限の来たタイマーを 1 度だけ呼び、その中で積まれた入れ子のタイマーは呼ばないので、入れ子の段階は次のタイマーが積まれた(文言が替わった)のを見てから 1 段ずつ進める。入れ子まで順に呼ぶなら `runFor`。
  `pauseAt` で止めた後は `runFor` で進めた分しか経たず、rAF と `setTimeout` も止まるので、それを待つ `walk`・`settleRender` は呼ばない
- **落ちた時に原因を読み分けられるようにする。** `expect` の第2引数と `expect.poll` の `message` に、満たすべき事実を書く(`'床へは 1 マス進める'` など)。
  前提(立っているマス・焦点が窓の中にあること・本当に歩いたこと)は本題の断定より先に確かめ、前提が崩れた時と本題が壊れた時を別の行で落とす。記録を後から調べる検査は、当たったフレームの番号(index)と時刻(at)をメッセージへ書き足す(flight の `hitsNote`)

## カバレッジの床

`npm run test:coverage`は`npm run test`と同じテストをv8のカバレッジ付きで走らせ、床を下回ると落ちる。CIはこちらを走らせる(手元の`npm run test`は測らない)。

- 測る範囲・外す名前(テスト・`*.fixture.ts`・`*.test-helper.ts`・`src/**/hooks/**`)・床の値の正本は`vitest.config.ts`の`coverage`。数値はここへ書き写さない
- **単体の門ではフックを測らない**(`vitest.config.ts`が`src/**/hooks/**`を外す)。フックは単体テストを置かない層で、振る舞いは統合テストで見る(移し終えるまでは E2E が見る)。
  統合の`npm run test:integration -- --coverage`(`vitest.integration.config.ts`の`coverage`)はフックも含めて測り、報告を`coverage/integration`へ出すが、床はまだ無い(CI も数字を出すだけ)
- **移行後の規則:** 統合テストへ移し終えたフォルダのフックから、ファイル別100%を掛ける。掛けたフォルダの一覧は減らせないよう検査し、
  全部移したら一覧を消して全フックを対象にする([移行中](#移行中)・[../decisions/0016-testing-trophy-browser-integration.md](../decisions/0016-testing-trophy-browser-integration.md))。まだ掛けたフォルダは無い
- 床は2種類ある。全体の床と、純粋モジュールのファイルごとのファイル別100%
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
  push(CI)と手元の既定の実行は`incremental`で前回の結果を引き継ぎ、変わった変異体だけを走らせる(CIは結果をキャッシュで持ち回り、キャッシュが無い最初のpushでは全部が走る)。
  全部を走らせるのは週1回、手で`npm run test:mutation -- --force`
- `incremental`が前回と比べるのは`mutate`のファイルとテストファイルだけ。`mutate`のファイルがimportする別のファイル・依存パッケージ・設定だけが変わっても気付かない。
  CIはキャッシュの鍵に`package-lock.json`・`stryker.config.mjs`・`vitest.config.ts`の指紋を入れて、依存・設定が変わると全部を走らせる。importする別のファイルの変更は週1回の`--force`まで見落としうる

## テストの境界

`npm run test:boundary`(`scripts/check-test-boundary.mjs`)は、`hooks`フォルダの中に単体テストがあることと、srcのどのテストでも`renderHook`を使うことを落とす。
フックは配線だけを持ち、ロジックは純粋関数へ移して単体で見る([../decisions/0011-extreme-constraints.md](../decisions/0011-extreme-constraints.md))。
フックの振る舞いは、それを使う画面を統合テストで描いて見る(ADR 0016。この検査の決まりは ADR 0016 でも変えていない)。統合テストへ移し終えるまでは E2E が見る([移行中](#移行中))。
src の中に置いた統合テストの名前(`*.browser.test.tsx`)も、この検査が拾う名前(`*.test.ts`・`*.test.tsx`)に入るので、統合テストを`hooks`フォルダに置く・`renderHook`を使うのも落ちる。

- 例外の一覧(許可リスト)は無い。ADR 0011より前からあった村のフックのテスト4つ(`use-map-data`・`use-village-time`・`use-village-world`・`use-village-travel`)は、
  各フックのロジックを純粋関数へ移して純粋関数のテストで見るようにし、消した
- この決まりを変えるにはADRが要る

## 新しい検査は必ず一度落とす

書いたテストが**本当にその欠陥を検出できるか**を、採用する前に確かめる。
修正を外す / 期待値を反転する のどちらかで **PASS → FAIL が動くこと**を見てから採用する。動かないならそのテストは無い。
制約を足すとき(検査スクリプトを足す・変異テストやファイル別100%の対象の規則を広げる)も同じで、一度落ちるのを見てから採る。

理由: このリポジトリでは過去に、直しを外しても PASS し続ける検査を書いたことがある(配信物が古いままだった)。
PASS は調査を止めるので、FAIL より危険である。

## 走らせる範囲

統合テスト(`npm run test:integration`)はビルド無しで数秒で終わる(2026-10-13 の手元の実測で、1本のいま約3.4秒、`-- --coverage` 付きで約4.3秒)ので、反復中も全体を走らせてよい。

E2E の反復中は落ちた spec だけを狭く走らせる(`npx playwright test tests/journey.spec.ts -g '<名前>'`)。
**E2E の全体は手元では回さず、push で CI が回す**(E2E で commit の直前に走らせるのは、変えた範囲が指す spec だけ)。詳しくは [../agents/verification.md](../agents/verification.md)。

E2E は CI でも再試行しない(`playwright.config.ts` の `retries` は 0)。再試行で通った失敗は緑として残り、揺れる検査を隠すため。
揺れて落ちた検査は、測り方(箱を別々に読む・固定の時間で待つ)か作りの側の原因を探して直す。
