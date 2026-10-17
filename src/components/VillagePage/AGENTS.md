# src/components/VillagePage/ で作業するとき

村の画面。ファイルは役割で3つに分かれる([../../../docs/decisions/0017-screen-containers.md](../../../docs/decisions/0017-screen-containers.md))。規則と絵の層は [../../../docs/architecture/village.md](../../../docs/architecture/village.md)。

- `index.tsx` — **サーバのローダー**。content を読み出し、スプライトシートの合成・地点リンクを含む props をここで1回だけ組み
  (組み立ては純粋関数の `utils/village-props.ts`。中身は `utils/sprite-css.ts`・`utils/stop-links.ts`)、直列化できる props で `container.tsx` を描く。
  初回の HTML に必ず要るインラインの `<style>`(スプライトの背景)と `<script>`(初回ペイント前に段階を直す `utils/phase-init.ts` の `PHASE_INIT`)もここで作り、
  コンテナへ ReactNode の差し込み口の props で渡す。統合テストのフィクスチャ(`__tests__/village-page/container.fixture.ts`)も同じ `utils/village-props.ts` で組む
- `container.tsx` — **クライアントの I/O コンテナ**(`'use client'`)。画面のフック(`hooks/` の `useDayPhase`・`useWeather`・`useVillage`)と卓上時計のストア(`hooks/use-village-time.ts`)を呼ぶ。
  起動の覆い(`Boot`)・見出しのロゴ(`Logo`)・近道・一覧への出口(`ExitLink`)・設定メニュー(`Navigation`)と表示部品の `Village` を並べて値と手を props で渡し、
  ローダーから受けた `<style>`・`<script>` を元の位置(`Village` の前と直後)に置く
- `components/` の下 — **表示部品**。保存・天気・時計のストア・画面のフック(`hooks/`)を import せず、受け取った props を描く
- **フックを呼ぶ部品をコンテナ(`container.tsx`)にする決まり([../../../docs/decisions/0019-hooks-make-containers.md](../../../docs/decisions/0019-hooks-make-containers.md))は、村では2つめの段階で入れる。**
  それまでは `scripts/container-dirs.mjs` の待ちの一覧(フックを呼ぶ表示部品の `PENDING_CONTAINER_FILES`・隣にコンテナの無い `hooks` フォルダの `PENDING_HOOK_DIRS`)にあるものだけが例外で、一覧は減るだけ

## 守ること

1. **`'use client'` を `index.tsx` へ上げない。** サーバで組み立てる部分(content の読み出し・シート合成)が巻き込まれる。クライアントの入口は `container.tsx`
2. **`hooks/use-village.ts` のフックを呼ぶ順と、`container.tsx` が画面のフックを呼ぶ順(`useDayPhase` → `useWeather` → `useVillage`)を入れ替えない。** 寸法 → 入力 → 復元 → rAF → 重ね表示 の順がそのまま effect の実行順になる。
   村の画面のフックが `Village` から `container.tsx` へ上がったので、`<main>` の中で `Village` の後ろにある `Navigation`(設定メニュー)の effect は、子の effect として村のフックより先に走る
   (`Village` にフックがあった頃は後だった)。マウントの時にそちらで走るのは `useLightDismiss`(閉じているので何もしない)とテーマの購読だけで、今は互いに見えない。
   `Navigation` の側に村のフックと状態を分け合う effect を入れるときは、この順を前提にする
3. **移動・衝突・経路・地点判定のロジックをここに書かない。** `src/lib/village/` の純粋関数に置く(React・DOM なしで網羅的にテストできるため)
4. **保存は `src/lib/preferences.ts` 経由。** `sessionStorage` を直接触らない。窓口を import するのはコンテナの隣の `hooks/` だけ(表示部品からは呼ばない)
5. 歩行ループ(`hooks/use-walk-loop/use-walk-loop.ts`。フレームの中身は `components/Village/utils/walk-loop/` に分けてある)は rAF の中で **DOM へ直接書く**。React state を経由させない(再レンダーで駒が飛ぶ)
6. `hooks/use-stage-scale.ts` は `--cell` と `--band` を実測で書く(寸法の計算式は `components/Village/utils/stage-scale.ts`)。重ね表示(会話窓・地図)は `--band` を超えて操作帯を覆わない
7. 村の枠の中に出す窓(会話窓 `StopModal`・卓上時計の窓 `ClockModal`・拡大地図 `WorldMap`)は `role='dialog'` + `aria-modal='true'` の `div` と手製のフォーカストラップ(`src/hooks/use-dialog-focus.ts`)で作る。
   ネイティブ `<dialog>` の `showModal()` は top layer へ出て操作帯(`--band`)を覆うので使わない(守ること 6)。
   `showModal()` を使うのは村の外の全画面モーダル(作品ストーリーの場面モーダル `src/components/Story/components/SceneModal/`)だけ → [../../../docs/quality/accessibility.md](../../../docs/quality/accessibility.md)
8. **街灯だけは主人公の上にも描く層がある** — `components/Village/components/LampVeil/`(`.world` の中・`.terrain` の外・z 3)。
   街灯は柱の立つ下のマスだけが通行不可で、灯のある上のマス(笠の裏)に立つと主人公(z 2)が街灯を塗り潰すので、重なった 1 本を 2 マス分まとめて半透明で重ね直す。
   どの街灯かは `src/lib/village/lamp-veil.ts` が決め、位置と表示は `components/Village/utils/walk-loop/paint-lamp-veil.ts` が重なりの変わった時だけ DOM へ書く

## UI の部位 → フォルダ

画面の部品は 1 部品 1 フォルダで並ぶ。表示部品の `Village` が描く部品は `components/Village/components/` の下にあり、並べる順と渡す値は `components/Village/index.tsx`(値の出どころは `container.tsx`)。
world 層(`.world`)の中の並びは `components/Village/components/WorldLayer/`、枠に重ねる物(雨・雪からミニマップまで)の並びは `components/Village/components/FrameOverlays/` が持ち、どちらも値は `components/Village/index.tsx` から受け取る。
起動の覆いと一覧への出口の 2 つだけは `container.tsx` が作るので、この直下の `components/` にある。

| 部位                               | フォルダ                                                                                                                     | 中身を決める所・補足                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 起動の覆い(ロゴの着地)             | `components/Boot/`                                                                                                           | `container.tsx` が舞台の先頭に置く。中央のロゴを見出し(`data-boot-target`)へ飛ばしてから外す飾りで、読み上げからは隠す。初回は hydration 前のインライン script、クライアント遷移では effect が同じ手順を走らせる                                                                                    |
| 一覧への出口                       | `components/ExitLink/`                                                                                                       | `container.tsx` が作って `Village` の `exit` へ渡し、`components/Village/index.tsx` の出口の箱(`exitRef`)に入る。縦持ちタッチでは枠の下に高さを持つ。全地点で話し終えた時の焦点移動と跳ねは `hooks/use-village-overlay/use-course-progress.ts`                                                      |
| 操作帯(スティック・A/B)            | `components/Village/components/Joystick/`・`components/Village/components/ActionButtons/`                                    | A/B の行き先は `hooks/use-village-buttons.ts` が mode から決め、ボタンは呼ぶだけ                                                                                                                                                                                                                    |
| 枠に重ねる物(world 層の外)         | `components/Village/components/FrameOverlays/`                                                                               | 雨・雪・下端の案内文・会話窓・卓上時計の窓・ミニマップを枠の子として並べる。値は props で受けるだけでフックを呼ばない                                                                                                                                                                               |
| 枠の下端の案内文と吹き出し         | `components/Village/components/SpeechBox/`・`components/Village/components/TalkBubble/`                                      | 案内文は `role='status'` の一言。吹き出しは world 層の中に置き、話しかける物の上の台詞と、話せる相手がいない時の頭上の考え事の両方を描く                                                                                                                                                            |
| 会話窓と卓上時計の窓(枠に重ねる窓) | `components/Village/components/StopModal/`・`components/Village/components/ClockModal/`                                      | 会話窓は地点の説明と釣りの結果を 1 か所で描く。どちらを出すかは `components/Village/utils/pick-dialog.ts`。卓上時計の窓はストアを読まず、時計の値と設定する関数を `container.tsx` から props で受ける(`components/Village/components/ClockModal/hooks/use-clock-modal.ts` もストアを import しない) |
| 地図(ミニマップ・拡大地図)         | `components/Village/components/Minimap/`・`components/Village/components/WorldMap/`・`components/Village/components/MapSvg/` | MapSvg は両方の地図が縮尺だけ変えて使う地形の SVG。番号の札と凡例は WorldMap の中                                                                                                                                                                                                                   |
| world 層(カメラと一緒に動く層)     | `components/Village/components/WorldLayer/`                                                                                  | `.world` とその中身(地面・灯り・釣りの浮き・飛ぶ間の影・主人公・街灯の重ね・目印・吹き出し)を重なりの順に並べる。値は props で受けるだけでフックを呼ばない                                                                                                                                          |
| 地面と行き先の赤いピン             | `components/Village/components/Ground/`                                                                                      | 床タイル・建物の正面・行き先の印。動かないマスは 1 枚の箱にまとめてある                                                                                                                                                                                                                             |
| 飛ぶ間の地上の影                   | `components/Village/components/WorldLayer/`(`.player` の直前の `.flightShadow`。専用の部品のフォルダは無い)                  | 自動移動で飛ぶ間に地上の位置へ落とす影(`data-flight-shadow`)。位置・大きさ・`data-flying` は歩行ループが DOM へ直接書く(守ること 5)。飛ぶ規則は [../../../docs/architecture/village.md](../../../docs/architecture/village.md) の「自動移動の直線飛行」                                             |
| 夜の灯りと街灯の重ね               | `components/Village/components/Lighting/`・`components/Village/components/LampVeil/`                                         | 主人公の灯りと街灯の重ねは歩行ループが DOM へ直接書く(守ること 5・8)                                                                                                                                                                                                                                |
| 雨・雪                             | `components/Village/components/Weather/`                                                                                     | world 層ではなく枠の子。屋内では描かない                                                                                                                                                                                                                                                            |
| 釣りの浮き・糸・巻物               | `components/Village/components/FishingFloat/`                                                                                | 釣っている間だけ出る。進み具合は `hooks/use-village-overlay/use-village-fishing.ts`                                                                                                                                                                                                                 |

フォルダを消した・名前を変えた時は `npm run docs:check` がこの表の古いパスを落とすが、**足した時は検出されない。** 部品を足したら自分で行に加える。

## UI の位置を変えるとき

**着手前に現ビルドを撮る。** 縦持ち・横持ち・モーダル展開・地図展開のそれぞれで、その場所に今何が描かれているかを見る。
村のページは色トークンを反転して使っているので、トークン名だけで色を選ぶと極性が逆になる。重なりはレンダー結果にしか無い。

## 確かめ方

村の統合テスト(`__tests__/village-page/village.integration.test.tsx`。props は同じフォルダの `container.fixture.ts` が node で組む)はビルド無しで走る。
1つめの段階では元の1本を中身を変えずに移しただけで、動作ごと・状態コンテナごとに分けるのは2つめの段階。
舞台の寸法と操作帯・歩く・待つ・釣り・傘・飛ぶ・窓の焦点と吹き出し・卓上時計・昼夜と天気はここで見る。

```bash
npm run test:integration
```

E2E はビルドした `out/` を配って走る。残っているのは導線と、統合テストでは作れないもの(ビルドが焼いた絵・再読み込み・ko の文言)だけ。
spec ごとの中身は [../../../docs/quality/test-strategy.md](../../../docs/quality/test-strategy.md) の「E2E の10本」。

```bash
npm run build
npx playwright test tests/journey.spec.ts   # 導線
npx playwright test tests/day-night.spec.ts # 段階ごとの焼いたシートと ko の完走
```

`out/` を配るので、**先に `npm run build`**。古い `out/` を測ると直っていないように見える。
