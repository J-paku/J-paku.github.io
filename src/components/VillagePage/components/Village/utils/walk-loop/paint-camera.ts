// カメラを主人公へ減衰追従させ、ワールドの層をずらす transform を DOM へ直接書く。
// 飛んでいる間だけは減衰させず目標へそのまま置く。
// 人物もカメラと同じマス寸法(px)と補間座標で置くので、その 2 つもここで求めて描く側へ返す
import type { RefObject } from 'react'
import type { World } from '@content/types/world'
import { flightCameraLift, flightPosition } from '@/lib/village/flight'
import type { MoveState } from '@/lib/village/movement'
import { approachCamera, cameraOffset, VIEW_COLS } from '../stage-scale'
import type { CameraFrame, WalkFrameState } from './types'

// 歩きの表示座標 = マス座標 + 移動中の補間。reduced motion では補間せず到着マスへ飛ぶ
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
  // 飛んでいる間は飛行の地上の位置(影の位置)を表示座標にし、カメラもそこを追う。浮いた高さは人物を置く側が足す
  const v = flightPosition(state) ?? visualCell(state, reduceMotion)
  // 目標はプレイヤーの補間座標。飛んでいる間は浮いた高さの半分だけ上を狙い、浮いた絵も地上の影も枠に収める
  // (飛んでいなければ持ち上げは 0)
  const target = cameraOffset(world, { x: v.x, y: v.y - flightCameraLift(state) })
  // 家や町へ移った瞬間は追従させない。差が1.5マス以内の切替でもスライドさせず切る
  const switched = frameState.paintedWorld !== world
  frameState.paintedWorld = world
  const previous = frameState.smoothedCam
  // 歩く間は減衰追従させる。1:1で貼り付けると歩行の揺れがそのまま画面全体に出る。
  // 飛び立った直後は 1 フレームで最大 1 マス近く進むので、減衰させると遅れが 1.5 マスを超えて補間をやめ、
  // 数フレームおきに目標へ飛んで背景が跳ねる。飛行の動きは曲線で滑らかなので、目標へそのまま付ける。
  // 着地した後は目標がほぼ同じ所から減衰追従へ戻るので跳ねない
  const pinned = previous === null || switched || state.flight !== null
  const cam = pinned ? target : approachCamera(previous, target, dtMs)
  frameState.smoothedCam = cam
  // 見えている位置をそのまま入力側へ渡す。タップのワールド換算が画面とずれない
  camRef.current = cam
  // 整数pxで寄せないとタイルの継ぎ目に1pxの隙間が出る
  if (layer !== null)
    layer.style.transform = `translate(${-Math.round(cam.x * px)}px, ${-Math.round(cam.y * px)}px)`
  // approachCamera は残差が半 px を切ると目標そのものを返すので、追い付けば等号で揃う
  return { px, v, switched, caughtUp: cam.x === target.x && cam.y === target.y }
}
