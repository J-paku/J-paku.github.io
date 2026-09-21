---
status: active
read_when:
  - 村の地形・会話地点・移動・当たり判定を変えるとき
  - 村の UI(操作帯・会話窓・地図)を変えるとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 村(トップ画面)

歩いて回れる一画面のマップ。**Canvas も WebGL もゲームエンジンも使わない。** マス目は CSS Grid、
キャラクターは `transform` 1枚、絵は PNG スプライトシートの `background-position` で切り出す。

## 4つの層

| 層 | 場所 | 持つもの | 依存 |
|---|---|---|---|
| データ | `content/world.ts` / `content/{ja,ko}/village.ts` | 地形・構造物・会話地点・ワープ / 文言 | 無し |
| 規則 | `src/lib/village/` | 移動・衝突・経路・地点判定の純粋関数 | React・DOM に依存しない |
| 絵 | `src/lib/pixel/` | ドット絵の定義とシート合成 | 同上。→ [../../src/lib/pixel/AGENTS.md](../../src/lib/pixel/AGENTS.md) |
| 画面 | `src/components/VillagePage/` | 組み立てと操作 | → [../../src/components/VillagePage/AGENTS.md](../../src/components/VillagePage/AGENTS.md) |

**規則の層に画面の都合を持ち込まない。** ここが純粋なので、移動も経路も Vitest で単体テストできている。

## 規則の層(`src/lib/village/`)

| ファイル | 役割 |
|---|---|
| `collision.ts` | 通行可否。タイル種別と構造物の占有マスを見る。家は `area`(屋根行 + 壁行)全体が通行不可 |
| `movement.ts` | 移動状態の遷移。時間は呼び出し側(rAF)が渡す。1ステップで新しく始めるのは最大1マス |
| `path.ts` | 4方向 BFS。マップが小さいので経路キャッシュは持たない |
| `spot.ts` | 会話地点の判定と、コース順(`order`)での次の地点探索。`order` は全ワールド通しの通番 |
| `warp.ts` | ワープ床・扉の判定 |
| `facade.ts` | 構造物を1マスずつのスプライトへ展開する |
| `lights.ts` | 夜だけ灯る光源の表。位置も半径もマス単位で持つデータで、光の計算はしない。窓のマスは `facade.ts` から引く |
| `player-pose.ts` | 向きと歩行コマからスプライトのキーと左右反転を決める |

## 世界の構造

`WorldSet` = 複数の `World`。現在は屋外の町と屋内の自室。`kind: 'exterior'` のワールドだけがミニマップと拡大地図を持つ。
座標は左上原点の整数マス、`tiles[y][x]` で引く。型は `content/types/world.ts`。

北の道だけは外周の木の壁を抜けて町の外へ続き、その突き当たりの `arrivalArea` に入ると
「次の旅」の会話窓が開く。範囲内で横へ動いても開き直さず、一度道を戻って入り直すと再び開く。
経歴碑は道の左右の木の手前に置く。どちらもコース外(`order` 無し)で、5か所の訪問数には
含めない。配置の正本は `content/world.ts`。

外周のマスは吹き出しの置き場が上に無い(吹き出しは指す点の上へ約2マス分を使う)。
建物を持たない `arrivalArea` の地点は `talkAnchor` が `place: 'below'` を返し、
範囲の中央・下辺から下へ吹き出しを出す。`TalkBubble` はこの値で尾の向きごと上下を入れ替える。

ビルド時に `src/lib/content/validate-world.ts` が検査する上限(広さ・家の軒数・開始地点からの歩数)は
[../product/business-rules.md](../product/business-rules.md) にまとめてある。**上限の数値の正本は `validate-world.ts` の定数。**

## 昼夜と天気

- 時間帯は4段階(`dawn` / `day` / `dusk` / `night`)。判定は `src/utils/day-phase.ts` で、**JST 固定**(UTC+9)。どの国から見ても同じ空になる → [ADR 0006](../decisions/0006-jst-fixed-day-phase.md)
- 段階の一覧 `DAY_PHASES` が唯一の正本。段階を足すと、シート焼き・CSS 規則・テストの網羅を手書き配列で持っている側が型エラーで落ちる
- 切り替えるのは村の根要素の `data-phase` 1属性だけ。シートは4段階ぶんビルド済みで、初回ペイント前にインラインスクリプトが実際の段階を書き込む
- 夜の灯りも Canvas を使わない偽物。光源1つにつき丸い div を1枚置き、にじみは放射グラデーション1本が描く。光源の表は `src/lib/village/lights.ts`、敷くのは `src/components/VillagePage/components/Village/components/Lighting/`。点けるのは `[data-phase='night']` のときだけの CSS で、rAF がするのは主人公のランタンへ人物と同じ transform を書く1行だけ
- 天気は実行時に1回だけ外へ問い合わせる。失敗は全部「降っていない」に丸める → [data-flow.md](data-flow.md)

## 新しい構造物の種類を足すとき

既存の種類を置くだけならデータ(`content/world.ts`)で済む。**種類そのものを増やすときは次を揃える。**
欠けると型エラーか、絵の抜けた状態でビルドが通ってしまう。

1. `content/types/world.ts` — `Structure` の union に追加
2. `src/lib/village/facade.ts` — 1マスずつのスプライトへの展開
3. `src/lib/pixel/structures.ts` — 絵の定義
4. `src/lib/pixel/sprites.ts` — スプライトキーの一覧に載る(上の追加から導かれる)
5. `src/lib/village/collision.ts` — **占有マスが 1×1 でないときだけ**。`structureRect` は既定で 1×1 を返すので、
   1マスの設置物は足さなくてよい(足すと同じ判定が二重になる)
6. `src/lib/village/lights.ts` — **夜に灯る種類のときだけ**。`GLOW` の表へ1行足すと夜の光源になる(たき火はこの手順で足した)。
   机のように灯らない種類は足さない

## 触るときの順番

1. 地形・地点・文言を変える → `content/` を直す([../../content/AGENTS.md](../../content/AGENTS.md))
2. 移動や判定の規則を変える → `src/lib/village/` を直し、隣の `*.test.ts` を先に落としてから通す
3. 絵を変える → `src/lib/pixel/`([../../src/lib/pixel/AGENTS.md](../../src/lib/pixel/AGENTS.md))
4. 画面・操作を変える → `src/components/VillagePage/`([../../src/components/VillagePage/AGENTS.md](../../src/components/VillagePage/AGENTS.md))

検証は `npm run test`(規則と絵)と `npm run test:e2e`(導線・レイアウト・昼夜)。
どこまで走らせるかは [../agents/verification.md](../agents/verification.md)。
