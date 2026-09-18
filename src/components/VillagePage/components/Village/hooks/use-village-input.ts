// キー・タップ・十字キー・押しっぱなしポインタの入力だけを集める。移動判定と村の処理は外に置き、
// ここは「今どの向きが押されているか」「どのマスがタップ/押しっぱなしされているか」と行動キーの通知を持つ
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { Cell, Direction } from '@content/types/world'

// event.code で引くので IME やキー配列の影響を受けない
const CODE_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

const TALK_CODES: readonly string[] = ['KeyE', 'Enter', 'NumpadEnter']

// クライアント座標をワールドのマス座標へ直す。カメラの分だけ origin でずらす。
// 小数のカメラ原点は先に floor すると1マスずれるので、足してから floor する
const cellAt = (
  event: PointerEvent<HTMLDivElement>,
  cellSize: number,
  origin: { x: number; y: number }
): Cell => {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.floor((event.clientX - rect.left) / cellSize + origin.x),
    y: Math.floor((event.clientY - rect.top) / cellSize + origin.y),
  }
}

// 村側の処理は ref 越しに呼ぶ。フック自身は村の状態を知らない
export type VillageActions = {
  onTalk: () => void
  onMap: () => void
  onEscape: () => void
}

export type VillageInputOptions = {
  actions: RefObject<VillageActions>
  // モーダル・地図が開いている間は true。移動入力とタップを捨てる
  locked: RefObject<boolean>
}

type UseVillageInput = {
  heldRef: RefObject<Direction | null>
  setHeld: (direction: Direction | null) => void
  tapped: Cell | null
  consumeTap: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void
  onBlur: () => void
  // origin は表示枠の左上が指すワールド座標(マス単位)。カメラの分だけタップ位置をずらす
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    cellSize: number,
    origin: { x: number; y: number }
  ) => void
  // 押されている間、ポインタの下にあるマス。離すと null。use-walk-loop が毎フレーム読む
  pointerTargetRef: RefObject<Cell | null>
  onPointerMove: (
    event: PointerEvent<HTMLDivElement>,
    cellSize: number,
    origin: { x: number; y: number }
  ) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
}

export function useVillageInput({ actions, locked }: VillageInputOptions): UseVillageInput {
  const heldRef = useRef<Direction | null>(null)
  const [tapped, setTapped] = useState<Cell | null>(null)
  // 押されている間のポインタ下のマス。use-walk-loop が毎フレーム読んで経路を作り直す
  const pointerTargetRef = useRef<Cell | null>(null)
  // 今つかんでいるポインタの id。複数指・マウス混在でも move/up を取り違えないための照合用
  const activePointerIdRef = useRef<number | null>(null)

  // 十字キーはキー押下と同じ経路に流す
  const setHeld = useCallback(
    (direction: Direction | null) => {
      if (locked.current && direction !== null) return
      heldRef.current = direction
    },
    [locked]
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        actions.current.onEscape()
        return
      }
      if (locked.current) {
        heldRef.current = null
        return
      }
      const direction = CODE_TO_DIRECTION[event.code]
      if (direction !== undefined) {
        event.preventDefault()
        heldRef.current = direction
        return
      }
      if (TALK_CODES.includes(event.code)) {
        event.preventDefault()
        actions.current.onTalk()
        return
      }
      if (event.code === 'KeyM') {
        event.preventDefault()
        actions.current.onMap()
      }
    },
    [actions, locked]
  )

  const onKeyUp = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const direction = CODE_TO_DIRECTION[event.code]
    if (direction === undefined || heldRef.current !== direction) return
    heldRef.current = null
  }, [])

  // フォーカスを失ったら押しっぱなし状態を捨てる(キーを押したまま別要素へ移った場合)
  const onBlur = useCallback(() => {
    heldRef.current = null
    pointerTargetRef.current = null
    activePointerIdRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, cellSize: number, origin: { x: number; y: number }) => {
      if (locked.current || cellSize <= 0) return
      // マップに重ねたボタン(ミニマップ・会話窓)の操作はタップ移動にしない
      const target = event.target
      if (target instanceof Element && target.closest('button, a') !== null) return
      const { x, y } = cellAt(event, cellSize, origin)
      setTapped({ x, y })
      pointerTargetRef.current = { x, y }
      activePointerIdRef.current = event.pointerId
      // 枠の外へ出ても move/up を受け取り続けるために捕捉する
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [locked]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, cellSize: number, origin: { x: number; y: number }) => {
      if (event.pointerId !== activePointerIdRef.current) return
      if (locked.current || cellSize <= 0) return
      const { x, y } = cellAt(event, cellSize, origin)
      const current = pointerTargetRef.current
      if (current !== null && current.x === x && current.y === y) return
      pointerTargetRef.current = { x, y }
    },
    [locked]
  )

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerIdRef.current) return
    pointerTargetRef.current = null
    activePointerIdRef.current = null
  }, [])

  const consumeTap = useCallback(() => setTapped(null), [])

  useEffect(() => {
    // ページが隠れたら押下状態を解除(タブ切替中にキーアップ/ポインタアップを取りこぼす対策)
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      heldRef.current = null
      pointerTargetRef.current = null
      activePointerIdRef.current = null
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [])

  return {
    heldRef,
    setHeld,
    tapped,
    consumeTap,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    pointerTargetRef,
    onPointerMove,
    onPointerUp,
  }
}
