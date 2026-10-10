---
status: active
read_when:
  - テストを足す・直すとき
  - どのテストを走らせるか決めるとき
  - ロジックをどこに置き、どのテストで固めるか決めるとき
source_of_truth: true
last_reviewed: 2026-10-11
---

# テスト

## 方針

人はコードを読んでレビューしない。代わりに制約(テスト・検査)を極端に多く置き、すべて通ったものを信頼する([../decisions/0011-extreme-constraints.md](../decisions/0011-extreme-constraints.md))。

- ロジックは純粋関数(`src/lib/`・`src/utils/`・コンポーネント専用のutils)に置き、単体テスト・ファイル別カバレッジ100%・ミューテーションで固める
- フックとコンポーネントは配線だけを持つ。`hooks`フォルダに単体テストを置かず、どのテストでも`renderHook`を使わない([テストの境界](#テストの境界))
- 制約は上げる方向にだけ動かす。下限を下げる・テストを消す・変異テストやファイル別100%の対象から外す・テストの境界の決まりを変えるにはADRが要る

## 3層

| 層 | 置き場 | 対象 | 環境 |
|---|---|---|---|
| 単体(Vitest) | 対象ファイルの隣 `*.test.ts` | **純粋関数**と、`fetch`・Storage を `vi.stubGlobal` で差し替えて測る `src/lib/` の入口。DOMを使う(読む・書く・DOMParser)utils(歩行ループの部品など)もこの層。**フックを`renderHook`で呼ぶテストは置かない**([テストの境界](#テストの境界)) | `environment: 'node'`(既定)。DOM を持たない。DOMを使う(読む・書く・DOMParser)utilsだけは、ファイル先頭の`// @vitest-environment happy-dom`でそのファイルだけhappy-domで走る |
| 統合(Vitest + React Testing Library) | 対象コンポーネントの隣 `index.test.tsx` | **環境・props・操作で分かれるコンポーネントの出し分け**。いまは作品カード(`src/components/Directory/components/WorkCard/index.test.tsx`)とその部品のLinksOverlay・WorkLinks・ShotMedia、経歴のCareerDetail、設定メニューのSettingsMenu | ファイル先頭の `// @vitest-environment happy-dom` でそのファイルだけ DOM を持つ |
| E2E(Playwright) | `tests/**/*.spec.ts` | 実際のクリック・キー操作。フック(配線)の振る舞いもここで見る。1本に任せず、村の導線(journey)・歩行ループの眠り(idle-loop)・傘(umbrella)・飛行(flight)などの spec がそれぞれの配線を見る | `out/` を `:4173` で静的配信 |

- E2E の配信ポートは既定 `:4173` で、`E2E_PORT` で変えられる(`playwright.config.ts`)
- Vitest が拾うのは `src/**/*.test.ts` と `src/**/*.test.tsx`(`vitest.config.ts`)。`content/` や `tests/` は対象外
- 純粋関数に切り出せる計算は切り出してから単体テストを書く。`src/lib/village/` と `src/lib/pixel/` がその形になっている
- フィクスチャは `*.fixture.ts`(Vitest の対象から外れる名前)
- モジュール変数に覚えを持つ関数(`src/lib/fetch-svg-source.ts` の取得の覚え)は、テストごとに `vi.resetModules()` してから import し直し、空の覚えから始める

### どの層に置くか

- **計算だけ**(入力が同じなら出力も同じ)→ 単体
- **フック・コンポーネントの中のロジック** → 純粋関数へ移してから単体。フックとコンポーネントそのもの(配線)には単体テストを置かず、E2E か統合で見る
- **環境で分かれるコンポーネントの出し分け**(URL のハッシュ・`matchMedia`・`IntersectionObserver` の有無)→ 統合。
  実ブラウザでは作りにくい環境(`IntersectionObserver` が無い等)を `vi.stubGlobal` で作り、画面に何が出るかを見る
- **props・操作で変わるコンポーネントの出力**(任意の項目を渡すと節が出て外すと消える、押すと開閉してフォーカスが戻る)→ 統合
- **実際の配置・寸法・スクロール・rAF・歩行** → E2E。happy-dom は配置を計算しない(作品カードの `getBoundingClientRect()` は幅・高さとも 0 だった)
- **村(`src/components/VillagePage/`)は統合の対象にしない。** 描画が実際の寸法と rAF の歩行ループに依存するため、
  happy-dom では確かめたいものが再現しない。村の出し分けは E2E で見るか、純粋関数へ切り出して単体で見る。
  これはコンポーネントを描く統合テストの話で、DOMを使うutils(rAFと`performance.now`を偽物に替えた歩行ループの部品など)を単体で測るのは当てはまらない。
  村のフックは配線なので、`renderHook`のテストも作らない

### 統合テストの約束

- 確かめるのは利用者に見えるもの(role・`aria-*`・`inert`・要素の有無)。クラス名に頼るときは、部品と同じ CSS Modules を
  テストでも import して引く(Vitest は CSS を処理せず、CSS Modules を `_<キー>_<ファイル名のハッシュ>` を返す Proxy に置き換える)
- 環境の差し替えは `vi.stubGlobal` で行い、`afterEach` で `vi.unstubAllGlobals()` と URL(`history.replaceState`)を戻す
- `fetch` も差し替えて外へ通信させない。happy-dom は相対 URL を `http://localhost:3000` へ取りに行く
- 実データは `readContent('ja')` から条件で選ぶ(slug を名指ししない)。`server-only` は単体と同じく mock する

## E2E の13本

| ファイル | 見るもの |
|---|---|
| `tests/journey.spec.ts` | 村の導線。会話 → 扉 → 作品 → 一覧、8か所のコースの完走、地図の高速移動(番号の印と凡例・自室と池への移動)、位置と訪問の保存、テーマ、当たり判定を ja/ko 双方で。地点の物を押すと話しかけるマスまで歩いて会話が開くこと(`/`だけ) |
| `tests/layout.spec.ts` | 舞台の寸法。PC・縦持ち・横持ち・タブレットで操作帯の配置が崩れないか |
| `tests/day-night.spec.ts` | 時計を4段階に固定した空と、4段階ぶんの焼いたシートがどれも別物であること、Open-Meteo の応答を差し替えた雨・雪の有無 |
| `tests/night-transition.spec.ts` | 再読み込みせずに時間帯が変わるとき。開いたまま2時間進めて夜へ移っても地形と主人公が描けるか、夜の画像が 404 の間は直前の村を残し通信が戻れば夜へ移るか、片方の画像だけ遅れても両方そろうまで昼を残すか |
| `tests/clock.spec.ts` | 自室の卓上時計。決めた時刻が空の段階と夜の灯りへ効くか、町へ出ても続き再読み込みで実時刻へ戻るか |
| `tests/fishing.spec.ts` | 池での釣り。吹き出しから直接投げる → 浮き → 巻物 → 経験の会話窓と、竿先から浮きへの糸(振っている間は隠す・左向きの反転)、投げている間の移動の止め方、全部釣り上げた後の考え事の吹き出し、主人公の体のコマ(投げる・かかる・釣り上げる)と、時計を止めて撮った実画面の画素・動き終えた後の歩行ループの眠り |
| `tests/idle-loop.spec.ts` | 歩行ループの眠りと目覚め。止まっている間と会話窓を開いている間は次のフレームを頼まず眠るか、方向キー・スティック・タップの最初の1回と会話窓を閉じた後の入力で歩き出し、画面の大きさが変わると新しいマス寸法で描き直すか |
| `tests/flight.spec.ts` | 自動移動の直線飛行。地図の地点・地図の自室(扉の隣まで飛んでから扉へ入る)・「次へ」で飛ぶコマ(`player-fly-`)と影の `data-flying` が出て、降りると戻り、降りたマスだけで到着するか。rAF ごとに写した影の位置が出発と着地を結ぶ線分に乗って家の上を越えるか、前の 1/3 に後ろの 1/3 の 3 倍を超えて進む減速と、距離で決まる飛ぶ長さ、主人公が影より上に浮いて降りると重なるか、飛ぶ間の方向キーで降りるマスも向きも変わらないか。動きを控える設定と舞台のタップでは飛ばずに 1 マスずつ歩き、雨の日も飛ぶ間は傘の無いコマで降りると傘へ戻るか |
| `tests/umbrella.spec.ts` | 雨の日の傘。自室から町へ出ると戸口で傘を取り出して開くコマが順に出て、開き終えるまでは押しても動かず、その後は傘を差したコマで歩くか、自宅の扉へ入る時は町に留まったまま畳んでしまうコマが順に出てから部屋へ移り、傘の無いコマに戻るか。晴れ・雪では一度も出さず扉も待たずに通るか、動きを控える設定では途中のコマも入力の錠も無く最初から差しているか |
| `tests/not-found.spec.ts` | 存在しない経路。配信が `out/404.html` を 404 で返すか、二言語の案内がそろっているか、そこから村と一覧へ戻る導線がその言語のまま動くか |
| `tests/directory.spec.ts` | 一覧の作品カード。詳細ページを持つ作品にだけ内部リンクが付くか、持たない作品の slug へ直接入ると作品ページが出ないか(不変ルール5) |
| `tests/storage-blocked.spec.ts` | 保存(localStorage / sessionStorage)が使えないとき。プロパティを読むだけで投げる形とメソッドが投げる形の両方で、初回ペイント前のテーマ読み込み・テーマの切り替え・会話・歩いて町へ出るまでが、捕まえられない例外(pageerror)を出さずに動くか |
| `tests/scene-refetch.spec.ts` | 作品ストーリーの場面の絵。取得に失敗した場面が、同じページのままモーダルを開き直すと取り直されて絵が出るか、成功した絵は取り直さないか |

E2E は `out/` を配る。**先に `npm run build` を済ませる。**

### 村の E2E の共通の約束

- **ファイルの中まで並列に走る**(`fullyParallel`、手元は 4 ワーカーまで)。テストは自分の context だけで村を開き、順番や他のテストが残した状態に頼らない
- **天気は既定で晴れ。** `@playwright/test` ではなく `tests/village.helpers.ts` の `test` を使うと、context に晴れの応答が敷かれ、実際の天気を待たない。雨・雪や取得失敗を確かめるテストは `stubWeather(page, 'rain' | 'snow' | 'error')` で上書きする(page の route が context の route より先に効く。同じ page に重ねたときは後から敷いた方が勝つ)。axe と日本語改行の検査スクリプトも同じ形の応答に差し替えて測る
- **歩くのは `walk(page, key, cells)`。** 1 マスごとに保存位置(sessionStorage)が変わるまで待ち、変わらない回(ぶつかった・向きだけ変えた)は `SETTLE_MS` で見切る。戻り値は到着したマス数
- 保存を塞ぐ `tests/storage-blocked.spec.ts` だけは `walk` を使えない(保存位置が変わらず、読むことも投げる)。1 マス分押して離し、主人公の描かれた位置が隣のマスへ移るのを待つ

## カバレッジの床

`npm run test:coverage`は`npm run test`と同じテストをv8のカバレッジ付きで走らせ、床を下回ると落ちる。CIはこちらを走らせる(手元の`npm run test`は測らない)。

- 測る範囲・外す名前(テスト・`*.fixture.ts`・`*.test-helper.ts`・`src/**/hooks/**`)・床の値の正本は`vitest.config.ts`の`coverage`。数値はここへ書き写さない
- フックは測らない。フックは配線だけを持ち、振る舞いはE2Eが見る
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

反復中は落ちた spec だけを狭く走らせる(`npx playwright test tests/journey.spec.ts -g '<名前>'`)。
**E2E の全体は手元では回さず、push で CI が回す**(E2E で commit の直前に走らせるのは、変えた範囲が指す spec だけ)。詳しくは [../agents/verification.md](../agents/verification.md)。
