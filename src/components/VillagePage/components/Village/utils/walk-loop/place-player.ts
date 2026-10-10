// 人物のコマ・反転・位置と、人物に付いて回る要素(目印・吹き出しの土台・灯り)・飛行の影の transform を DOM へ直接書く。
// React の state を経由させると再レンダーで駒が飛ぶので rAF の中で書き、同じ値は書き直さない
import type { RefObject } from 'react'
import type { SheetLayout } from '@/lib/pixel/art'
import { flightLiftCells, flightShadow, type Flying } from '@/lib/village/flight'
import type { MoveState } from '@/lib/village/movement'
import { playerPose, type FishingPose, type UmbrellaPose } from '@/lib/village/player-pose'
import { spriteIndex } from '../sprite-style'
import type { CameraFrame, WalkFrameState } from './types'

// コマを決めるのに読むもの。ref は呼ばれた時点の値を読み直す
export type PoseSources = {
  playerRef: RefObject<HTMLDivElement | null>
  stateRef: RefObject<MoveState>
  fishingPoseRef: RefObject<FishingPose | null>
  umbrellaPoseRef: RefObject<UmbrellaPose | null>
  reduceMotion: boolean
  sprites: SheetLayout
}

// 人物と同じ位置へ付いて回る要素。飛行の影だけは浮かせず地上の位置に置く
export type FollowerRefs = {
  locatorRef: RefObject<HTMLDivElement | null>
  hintRef: RefObject<HTMLDivElement | null>
  playerLightRef: RefObject<HTMLDivElement | null>
  shadowRef: RefObject<HTMLDivElement | null>
}

// 人物のコマ(向き・歩き・竿・傘)と反転を DOM へ書く。位置は直前のまま使うので、
// 歩行が止まっている間でも呼べる。同じコマならシートの添字は書き換えない。
// 釣りの段階の中でまだコマが時間で変わる間(投げる・かかった合図・引き上げ)と、傘を広げる・畳む間は
// true を返し、ループを眠らせない。いつまで変わるかは playerPose の時間表だけが知っていて、ここでは数えない
export const writePose = (
  frameState: WalkFrameState,
  { playerRef, stateRef, fishingPoseRef, umbrellaPoseRef, reduceMotion, sprites }: PoseSources
): boolean => {
  const player = playerRef.current
  if (player === null) return false
  // 最初の paint より前は位置がまだ決まっていない。空の shift を書くと左上へ飛ぶので触らない
  if (frameState.shift === '') return false
  // 経過は重ね表示がその段階へ入った時に書いた時刻から数える(傘も印をその段階へ書き換えた時刻から)
  const fishing = fishingPoseRef.current
  const umbrella = umbrellaPoseRef.current
  const { key, flip, animating } = playerPose(
    stateRef.current,
    reduceMotion,
    fishing?.phase ?? null,
    fishing === null ? 0 : performance.now() - fishing.since,
    umbrella?.phase ?? null,
    umbrella === null ? 0 : performance.now() - umbrella.since
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
  // その段階のコマが進み切った後(振り終えた構え・合図の後の力み・掲げた後・傘を広げ終えた・畳み終えた後)は
  // 時間で変わらないので眠ってよい
  return animating
}

// 影の data-flying を書く('false' なら CSS が隠す)。前に書いた値と同じなら書き直さない
const writeShadowFlying = (
  frameState: WalkFrameState,
  shadow: HTMLDivElement,
  inFlight: 'true' | 'false'
): void => {
  if (frameState.shadowFlying === inFlight) return
  frameState.shadowFlying = inFlight
  shadow.dataset.flying = inFlight
}

// 飛行の影を地上の位置(浮かせる前の表示座標)へ置き、浮いた高さに応じて縮める。
// 飛んでいない間も等倍で同じ位置へ書き、data-flying='false' で CSS が隠す。どちらも前に書いた値と同じなら書き直さない
const placeShadow = (
  frameState: WalkFrameState,
  shadow: HTMLDivElement | null,
  { px, v }: CameraFrame,
  flying: Flying
): void => {
  if (shadow === null) return
  const transform = `translate(${v.x * px}px, ${v.y * px}px) scale(${flightShadow(flying)})`
  if (frameState.shadowTransform !== transform) {
    frameState.shadowTransform = transform
    shadow.style.transform = transform
  }
  writeShadowFlying(frameState, shadow, flying.flight === null ? 'false' : 'true')
}

// 影を隠す(data-flying='false')。位置は書かない — 次に placePlayer が描く時に書き直す。
// 新しいワールドのタイルを待つ間に使う。待つ間は人物も影も描き直さないので、着地と扉が同じフレームだと
// 前のワールドで飛んでいた印と位置が、隠されないまま新しいワールドの上に残る
export const hideShadow = (frameState: WalkFrameState, shadow: HTMLDivElement | null): void => {
  if (shadow === null) return
  writeShadowFlying(frameState, shadow, 'false')
}

// 人物をカメラと同じマス寸法で置き、コマを書き、付いて回る要素を同じ位置へ揃える。
// 飛んでいる間は人物と付いて回る要素を浮いた高さだけ上へずらし、影は地上の位置に残す。
// コマの書き込みは applyPose(フック側で sources を束ねたもの)に任せる。まだコマが時間で変わるなら true
export const placePlayer = (
  frameState: WalkFrameState,
  { locatorRef, hintRef, playerLightRef, shadowRef }: FollowerRefs,
  camera: CameraFrame,
  flying: Flying,
  applyPose: () => boolean
): boolean => {
  const { px, v, switched } = camera
  // ワールドが替わると React が人物の style を開始マスの値で書き直すので、覚えている
  // transform は当てにならない。次の applyPose で必ず書き直させる
  if (switched) frameState.lastTransform = ''
  const shift = `translate(${v.x * px}px, ${(v.y - flightLiftCells(flying)) * px}px)`
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
  placeShadow(frameState, shadowRef.current, camera, flying)
  return posing
}
