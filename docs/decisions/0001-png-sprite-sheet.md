---
status: historical
read_when:
  - スプライトの持ち方を変えようとするとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 0001. スプライトを SVG の data URI から PNG シートへ切り替える

## Status

Accepted(2026-09-18、`8f642a6` 「スプライトシートを SVG から PNG にして舞台の再描画で主スレッドが止まるのを直す」)

## Context

村の舞台は約700マスあり、全マスが `background-image` で同じスプライトシートを共有していた。
シートは SVG の data URI だった。SVG 画像はビットマップと違い、**描画のたびに要素ごとに SVG 文書の
ライフサイクルが走る**。1回の Paint の中に同じ処理が数百回並び、実測で約200ms 掛かっていた。

書体の到着などで舞台が再描画されるたびに主スレッドが止まり、その間のキー入力が落ちた。
症状は「町へ入った直後に押した方向キーが無視される」で、`ja` だけで再現した(`ko` は必要なサブセットが
取得済みで再描画が起きなかった)。

## Decision

シートを **PNG** にする。`src/lib/pixel/png.ts` が Node の zlib だけで RGBA を PNG へ符号化し、
ビルド時に1枚へ合成する。参照側は `image-rendering: pixelated` で拡大する。

## Consequences

- Paint 約200ms → 5ms 未満。data URI 452KB → 3.4KB、HTML 959KB → 62KB。スクリーンショットは全画素一致
- 絵を変えるたびにシートを焼き直すことになり、**時間帯・天気の種類を増やすと枚数が掛け算で増える**
- PNG 符号化のコードを自前で持つことになった(`png.ts` とその単体テスト)

## Alternatives Considered

- **SVG のまま要素数を減らす** — マス目そのものが表現なので減らせない
- **Canvas / WebGL に置き換える** — 村を DOM だけで作る方針([../architecture/village.md](../architecture/village.md))を崩すため採らない
- **E2E 側の待ちを足して凌ぐ** — 実際に一度これで通したが、遅い実機では同じ止まり方をするため根治していない
