// 歩行ループの部品が共有する型。フレームをまたいで生きる値は、フックが useRef で 1 回だけ作った
// 入れ物(WalkFrameState)にまとめて部品へ渡す。部品ごとに ref を持たせると、
// どの値をどの部品が書くのかがフックの外から追えなくなるため 1 か所に集める
import type { Cell, World } from '@content/types/world'
import type { VillageRuntime } from '../../village-runtime'

export type WalkFrameState = {
  spriteKey: string
  fishingTarget: Cell | null
  // 新しいワールドの DOM を待ち始めた時刻。null は待っていない
  waitSince: number | null
  // ワープ直後に押しっぱなしの方向をそのまま食べると、向かい合う扉へ即座に吸い込まれて往復する。
  // ワールドが変わったら一度キーを離すまで方向入力を捨てる
  enteredWorld: World | null
  ignoreHeld: boolean
  // 直前に経路を作った押しっぱなし先のマス。同じマスなら毎フレーム経路を作り直さない
  plannedTarget: Cell | null
  // ワープ直後は押しっぱなしのマスが前のワールドの座標のままなので、一度離す(null になる)まで捨てる。
  // ignoreHeld と同じ考え方
  staleTarget: boolean
  // 減衰追従した後のカメラ原点。null は初回(補間せず目標から始める)
  smoothedCam: { x: number; y: number } | null
  // 直前に描いたワールド。差し替わったフレームは補間を挟まず新しい原点へ飛ばす
  paintedWorld: World | null
  // 直前に書いた人物の位置。止まっている間も同じ位置のまま向きと反転だけ書き直すため覚えておく
  shift: string
  // 直前に書いた人物の transform。釣りで止めている間は毎フレーム同じ値になるので、
  // 変わった時だけ書いて CSSOM への書き込みを空振りさせない
  lastTransform: string
  // 枠の幅(px)。ResizeObserver が大きさの変わった時だけ書き、描く側はこれを読む。null はまだ測っていない
  frameWidth: number | null
  // 直前に街灯を調べたマス(ワールド id 込み)。同じマスに立っている間は調べ直さない
  veilCell: string
  // 直前に重ねた街灯(ワールド id 込み。空文字はどれにも重なっていない)。
  // 街灯が変わったフレームだけ層を書き換える
  veilId: string
}

// 1 フレームの移動と経路づくりが読み書きする ref の束。どれも village-runtime が作った runtime の一部で、
// ここでは毎フレーム .current を読み直す(値を写し取ると入力側の更新を取りこぼす)
export type MoveRefs = Pick<
  VillageRuntime,
  | 'world'
  | 'state'
  | 'pendingRoute'
  | 'pendingFast'
  | 'autoTalk'
  | 'locked'
  | 'held'
  | 'pointerTarget'
>

// カメラを描いた結果。人物もカメラと同じマス寸法と補間座標で置くので、描く側へそのまま渡す
export type CameraFrame = {
  // マス 1 つぶんの実寸(px)
  px: number
  // 主人公の表示座標(マス単位、移動中は補間込み)
  v: { x: number; y: number }
  // このフレームでワールドが差し替わったか
  switched: boolean
  // カメラが目標に追い付いたか
  caughtUp: boolean
}
