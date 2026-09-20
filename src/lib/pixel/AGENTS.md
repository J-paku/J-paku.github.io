# src/lib/pixel/ で作業するとき

ドット絵エンジン。**DOM と React に一切依存しない。** 文字マトリクスを組み立て・検証し、
ビルド時に1枚の PNG スプライトシートへ合成する。村での使われ方は [../../../docs/architecture/village.md](../../../docs/architecture/village.md)。

## 構成

| ファイル | 役割 |
|---|---|
| `art.ts` | エンジン本体。`compose` / `mirrorX` / `mirrorY` / `recolor` と `buildSheet` |
| `terrain.ts` `structures.ts` `actors.ts` `weather-art.ts` | 絵の定義(地形・建物と設置物・主人公・雨と雪) |
| `lantern.ts` | 夜に提げるランタンの正本。主人公(`actors.ts`)が向きごとに重ねる型紙で、絵と重ね方を1箇所に集める |
| `palette.ts` | 1文字 → CSS 色。`'.'` は透明 |
| `palette-phase.ts` | 時間帯4段階へのパレット派生 |
| `png.ts` | RGBA → PNG の符号化(Node の zlib のみ) |
| `sprites.ts` | 上を束ねて型付きのシートにする |

## 守ること

1. **SVG に戻さない。** 数百マスが共有する `background-image` を SVG の data URI にすると、再描画のたびにマスごとの SVG 描画が走る(実測 約200ms)→ [../../../docs/decisions/0001-png-sprite-sheet.md](../../../docs/decisions/0001-png-sprite-sheet.md)
2. **8×8 の部品4枚で 16×16 のメタタイルを作る。** 地形・建物は 16×16、主人公は 16×24 の別シート
3. **`palette-phase.ts` が予約している文字を地形・主人公の絵に使わない。** 光源用が `LIGHT_KEYS`、段階に関わらず色を変えない文字が `FIXED_KEYS`。予約は `sprites.test.ts` が固定している
4. **雨と雪のシートは時間帯で色を変えない。** 地形・主人公は `phasePalette` を通すが、天気は素の `palette` のまま焼く(降る粒は地形ではないため)。「夜なのに雪が暗くならない」は仕様。実際に見える色には `src/components/VillagePage/components/Village/components/Weather/` の CSS 側(2コマの opacity と重ね順)も関わる
5. **`DayPhase` の正本は `src/utils/day-phase.ts`。** ここでは型を import するだけで再 export しない(レイヤー境界のため)
6. 時間帯や天気を増やすとシートの枚数が掛け算で増える(枚数の正本は `src/lib/pixel/sprites.ts`)。増やす前に `data-phase` の切り替えで済まないかを考える
7. 絵は自作のみ。原作ゲームの素材を持ち込まない

## 確かめ方

```bash
npm run test        # art / png / sprites / palette-phase の単体テスト
npm run build       # シートの合成まで通す
```

**絵を変えたら必ず目で見る。** 単体テストは寸法と索引を守るだけで、絵が正しいかは見ていない。
