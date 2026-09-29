---
status: active
read_when:
  - 村の地形・会話地点・移動・当たり判定を変えるとき
  - 村の UI(操作帯・会話窓・地図)を変えるとき
source_of_truth: true
last_reviewed: 2026-09-28
---

# 村(トップ画面)

歩いて回れる一画面のマップ。**Canvas も WebGL もゲームエンジンも使わない。** マス目は CSS Grid、
キャラクターは `transform` 1枚、絵は PNG スプライトシートの `background-position` で切り出す。

歩行ループ(`src/components/VillagePage/components/Village/hooks/use-walk-loop/use-walk-loop.ts`)は rAF で人物とカメラの `transform` を DOM へ直接書くが、入力も経路も無く描き終えた
(カメラが追い付き、釣り・傘のコマも動き終えた)間は次のフレームを頼まずに眠る。キー・スティック・タップ・ワールドの移動・窓を閉じる・
釣りの段階の切り替わり・傘を開く/畳む動きの始まり・枠の大きさの変化で起こし、回っているかは枠の `data-village-loop`(`running` / `idle`)に出る。

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
| `lamp-veil.ts` | 主人公の立つマスに街灯の絵が重なるかの判定。重ねる絵は持たない |
| `movement.ts` | 移動状態の遷移。時間は呼び出し側(rAF)が渡す。1ステップで新しく始めるのは最大1マス |
| `path.ts` | 4方向 BFS。マップが小さいので経路キャッシュは持たない |
| `spot.ts` | 会話地点の判定と、コース順(`order`)での次の地点探索。`order` は全ワールド通しの通番 |
| `warp.ts` | ワープ床・扉の判定 |
| `facade.ts` | 構造物を1マスずつのスプライトへ展開する |
| `lights.ts` | 夜だけ灯る光源の表。位置も半径もマス単位で持つデータで、光の計算はしない。窓のマスは `facade.ts` から引く |
| `player-pose.ts` | 向きと歩行コマからスプライトのキーと左右反転を決める |
| `umbrella.ts` | 雨の日に扉を通る時、傘を畳んでから移るか・移ってから開くかの判定と、動きの無い時の傘の状態 |

## 世界の構造

`WorldSet` = 複数の `World`。現在は屋外の町と屋内の自室。`kind: 'exterior'` のワールドだけがミニマップと拡大地図を持つ。
座標は左上原点の整数マス、`tiles[y][x]` で引く。型は `content/types/world.ts`。

コース(`order`)は8か所で、自室の PC(`home`)1 → 名刺工房(`meishi`)2 → 研究所(`lab`)3 →
経歴碑(`monument`)4 → AIロボ(`robot`)5 → 焚き火(`campfire`。立ち位置 (9,14))6 → ポスト(`mailbox`)7 →
次の旅(`journey`)8 の順。会話窓の「次へ」は次の番号の地点まで自動で歩き、8か所すべてで話すと
完走の案内(`text.allSeen`)が出る。コース外(`order` 無し)は卓上時計(`action: 'clock'`)と
池(`action: 'fishing'`)の2つで、どちらも訪問数に数えない。

北の道だけは外周の木の壁を抜けて町の外へ続き、その突き当たりの `arrivalArea` に入ると
「次の旅」の会話窓が開く。範囲内で横へ動いても開き直さず、一度道を戻って入り直すと再び開く。
経歴碑は道の左右の木の手前に置く。次の旅も経歴碑もコースに入り、訪問数に数える。
配置の正本は `content/world.ts`。

拡大地図には地点名の文字を載せない。地点ごとに番号の印(`data-spot-id` を持つボタン。読み上げ名は
`text.fastTravel` の `{place}` を地点名に置き換えたもの)を置き、地図の下に同じ番号の凡例(`<ol>`。
各項目は「番号 地点名」のボタンで、話した地点には ✓)を並べる。番号はコース順の 1..8 に続けて池が 9。
自室は町に無いので番号 1 の印を自宅の扉 (14,11) に付け、町で押すと扉 → 部屋 → PC の前まで自動で歩く。
行き先の印(赤いピン)は「次へ」・地図からの移動・舞台のタップ/ドラッグで立ち、いま向かうマスを指す
(ドラッグ中は向かうマスが変わるたびに指先のマスへ移る)。着いた時とワールド移動で下りる。大きさは半マス。
舞台のタップ/ドラッグで壁の扉(ワープのある通行不可のマス。自宅の扉 (14,11) など)を指すと、隣のマスまで歩いて
最後の 1 歩で扉へぶつかってそのまま通り(`src/lib/village/warp.ts` の `routeToCell`。ワープの無い壁・水は無視する)、
雨の日はキーで扉へぶつかった時と同じく傘を畳んでから入る。
舞台で地点の物(`spot.structureId`の構造物。家は壁の行`solid`で、屋根は含めない)を押すと、その物に話しかけられるマス
(`spotAt`がその地点を返すマス)のうち最短の所まで歩き、着いたらAを押した時と同じく話しかける(卓上時計は時間設定の窓)。
印はそのマスに立ち、もう立っていれば歩かずに開く。途中のキー・スティック・別のタップやドラッグで取り消す(`src/lib/village/spot.ts`の`objectSpotAt`・`routeToSpot`)。

街灯は絵が縦 1×2(上が笠とガラス、下が地面まで下りる柱と台座)で、構造物の `cell` は上のマス。
通行不可は柱の立つ下の 1 マスだけで、灯のある上のマスは歩いて通れる。**占有マスが `cell` と
一致しない唯一の構造物**で、`structureRect` は街灯にだけ `{ x, y: y + 1, w: 1, h: 1 }` を返す。
主人公が街灯の描かれたマス(= 上のマス)に立つと、主人公の上へ半透明の街灯を 1 組だけ重ね描きする。
狙いは、笠の裏を通り抜ける間に主人公が街灯へ隠れて見えなくなるのを防ぐこと。重なりの判定は
`src/lib/village/lamp-veil.ts` の純粋関数 `lampVeilAt()`、重ね描きする層は
`src/components/VillagePage/components/Village/components/LampVeil/`。

自室には卓上時計(`clock`。小机ごと1マス、通行不可)を置く。この地点だけは `Spot.action` が `'clock'` で、
話しかけると会話窓ではなく時間設定の窓が開く。文言は `text.stops` ではなく `text.clock` が持ち、
コース外(`order` 無し)なので訪問数にも数えない。

池のほとりでは釣りができる。立っているマスの向かいが `water` のときに吹き出しが出て、
Z キー / 画面の A / 吹き出しのボタンで直接投げる(E キーも可)。竿を振り、浮き → 巻物 → 経験の会話窓へ進む。
主人公は投げる 4 コマ(振りかぶり・引き・振り下ろし・振り抜き)の後に構え、かかると張る・引かれるのコマで合図に応え、
釣り上げでは引き上げてから掲げる(コマの時間割の正本は `src/lib/village/player-pose.ts`)。
どのコマも立つマスと足元は動かさず、動きを控える設定では時間で替わらない静止コマ(構え・張る・掲げる)だけを出す。
投げてから巻物が跳ねるまでは、竿の先から浮きまで糸をドット絵で渡す(竿を振っている間は隠す)。
水辺ならどの岸でも釣れるが、地図から移れるように東の岸 (6,15) には左の水面を向く地点 `pond`(`Spot.action` が `'fishing'`。構造物を持たないので `structureId` も `arrivalArea` も無い)を置く。
ここに立っても出る吹き出しは水辺の誘い(`text.fishing.prompt`)1つだけで、A / E / Enter は会話窓ではなく釣りを始める。
文言は `text.stops` ではなく `text.fishing` が持ち(地点名は `text.fishing.place`)、規則は `src/lib/village/fishing.ts`。釣果はプロフィールの
`careers[current].detail.features` をそのまま並べたもので、訪問数には数えない。
全部を釣り上げて結果窓を閉じた後は、水辺の吹き出しがボタンの無い考え事(`text.fishing.exhausted`)に替わり、もう投げない。
釣った一覧は保存せずタブを開いている間だけ覚える(開き直す度に最初から釣り集められる)。

外周のマスは吹き出しの置き場が上に無い(吹き出しは指す点の上へ約2マス分を使う)。
建物を持たない `arrivalArea` の地点は `talkAnchor` が `place: 'below'` を返し、
範囲の中央・下辺から下へ吹き出しを出す。`TalkBubble` はこの値で尾の向きごと上下を入れ替える。
それ以外の地点は、地点の正規の会話マス(`spot.cell`)ではなく主人公が実際に立つマスで位置を決める。
物より上に立てば主人公の頭上、下・横に立てば物の中央・上辺。
正規の会話マスで決めると、別の辺から話しかけた時に吹き出しが浮いて枠の上で切れる。

ビルド時に `src/lib/content/validate-world.ts` が検査する上限(広さ・家の軒数・開始地点からの歩数)は
[../product/business-rules.md](../product/business-rules.md) にまとめてある。**上限の数値の正本は `validate-world.ts` の定数。**

## 昼夜と天気

- 時間帯は4段階(`dawn` / `day` / `dusk` / `night`)。判定は `src/utils/day-phase.ts` で、**JST 固定**(UTC+9)。どの国から見ても同じ空になる → [ADR 0006](../decisions/0006-jst-fixed-day-phase.md)
- 段階の一覧 `DAY_PHASES` が唯一の正本。段階を足すと、シート焼き・CSS 規則・テストの網羅を手書き配列で持っている側が型エラーで落ちる
- 切り替えるのは村の根要素の `data-phase` 1属性だけ。シートは4段階ぶんビルド済みで、初回ペイント前にインラインスクリプトが実際の段階を書き込む
- 起動後に全段階のシートを先読みし、以後の時間帯の切替は地形・主人公の両画像が描けてから行う。取得失敗・遅延中は直前の段階を保ち、1分ごとに再試行する
- 夜の灯りも Canvas を使わない偽物。光源1つにつき丸い div を1枚置き、にじみは放射グラデーション1本が描く。光源の表は `src/lib/village/lights.ts`、敷くのは `src/components/VillagePage/components/Village/components/Lighting/`。点けるのは `[data-phase='night']` のときだけの CSS で、rAF がするのは主人公のランタンへ人物と同じ transform を書く1行だけ
- 天気は実行時に1回だけ外へ問い合わせる。失敗は全部「降っていない」に丸める → [data-flow.md](data-flow.md)

### 雨の日の傘

雨(`rain`)の日だけ、主人公は屋外で傘を差す。雪・晴れ・取得失敗では出さない。

- 屋内(`kind` が `exterior` でないワールド)から屋外へ扉を出ると、戸口で下を向いたまま懐から傘を取り出して開く(880ms)。屋外にいる間は傘を差したまま立ち・歩く
- 屋外から屋内の扉へ入る時は、屋外に留まったまま上を向いて傘を畳み、懐へしまってから屋内へ移る(960ms。ワールドの切り替えはしまい終えるまで待たせる)
- 開く動きは扉を通った時ではなく、屋外のワールドの描画が確定した(React が DOM へ反映した)時から数える。扉を通ってから新しいタイルが載るまで歩行ループは主人公を描かないので、通った時から数えると遅い端末ほど最初のコマが見えないまま過ぎる。起点を付け直すのは `use-village-umbrella` の layout effect で、`umbrellaPose` を書くのはこのフックだけ
- 開く・畳む間は立つマスと向きを固定し、方向の入力では動き出さない(`umbrellaBusy`)。入力は捨てずに残し、押しっぱなしの向き・ポインタ・自動の経路は動き終えた後に読む(ワープ直後の押しっぱなしを離すまで読まない決まりは別にあり、そちらはそのまま効く)。コマが時間で替わる間は歩行ループを眠らせず、動きを始めた時に起こす
- 釣りのコマは傘より優先する。釣り終えて屋外の雨の中なら、その向きの傘を差した立ち姿へ戻る
- 動きを控える設定では取り出す・畳むの途中のコマを出さず、入力の錠も掛けずに、差した状態・しまった状態をすぐ当てる
- どの扉の移動で開く・畳むか(`planUmbrellaWarp`)と、動きの無い時の傘の状態(`restingUmbrella`)は `src/lib/village/umbrella.ts` の純粋関数。コマの時間割と長さ(`UMBRELLA_OPEN_MS` / `UMBRELLA_CLOSE_MS`)の正本は `src/lib/village/player-pose.ts`、コマの鍵の並び(`UMBRELLA_OPEN_STEPS` / `UMBRELLA_CLOSE_STEPS`)は `src/lib/pixel/sprites.ts`。歩行ループへは runtime の `umbrellaPose` で渡す

## 新しい構造物の種類を足すとき

既存の種類を置くだけならデータ(`content/world.ts`)で済む。**種類そのものを増やすときは次を揃える。**
欠けると型エラーか、絵の抜けた状態でビルドが通ってしまう。

1. `content/types/world.ts` — `Structure` の union に追加
2. `src/lib/village/facade.ts` — 1マスずつのスプライトへの展開
3. `src/lib/pixel/structures.ts` — 絵の定義
4. `src/lib/pixel/sprites.ts` — スプライトキーの一覧に載る(上の追加から導かれる)
5. `src/lib/village/collision.ts` — **占有マスが 1×1 でないときだけ**。`structureRect` は既定で 1×1 を返すので、
   1マスの設置物は足さなくてよい(足すと同じ判定が二重になる)。ただし**1×1 でも `cell` と占有マスがずれるなら足す**
   — 街灯は `cell` が絵の上のマスで、塞ぐのはその 1 つ下のマスなので、既定のままでは違うマスを塞ぐ
6. `src/lib/village/lights.ts` — **夜に灯る種類のときだけ**。`GLOW` の表へ1行足すと夜の光源になる(たき火はこの手順で足した)。
   机のように灯らない種類は足さない
7. `Spot.action` — **会話窓ではなく専用の窓を開く地点のときだけ**。その地点は `text.stops` を持たないので、
   `src/lib/content/validate-world.ts` の文言検査から除く(卓上時計と池はこの手順で足した)

## 触るときの順番

1. 地形・地点・文言を変える → `content/` を直す([../../content/AGENTS.md](../../content/AGENTS.md))
2. 移動や判定の規則を変える → `src/lib/village/` を直し、隣の `*.test.ts` を先に落としてから通す
3. 絵を変える → `src/lib/pixel/`([../../src/lib/pixel/AGENTS.md](../../src/lib/pixel/AGENTS.md))
4. 画面・操作を変える → `src/components/VillagePage/`([../../src/components/VillagePage/AGENTS.md](../../src/components/VillagePage/AGENTS.md))

検証は `npm run test`(規則と絵)と `npm run test:e2e`(導線・レイアウト・昼夜)。
どこまで走らせるかは [../agents/verification.md](../agents/verification.md)。
