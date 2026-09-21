// rAFで移動を1フレームずつ進め、結果をDOMへ直接書く。タップされたマスは経路にして次のステップへ渡す。
// 入力も経路も無く描き終えたら次のフレームを頼まずに眠り、入力・ワールド移動・窓を閉じる・
// 枠の大きさの変化で wakeRef から起こされる
import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Direction, World } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { step, type MoveState } from '@/lib/village/movement'
import { FISHING_SWING_MS, playerPose } from '@/lib/village/player-pose'
import { isFishingSpot } from '@/lib/village/fishing'
import { facedCell } from '@/lib/village/spot'
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

// ループが回っているか眠っているかを枠の data-village-loop に出す。E2E が眠りを確かめる取っ手で、
// 止まらない・起きない不具合を DevTools で追う手掛かりにもなる。変わった時だけ書く
const markLoop = (frame: HTMLElement | null, state: 'running' | 'idle') => {
  if (frame === null || frame.dataset.villageLoop === state) return
  frame.dataset.villageLoop = state
}

export type WalkLoopOptions = {
  frameRef: RefObject<HTMLDivElement | null>
  // カメラで動く層。表示枠の中をこれごとずらしてワールドをスクロールさせる
  worldLayerRef: RefObject<HTMLDivElement | null>
  // 今のカメラ原点(マス単位)。タップ位置をワールド座標へ直すため入力側が読む
  camRef: RefObject<{ x: number; y: number }>
  playerRef: RefObject<HTMLDivElement | null>
  locatorRef: RefObject<HTMLDivElement | null>
  // 考え事の吹き出しの土台。人物と同じ transform を受けて頭上に付いて回る
  hintRef: RefObject<HTMLDivElement | null>
  // 夜に主人公が持つ灯り。吹き出しの土台と同じく人物と同じ transform を受けて付いて回る
  playerLightRef: RefObject<HTMLDivElement | null>
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
  // 釣っている間だけ true。歩行コマの代わりに竿を持つコマを出す
  fishingPoseRef: RefObject<boolean>
  onFishingTarget: (cell: Cell | null) => void
  sprites: SheetLayout
  reduceMotion: boolean
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
  tapped: Cell | null
  consumeTap: () => void
  // 押されている間、ポインタの下にあるマス。離すと null。毎フレーム読んで経路を作り直す
  pointerTargetRef: RefObject<Cell | null>
  // 眠っているループを起こす手の置き場。use-village が作り、ここが今のループの手を入れる。
  // 入力・復元・重ね表示はこのフックより先(または外)で呼ばれるので、この ref 越しに起こす
  wakeRef: RefObject<() => void>
}

export function useWalkLoop({
  frameRef,
  worldLayerRef,
  camRef,
  playerRef,
  locatorRef,
  hintRef,
  playerLightRef,
  loadingRef,
  worldRef,
  stateRef,
  pendingRouteRef,
  pendingFastRef,
  autoTalkRef,
  lockedRef,
  heldRef,
  fishingPoseRef,
  onFishingTarget,
  sprites,
  reduceMotion,
  arrive,
  bump,
  tapped,
  consumeTap,
  pointerTargetRef,
  wakeRef,
}: WalkLoopOptions): void {
  const spriteKeyRef = useRef('')
  const fishingSinceRef = useRef<number | null>(null)
  const fishingTargetRef = useRef<Cell | null>(null)
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
  // 直前に書いた人物の位置。止まっている間も同じ位置のまま向きと反転だけ書き直すため覚えておく
  const shiftRef = useRef('')
  // 直前に書いた人物の transform。釣りで止めている間は毎フレーム同じ値になるので、
  // 変わった時だけ書いて CSSOM への書き込みを空振りさせない
  const lastTransformRef = useRef('')
  // 枠の幅(px)。ResizeObserver が大きさの変わった時だけ書き、描く側はこれを読む。null はまだ測っていない
  const frameWidthRef = useRef<number | null>(null)

  // 人物のコマ(向き・歩き・竿)と反転を DOM へ書く。位置は直前のまま使うので、
  // 歩行が止まっている間でも呼べる。同じコマならシートの添字は書き換えない。
  // 竿を振っている間はコマが時間で変わるので true を返し、ループを眠らせない
  const applyPose = useCallback((): boolean => {
    const player = playerRef.current
    if (player === null) return false
    // 最初の paint より前は位置がまだ決まっていない。空の shift を書くと左上へ飛ぶので触らない
    if (shiftRef.current === '') return false
    const now = performance.now()
    if (!fishingPoseRef.current) fishingSinceRef.current = null
    else if (fishingSinceRef.current === null) fishingSinceRef.current = now
    const fishingElapsed = fishingSinceRef.current === null ? 0 : now - fishingSinceRef.current
    const { key, flip } = playerPose(
      stateRef.current,
      reduceMotion,
      fishingPoseRef.current,
      fishingElapsed
    )
    const transform = `${shiftRef.current}${flip ? ' scaleX(-1)' : ''}`
    if (lastTransformRef.current !== transform) {
      lastTransformRef.current = transform
      player.style.transform = transform
    }
    if (spriteKeyRef.current !== key) {
      spriteKeyRef.current = key
      player.dataset.sprite = key
      player.style.setProperty('--i', String(spriteIndex(sprites, key)))
    }
    // 振り終えた後の竿のコマは時間で変わらない。釣りの残り(かかる・釣り上げる)の間は眠ってよい
    return fishingPoseRef.current && fishingElapsed < FISHING_SWING_MS
  }, [sprites, reduceMotion, playerRef, stateRef, fishingPoseRef])

  // 毎フレームの書き込みは DOM 直更新。React の state は到着時だけ動かす。
  // 描き終えて時間で変わるものが残っていなければ true を返す
  // (新しいワールドのタイルが載り、カメラが目標に追い付き、竿も振り終えた)
  const paint = useCallback(
    (dtMs: number): boolean => {
      const frame = frameRef.current
      const player = playerRef.current
      if (frame === null || player === null) return false
      const state = stateRef.current
      const world = worldRef.current
      // 向きだけ変えた時も判定する。対象が変わった時だけ React へ知らせる
      const fishingTarget =
        state.motion === null && isFishingSpot(world, state) ? facedCell(state) : null
      const previousTarget = fishingTargetRef.current
      if (previousTarget?.x !== fishingTarget?.x || previousTarget?.y !== fishingTarget?.y) {
        fishingTargetRef.current = fishingTarget
        onFishingTarget(fishingTarget)
      }
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
        return false
      }
      waitSinceRef.current = null
      if (loading !== null) delete loading.dataset.show
      // マスの実寸は表示枠(10列)基準。ワールドが広くてもマスの大きさは変えない。
      // 幅は覚えた値を使う。毎フレーム clientWidth を読むと、直前のスタイル変更(CSS アニメーション・
      // React のコミット)の再計算をその場で強いる。測る前(最初のフレーム)だけ直接読む
      const px = (frameWidthRef.current ?? frame.clientWidth) / VIEW_COLS
      const v = visualCell(state, reduceMotion)
      // 目標はプレイヤーの補間座標。1:1で貼り付けると歩行の揺れがそのまま画面全体に出る
      const target = cameraOffset(world, v)
      // 家や町へ移った瞬間は追従させない。差が1.5マス以内の切替でもスライドさせず切る
      const switched = paintedWorldRef.current !== world
      paintedWorldRef.current = world
      // ワールドが替わると React が人物の style を開始マスの値で書き直すので、覚えている
      // transform は当てにならない。次の applyPose で必ず書き直させる
      if (switched) lastTransformRef.current = ''
      const previous = smoothedCamRef.current
      const cam = previous === null || switched ? target : approachCamera(previous, target, dtMs)
      smoothedCamRef.current = cam
      // 見えている位置をそのまま入力側へ渡す。タップのワールド換算が画面とずれない
      camRef.current = cam
      // 整数pxで寄せないとタイルの継ぎ目に1pxの隙間が出る
      if (layer !== null)
        layer.style.transform = `translate(${-Math.round(cam.x * px)}px, ${-Math.round(cam.y * px)}px)`
      const shift = `translate(${v.x * px}px, ${v.y * px}px)`
      shiftRef.current = shift
      const swinging = applyPose()
      // 目印は反転させず、プレイヤーと同じ位置に重ねる(上への持ち上げは CSS 側)
      const locator = locatorRef.current
      if (locator !== null) locator.style.transform = shift
      // 考え事の吹き出しの土台も反転させず、プレイヤーと同じ位置へ毎フレーム追従させる
      const hint = hintRef.current
      if (hint !== null) hint.style.transform = shift
      // 主人公が持つ灯りも同じ位置へ。光は左右対称なので向きが変わっても反転させない
      const playerLight = playerLightRef.current
      if (playerLight !== null) playerLight.style.transform = shift
      // approachCamera は残差が半 px を切ると目標そのものを返すので、追い付けば等号で揃う
      return !swinging && cam.x === target.x && cam.y === target.y
    },
    [
      applyPose,
      reduceMotion,
      frameRef,
      worldLayerRef,
      camRef,
      playerRef,
      stateRef,
      worldRef,
      locatorRef,
      hintRef,
      playerLightRef,
      loadingRef,
      onFishingTarget,
    ]
  )

  useEffect(() => {
    // 頼んである次のフレーム。null は眠っている(またはフレームの処理中)
    let raf: number | null = null
    // フレームの処理中か。処理中に起こされた時は(到着でワールドが替わった等)眠るのを 1 回見送る
    let inFrame = false
    let wokenInFrame = false
    let last = performance.now()

    // 1 フレーム分進めて描く。まだ時間で変わるもの・読むべき入力が残っていれば true
    const tick = (elapsed: number): boolean => {
      // 会話・地図を開いた間は歩行の進捗と経路もその場で止める。
      // ただし釣りは止めている間に竿を持つコマへ変わるので、位置は据え置きでコマだけ書き直す。
      // 竿を振り終えれば止めている間に変わるものは無いので眠る(閉じる時に起こされる)
      if (lockedRef.current) return applyPose()
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
      const settled = paint(elapsed)
      // 押しっぱなしの向き・ポインタは、ワープ直後に捨てている間も生の ref で見る。
      // 離したのを見届けて(捨てる印を下ろして)から眠る
      const s = stateRef.current
      const resting =
        heldRef.current === null &&
        pointerTargetRef.current === null &&
        pendingRouteRef.current === null &&
        s.motion === null &&
        s.route.length === 0 &&
        s.turnRemainingMs === 0
      return !(resting && settled)
    }

    const loop = (now: number) => {
      raf = null
      // 長いフレーム(タブ復帰など)で一気に進まないよう上限を置く。
      // 起こした直後は起こした時刻から数えるので、同じフレームの中で起こされると負になりうる
      const elapsed = Math.min(Math.max(now - last, 0), 250)
      last = now
      inFrame = true
      wokenInFrame = false
      let busy = true
      try {
        busy = tick(elapsed)
      } finally {
        // 途中で投げても、次に起こされた時に回り直せるようにする
        inFrame = false
      }
      if (busy || wokenInFrame) {
        raf = window.requestAnimationFrame(loop)
        return
      }
      markLoop(frameRef.current, 'idle')
    }

    // 眠っていれば次のフレームを頼む。回っている間は何もしない
    const wake = () => {
      if (inFrame) {
        wokenInFrame = true
        return
      }
      if (raf !== null) return
      // 眠っていた間を 1 フレームの経過として数えない
      last = performance.now()
      raf = window.requestAnimationFrame(loop)
      markLoop(frameRef.current, 'running')
    }

    wakeRef.current = wake
    markLoop(frameRef.current, 'running')
    raf = window.requestAnimationFrame(loop)
    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf)
      // 外したループを起こさない。後始末の後に届いた入力で、描く先の無いループが回り出すのを防ぐ
      if (wakeRef.current === wake) wakeRef.current = () => {}
    }
  }, [
    heldRef,
    arrive,
    bump,
    paint,
    applyPose,
    lockedRef,
    worldRef,
    stateRef,
    pendingRouteRef,
    pendingFastRef,
    autoTalkRef,
    pointerTargetRef,
    frameRef,
    wakeRef,
  ])

  // 枠の幅を覚え、変わったらループを起こして新しいマス寸法で描き直させる。
  // 幅を読むのは大きさが変わった時だけで、描く側は毎フレーム覚えた値を使う
  useEffect(() => {
    const frame = frameRef.current
    if (frame === null) return
    const observer = new ResizeObserver(() => {
      frameWidthRef.current = frame.clientWidth
      wakeRef.current()
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [frameRef, wakeRef])

  // タップ → 経路を作って次のステップへ渡す。通れない場所は無視
  useEffect(() => {
    if (tapped === null) return
    const route = findPath(worldRef.current, stateRef.current.cell, tapped)
    if (route !== null && route.length > 0) {
      pendingRouteRef.current = route
      pendingFastRef.current = false
      // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
      autoTalkRef.current = false
      wakeRef.current()
    }
    consumeTap()
  }, [
    tapped,
    consumeTap,
    worldRef,
    stateRef,
    pendingRouteRef,
    pendingFastRef,
    autoTalkRef,
    wakeRef,
  ])
}
