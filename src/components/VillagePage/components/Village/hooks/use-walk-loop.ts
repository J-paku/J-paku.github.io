// rAFで移動を1フレームずつ進め、結果をDOMへ直接書く。タップされたマスは経路にして次のステップへ渡す
import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Direction, World } from '@content/types/world'
import type { Sheet } from '@/lib/pixel/art'
import { step, type MoveState } from '@/lib/village/movement'
import { playerPose } from '@/lib/village/player-pose'
import { findPath } from '@/lib/village/path'
import { spriteIndex } from '../sprite-style'
import { approachCamera, cameraOffset, VIEW_COLS } from './use-stage-scale'

// 表示座標 = マス座標 + 移動中の補間。reduced motion では補間せず到着マスへ飛ぶ
const visualCell = (state: MoveState, reduceMotion: boolean): { x: number; y: number } => {
  if (state.motion === null || reduceMotion) return state.cell
  const { from, to, progress } = state.motion
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
}

// ワールド切替後、この時間を超えても新しいタイルが DOM に載らなければ読み込み中の覆いを出す。
// 通常は 1〜2 フレームで載るので(実測 5〜15ms)、覆いは遅い端末でしか見えない
export const LOADING_DELAY_MS = 100

export type WalkLoopOptions = {
  frameRef: RefObject<HTMLDivElement | null>
  // カメラで動く層。表示枠の中をこれごとずらしてワールドをスクロールさせる
  worldLayerRef: RefObject<HTMLDivElement | null>
  // 今のカメラ原点(マス単位)。タップ位置をワールド座標へ直すため入力側が読む
  camRef: RefObject<{ x: number; y: number }>
  playerRef: RefObject<HTMLDivElement | null>
  locatorRef: RefObject<HTMLDivElement | null>
  // ワープ後に新しいワールドの描画を待つ間だけ出す覆い。閾値を超えた時だけ見せる
  loadingRef: RefObject<HTMLDivElement | null>
  worldRef: RefObject<World>
  stateRef: RefObject<MoveState>
  pendingRouteRef: RefObject<Cell[] | null>
  pendingFastRef: RefObject<boolean>
  // 次へボタンでの自動歩行の印。利用者の入力で経路が捨てられたら取り消す
  autoTalkRef: RefObject<boolean>
  lockedRef: RefObject<boolean>
  heldRef: RefObject<Direction | null>
  sprites: Sheet
  reduceMotion: boolean
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
  tapped: Cell | null
  consumeTap: () => void
  // 押されている間、ポインタの下にあるマス。離すと null。毎フレーム読んで経路を作り直す
  pointerTargetRef: RefObject<Cell | null>
}

export function useWalkLoop({
  frameRef,
  worldLayerRef,
  camRef,
  playerRef,
  locatorRef,
  loadingRef,
  worldRef,
  stateRef,
  pendingRouteRef,
  pendingFastRef,
  autoTalkRef,
  lockedRef,
  heldRef,
  sprites,
  reduceMotion,
  arrive,
  bump,
  tapped,
  consumeTap,
  pointerTargetRef,
}: WalkLoopOptions): void {
  const spriteKeyRef = useRef('')
  // 新しいワールドの DOM を待ち始めた時刻。null は待っていない
  const waitSinceRef = useRef<number | null>(null)
  // ワープ直後に押しっぱなしの方向をそのまま食べると、向かい合う扉へ即座に吸い込まれて往復する。
  // ワールドが変わったら一度キーを離すまで方向入力を捨てる
  const enteredWorldRef = useRef<World | null>(null)
  const ignoreHeldRef = useRef(false)
  // 直前に経路を作った押しっぱなし先のマス。同じマスなら毎フレーム経路を作り直さない
  const plannedTargetRef = useRef<Cell | null>(null)
  // ワープ直後は押しっぱなしのマスが前のワールドの座標のままなので、一度離す(null になる)まで捨てる。
  // ignoreHeldRef と同じ考え方
  const staleTargetRef = useRef(false)
  // 減衰追従した後のカメラ原点。null は初回(補間せず目標から始める)
  const smoothedCamRef = useRef<{ x: number; y: number } | null>(null)
  // 直前に描いたワールド。差し替わったフレームは補間を挟まず新しい原点へ飛ばす
  const paintedWorldRef = useRef<World | null>(null)

  // 毎フレームの書き込みは DOM 直更新。React の state は到着時だけ動かす
  const paint = useCallback(
    (dtMs: number) => {
      const frame = frameRef.current
      const player = playerRef.current
      if (frame === null || player === null) return
      const state = stateRef.current
      const world = worldRef.current
      const layer = worldLayerRef.current
      // ワープ直後は React がまだ前のワールドのタイルを描いている。ここで新しい原点へ飛ばすと
      // 前のワールドが枠の外へ押し出されて黒画面だけが残る(町の描画待ちで実測約1秒)。
      // 新しいタイルが DOM に載る(data-world が一致する)まで前の場面をそのまま見せておく。
      // 待ちが閾値を超えたら読み込み中の覆いを出し、載った時点で外す
      const loading = loadingRef.current
      if (layer !== null && layer.dataset.world !== world.id) {
        const now = performance.now()
        if (waitSinceRef.current === null) waitSinceRef.current = now
        if (loading !== null && now - waitSinceRef.current > LOADING_DELAY_MS) {
          loading.dataset.show = ''
        }
        return
      }
      waitSinceRef.current = null
      if (loading !== null) delete loading.dataset.show
      // マスの実寸は表示枠(10列)基準。ワールドが広くてもマスの大きさは変えない
      const px = frame.clientWidth / VIEW_COLS
      const v = visualCell(state, reduceMotion)
      // 目標はプレイヤーの補間座標。1:1で貼り付けると歩行の揺れがそのまま画面全体に出る
      const target = cameraOffset(world, v)
      // 家や町へ移った瞬間は追従させない。差が1.5マス以内の切替でもスライドさせず切る
      const switched = paintedWorldRef.current !== world
      paintedWorldRef.current = world
      const previous = smoothedCamRef.current
      const cam = previous === null || switched ? target : approachCamera(previous, target, dtMs)
      smoothedCamRef.current = cam
      // 見えている位置をそのまま入力側へ渡す。タップのワールド換算が画面とずれない
      camRef.current = cam
      // 整数pxで寄せないとタイルの継ぎ目に1pxの隙間が出る
      if (layer !== null)
        layer.style.transform = `translate(${-Math.round(cam.x * px)}px, ${-Math.round(cam.y * px)}px)`
      const { key, flip } = playerPose(state, reduceMotion)
      const shift = `translate(${v.x * px}px, ${v.y * px}px)`
      player.style.transform = `${shift}${flip ? ' scaleX(-1)' : ''}`
      // 目印は反転させず、プレイヤーと同じ位置に重ねる(上への持ち上げは CSS 側)
      const locator = locatorRef.current
      if (locator !== null) locator.style.transform = shift
      if (spriteKeyRef.current === key) return
      spriteKeyRef.current = key
      player.dataset.sprite = key
      player.style.setProperty('--i', String(spriteIndex(sprites, key)))
    },
    [
      sprites,
      reduceMotion,
      frameRef,
      worldLayerRef,
      camRef,
      playerRef,
      stateRef,
      worldRef,
      locatorRef,
      loadingRef,
    ]
  )

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      // 長いフレーム(タブ復帰など)で一気に進まないよう上限を置く
      const elapsed = Math.min(now - last, 250)
      last = now
      // 会話・地図を開いた間は歩行の進捗と経路もその場で止める
      if (lockedRef.current) {
        raf = window.requestAnimationFrame(loop)
        return
      }
      if (enteredWorldRef.current !== worldRef.current) {
        enteredWorldRef.current = worldRef.current
        // 初回(起動時)は押しっぱなしではないので捨てる必要がない
        ignoreHeldRef.current = heldRef.current !== null
        // ワープ直後の押しっぱなしポインタは前のワールドの座標のままなので、
        // 一度離す(pointerTargetRef が null になる)まで捨てる。ignoreHeldRef と同じ考え方
        staleTargetRef.current = pointerTargetRef.current !== null
        plannedTargetRef.current = null
      }
      if (ignoreHeldRef.current && heldRef.current === null) ignoreHeldRef.current = false
      if (staleTargetRef.current && pointerTargetRef.current === null) {
        staleTargetRef.current = false
      }
      const held = ignoreHeldRef.current ? null : heldRef.current
      // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
      if (held !== null) autoTalkRef.current = false
      // 押しっぱなしのポインタへ向けて経路を作り直す。目標が変わった時、または経路を使い切って
      // 足が止まる時(motion も route も空 = step 内の startNext がそのまま停止を返す状態)に限る。
      // 同じ目標のまま経路が残っている間は毎フレーム作り直さない(足踏みしないため)
      const pointerTarget = staleTargetRef.current ? null : pointerTargetRef.current
      if (pointerTarget !== null && held === null) {
        const s = stateRef.current
        const planned = plannedTargetRef.current
        const changed =
          planned === null || planned.x !== pointerTarget.x || planned.y !== pointerTarget.y
        if (changed || (s.route.length === 0 && s.motion === null)) {
          const route = findPath(worldRef.current, s.cell, pointerTarget)
          plannedTargetRef.current = pointerTarget
          if (route !== null && route.length > 0) {
            pendingRouteRef.current = route
            pendingFastRef.current = false
            // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
            autoTalkRef.current = false
          }
        }
      } else if (pointerTargetRef.current === null) {
        plannedTargetRef.current = null
      }
      const result = step(
        worldRef.current,
        stateRef.current,
        { held, route: pendingRouteRef.current, fast: pendingFastRef.current },
        elapsed
      )
      pendingRouteRef.current = null
      pendingFastRef.current = false
      stateRef.current = result.state
      const before = worldRef.current
      if (result.arrived !== null) arrive(result.arrived)
      // 経路の最後の1歩で扉へぶつかるのは到着と同じフレーム。到着でワールドが変わっていたら古い衝突なので捨てる
      if (result.bumped !== null && worldRef.current === before) bump(result.bumped)
      paint(elapsed)
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [
    heldRef,
    arrive,
    bump,
    paint,
    lockedRef,
    worldRef,
    stateRef,
    pendingRouteRef,
    pendingFastRef,
    autoTalkRef,
    pointerTargetRef,
  ])

  // タップ → 経路を作って次のステップへ渡す。通れない場所は無視
  useEffect(() => {
    if (tapped === null) return
    const route = findPath(worldRef.current, stateRef.current.cell, tapped)
    if (route !== null && route.length > 0) {
      pendingRouteRef.current = route
      pendingFastRef.current = false
      // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
      autoTalkRef.current = false
    }
    consumeTap()
  }, [tapped, consumeTap, worldRef, stateRef, pendingRouteRef, pendingFastRef, autoTalkRef])
}
