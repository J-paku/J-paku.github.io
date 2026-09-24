# src/components/VillagePage/ で作業するとき

村の画面。`index.tsx` は**サーバ**で、スプライトシートの合成と地点リンクをここで1回だけ作って
クライアントの `Village` へ渡す。規則と絵の層は [../../../docs/architecture/village.md](../../../docs/architecture/village.md)。

## 守ること

1. **`'use client'` を `index.tsx` へ上げない。** サーバで組み立てる部分(content の読み出し・シート合成)が巻き込まれる
2. **`components/Village/hooks/use-village.ts` のフックを呼ぶ順を入れ替えない。** 寸法 → 入力 → 復元 → rAF → 重ね表示 の順がそのまま effect の実行順になる
3. **移動・衝突・経路・地点判定のロジックをここに書かない。** `src/lib/village/` の純粋関数に置く(単体テストが書けるのはそちらだけ)
4. **保存は `src/lib/preferences.ts` 経由。** `sessionStorage` を直接触らない
5. 歩行ループ(`components/Village/hooks/use-walk-loop/use-walk-loop.ts`。フレームの中身は `components/Village/hooks/use-walk-loop/utils/` に分けてある)は rAF の中で **DOM へ直接書く**。React state を経由させない(再レンダーで駒が飛ぶ)
6. `use-stage-scale.ts` は `--cell` と `--band` を実測で書く。重ね表示(会話窓・地図)は `--band` を超えて操作帯を覆わない
7. 新しいモーダルはネイティブ `<dialog>` の `showModal()` を使う → [../../../docs/quality/accessibility.md](../../../docs/quality/accessibility.md)
8. **街灯だけは主人公の上にも描く層がある** — `components/Village/components/LampVeil/`(`.world` の中・`.terrain` の外・z 3)。
   街灯は柱の立つ下のマスだけが通行不可で、灯のある上のマス(笠の裏)に立つと主人公(z 2)が街灯を塗り潰すので、重なった 1 本を 2 マス分まとめて半透明で重ね直す。
   どの街灯かは `src/lib/village/lamp-veil.ts` が決め、位置と表示は `components/Village/hooks/use-walk-loop/utils/lamp-veil-renderer.ts` が重なりの変わった時だけ DOM へ書く

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
