// カメラを主人公へ減衰追従させ、ワールドの層をずらす transform を DOM へ直接書く。
// 人物もカメラと同じマス寸法(px)と補間座標で置くので、その 2 つもここで求めて描く側へ返す
import type { RefObject } from 'react'
import type { World } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { approachCamera, cameraOffset, VIEW_COLS } from '../../use-stage-scale'
import type { CameraFrame, WalkFrameState } from './types'

// 表示座標 = マス座標 + 移動中の補間。reduced motion では補間せず到着マスへ飛ぶ
const visualCell = (state: MoveState, reduceMotion: boolean): { x: number; y: number } => {
  if (state.motion === null || reduceMotion) return state.cell
  const { from, to, progress } = state.motion
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
}

// カメラを描く先
export type CameraTargets = {
  frame: HTMLElement
  layer: HTMLElement | null
  // 今のカメラ原点(マス単位)。タップ位置をワールド座標へ直すため入力側が読む
  camRef: RefObject<{ x: number; y: number }>
}

export const paintCamera = (
  frameState: WalkFrameState,
  { frame, layer, camRef }: CameraTargets,
  world: World,
  state: MoveState,
  reduceMotion: boolean,
  dtMs: number
): CameraFrame => {
  // マスの実寸は表示枠(10列)基準。ワールドが広くてもマスの大きさは変えない。
  // 幅は覚えた値を使う。毎フレーム clientWidth を読むと、直前のスタイル変更(CSS アニメーション・
  // React のコミット)の再計算をその場で強いる。測る前(最初のフレーム)だけ直接読む
  const px = (frameState.frameWidth ?? frame.clientWidth) / VIEW_COLS
  const v = visualCell(state, reduceMotion)
  // 目標はプレイヤーの補間座標。1:1で貼り付けると歩行の揺れがそのまま画面全体に出る
  const target = cameraOffset(world, v)
  // 家や町へ移った瞬間は追従させない。差が1.5マス以内の切替でもスライドさせず切る
  const switched = frameState.paintedWorld !== world
  frameState.paintedWorld = world
  const previous = frameState.smoothedCam
  const cam = previous === null || switched ? target : approachCamera(previous, target, dtMs)
  frameState.smoothedCam = cam
  // 見えている位置をそのまま入力側へ渡す。タップのワールド換算が画面とずれない
  camRef.current = cam
  // 整数pxで寄せないとタイルの継ぎ目に1pxの隙間が出る
  if (layer !== null)
    layer.style.transform = `translate(${-Math.round(cam.x * px)}px, ${-Math.round(cam.y * px)}px)`
  // approachCamera は残差が半 px を切ると目標そのものを返すので、追い付けば等号で揃う
  return { px, v, switched, caughtUp: cam.x === target.x && cam.y === target.y }
}
