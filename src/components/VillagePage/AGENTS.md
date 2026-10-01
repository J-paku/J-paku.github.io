# src/components/VillagePage/ で作業するとき

村の画面。`index.tsx` は**サーバ**で、スプライトシートの合成と地点リンクをここで1回だけ作って
クライアントの `Village` へ渡す(組み立ての中身は `utils/sprite-css.ts`・`utils/stop-links.ts`・`utils/phase-init.ts`)。規則と絵の層は [../../../docs/architecture/village.md](../../../docs/architecture/village.md)。

## 守ること

1. **`'use client'` を `index.tsx` へ上げない。** サーバで組み立てる部分(content の読み出し・シート合成)が巻き込まれる
2. **`components/Village/hooks/use-village.ts` のフックを呼ぶ順を入れ替えない。** 寸法 → 入力 → 復元 → rAF → 重ね表示 の順がそのまま effect の実行順になる
3. **移動・衝突・経路・地点判定のロジックをここに書かない。** `src/lib/village/` の純粋関数に置く(React・DOM なしで網羅的にテストできるため)
4. **保存は `src/lib/preferences.ts` 経由。** `sessionStorage` を直接触らない
5. 歩行ループ(`components/Village/hooks/use-walk-loop/use-walk-loop.ts`。フレームの中身は `components/Village/utils/walk-loop/` に分けてある)は rAF の中で **DOM へ直接書く**。React state を経由させない(再レンダーで駒が飛ぶ)
6. `components/Village/hooks/use-stage-scale.ts` は `--cell` と `--band` を実測で書く(寸法の計算式は `components/Village/utils/stage-scale.ts`)。重ね表示(会話窓・地図)は `--band` を超えて操作帯を覆わない
7. 村の枠の中に出す窓(会話窓 `StopModal`・卓上時計の窓 `ClockModal`・拡大地図 `WorldMap`)は `role='dialog'` + `aria-modal='true'` の `div` と手製のフォーカストラップ(`components/Village/hooks/use-dialog-focus.ts`)で作る。
   ネイティブ `<dialog>` の `showModal()` は top layer へ出て操作帯(`--band`)を覆うので使わない(守ること 6)。
   `showModal()` を使うのは村の外の全画面モーダル(作品ストーリーの場面モーダル `src/components/Story/components/SceneModal/`)だけ → [../../../docs/quality/accessibility.md](../../../docs/quality/accessibility.md)
8. **街灯だけは主人公の上にも描く層がある** — `components/Village/components/LampVeil/`(`.world` の中・`.terrain` の外・z 3)。
   街灯は柱の立つ下のマスだけが通行不可で、灯のある上のマス(笠の裏)に立つと主人公(z 2)が街灯を塗り潰すので、重なった 1 本を 2 マス分まとめて半透明で重ね直す。
   どの街灯かは `src/lib/village/lamp-veil.ts` が決め、位置と表示は `components/Village/utils/walk-loop/paint-lamp-veil.ts` が重なりの変わった時だけ DOM へ書く

## UI の部位 → フォルダ

画面の部品は 1 部品 1 フォルダで並ぶ。クライアントの `Village` が描く部品は `components/Village/components/` の下にあり、並べる順と渡す値は `components/Village/index.tsx`。
起動の覆いと一覧への出口の 2 つだけはサーバの `index.tsx` が作るので、この直下の `components/` にある。

| 部位 | フォルダ | 中身を決める所・補足 |
|---|---|---|
| 起動の覆い(ロゴの着地) | `components/Boot/` | `index.tsx` が舞台の先頭に置く。中央のロゴを見出し(`data-boot-target`)へ飛ばしてから外す飾りで、読み上げからは隠す。初回は hydration 前のインライン script、クライアント遷移では effect が同じ手順を走らせる |
| 一覧への出口 | `components/ExitLink/` | `index.tsx` が作って `Village` の `exit` へ渡し、`components/Village/index.tsx` の出口の箱(`exitRef`)に入る。縦持ちタッチでは枠の下に高さを持つ。全地点で話し終えた時の焦点移動と跳ねは `components/Village/hooks/use-village-overlay/use-course-progress.ts` |
| 操作帯(スティック・A/B) | `components/Village/components/Joystick/`・`components/Village/components/ActionButtons/` | A/B の行き先は `components/Village/hooks/use-village-buttons.ts` が mode から決め、ボタンは呼ぶだけ |
| 枠の下端の案内文と吹き出し | `components/Village/components/SpeechBox/`・`components/Village/components/TalkBubble/` | 案内文は `role='status'` の一言。吹き出しは world 層の中に置き、話しかける物の上の台詞と、話せる相手がいない時の頭上の考え事の両方を描く |
| 会話窓と卓上時計の窓(枠に重ねる窓) | `components/Village/components/StopModal/`・`components/Village/components/ClockModal/` | 会話窓は地点の説明と釣りの結果を 1 か所で描く。どちらを出すかは `components/Village/utils/pick-dialog.ts` |
| 地図(ミニマップ・拡大地図) | `components/Village/components/Minimap/`・`components/Village/components/WorldMap/`・`components/Village/components/MapSvg/` | MapSvg は両方の地図が縮尺だけ変えて使う地形の SVG。番号の札と凡例は WorldMap の中 |
| 地面と行き先の赤いピン | `components/Village/components/Ground/` | 床タイル・建物の正面・行き先の印。動かないマスは 1 枚の箱にまとめてある |
| 夜の灯りと街灯の重ね | `components/Village/components/Lighting/`・`components/Village/components/LampVeil/` | 主人公の灯りと街灯の重ねは歩行ループが DOM へ直接書く(守ること 5・8) |
| 雨・雪 | `components/Village/components/Weather/` | world 層ではなく枠の子。屋内では描かない |
| 釣りの浮き・糸・巻物 | `components/Village/components/FishingFloat/` | 釣っている間だけ出る。進み具合は `components/Village/hooks/use-village-overlay/use-village-fishing.ts` |

フォルダを消した・名前を変えた時は `npm run docs:check` がこの表の古いパスを落とすが、**足した時は検出されない。** 部品を足したら自分で行に加える。

## UI の位置を変えるとき

**着手前に現ビルドを撮る。** 縦持ち・横持ち・モーダル展開・地図展開のそれぞれで、その場所に今何が描かれているかを見る。
村のページは色トークンを反転して使っているので、トークン名だけで色を選ぶと極性が逆になる。重なりはレンダー結果にしか無い。

## 確かめ方

```bash
npm run build
npx playwright test tests/journey.spec.ts   # 導線
npx playwright test tests/layout.spec.ts    # 舞台の寸法と操作帯
npx playwright test tests/day-night.spec.ts # 昼夜と天気
```

`out/` を配るので、**先に `npm run build`**。古い `out/` を測ると直っていないように見える。
