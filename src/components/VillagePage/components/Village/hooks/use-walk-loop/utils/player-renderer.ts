// 人物のコマ・反転・位置と、人物に付いて回る要素(目印・吹き出しの土台・灯り)の transform を DOM へ直接書く。
// React の state を経由させると再レンダーで駒が飛ぶので rAF の中で書き、同じ値は書き直さない
import type { RefObject } from 'react'
import type { SheetLayout } from '@/lib/pixel/art'
import type { MoveState } from '@/lib/village/movement'
import { playerPose, type FishingPose } from '@/lib/village/player-pose'
import { spriteIndex } from '../../../sprite-style'
import type { CameraFrame, WalkFrameState } from './types'

// コマを決めるのに読むもの。ref は呼ばれた時点の値を読み直す
export type PoseSources = {
  playerRef: RefObject<HTMLDivElement | null>
  stateRef: RefObject<MoveState>
  fishingPoseRef: RefObject<FishingPose | null>
  reduceMotion: boolean
  sprites: SheetLayout
}

// 人物と同じ位置へ付いて回る要素
export type FollowerRefs = {
  locatorRef: RefObject<HTMLDivElement | null>
  hintRef: RefObject<HTMLDivElement | null>
  playerLightRef: RefObject<HTMLDivElement | null>
}

// 人物のコマ(向き・歩き・竿)と反転を DOM へ書く。位置は直前のまま使うので、
// 歩行が止まっている間でも呼べる。同じコマならシートの添字は書き換えない。
// 釣りの段階の中でまだコマが時間で変わる間(投げる・かかった合図・引き上げ)は true を返し、
// ループを眠らせない。いつまで変わるかは playerPose の時間表だけが知っていて、ここでは数えない
export const writePose = (
  frameState: WalkFrameState,
  { playerRef, stateRef, fishingPoseRef, reduceMotion, sprites }: PoseSources
): boolean => {
  const player = playerRef.current
  if (player === null) return false
  // 最初の paint より前は位置がまだ決まっていない。空の shift を書くと左上へ飛ぶので触らない
  if (frameState.shift === '') return false
  // 経過は重ね表示がその段階へ入った時に書いた時刻から数える
  const fishing = fishingPoseRef.current
  const { key, flip, animating } = playerPose(
    stateRef.current,
    reduceMotion,
    fishing?.phase ?? null,
    fishing === null ? 0 : performance.now() - fishing.since
  )
  const transform = `${frameState.shift}${flip ? ' scaleX(-1)' : ''}`
  if (frameState.lastTransform !== transform) {
    frameState.lastTransform = transform
    player.style.transform = transform
  }
  if (frameState.spriteKey !== key) {
    frameState.spriteKey = key
    player.dataset.sprite = key
    player.style.setProperty('--i', String(spriteIndex(sprites, key)))
  }
  // その段階のコマが進み切った後(振り終えた構え・合図の後の力み・掲げた後)は時間で変わらないので眠ってよい
  return animating
}

// 人物をカメラと同じマス寸法で置き、コマを書き、付いて回る要素を同じ位置へ揃える。
// コマの書き込みは applyPose(フック側で sources を束ねたもの)に任せる。まだコマが時間で変わるなら true
export const placePlayer = (
  frameState: WalkFrameState,
  { locatorRef, hintRef, playerLightRef }: FollowerRefs,
  { px, v, switched }: CameraFrame,
  applyPose: () => boolean
): boolean => {
  // ワールドが替わると React が人物の style を開始マスの値で書き直すので、覚えている
  // transform は当てにならない。次の applyPose で必ず書き直させる
  if (switched) frameState.lastTransform = ''
  const shift = `translate(${v.x * px}px, ${v.y * px}px)`
  frameState.shift = shift
  const posing = applyPose()
  // 目印は反転させず、プレイヤーと同じ位置に重ねる(上への持ち上げは CSS 側)
  const locator = locatorRef.current
  if (locator !== null) locator.style.transform = shift
  // 考え事の吹き出しの土台も反転させず、プレイヤーと同じ位置へ毎フレーム追従させる
  const hint = hintRef.current
  if (hint !== null) hint.style.transform = shift
  // 主人公が持つ灯りも同じ位置へ。光は左右対称なので向きが変わっても反転させない
  const playerLight = playerLightRef.current
  if (playerLight !== null) playerLight.style.transform = shift
  return posing
}
