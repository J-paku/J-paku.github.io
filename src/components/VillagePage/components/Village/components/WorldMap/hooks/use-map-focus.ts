// 拡大地図の焦点管理(開いた時の最初の地点・閉じた時の戻り先・方向キーとスティックでの地点移動・M/Esc・Tab の循環)
import { useRef, type KeyboardEvent, type RefObject } from 'react'

import type { Direction } from '@content/types/world'
import type { MapEntry } from '@/lib/village/map-entries'

import { useDialogFocus } from '../../../hooks/use-dialog-focus'
import { useHeldDirection } from '../../../hooks/use-held-direction'
import { MAP_FOCUSABLE_SELECTOR } from '../../../utils/focusables'
import { spotToward } from '../utils/spot-navigation'

type UseMapFocusParams = {
  entries: MapEntry[]
  returnTo: RefObject<HTMLElement | null>
  scrollHeldRef: RefObject<Direction | null>
  onClose: () => void
}

// 地図の中で焦点を地点から地点へ移す方向キー
const ARROW_DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

// スティックを倒し続けた間、焦点を次の地点へ移し直す間隔(ms)。卓上時計の 1 段目(CHOOSE_REPEAT_MS)と
// 同じ長さにし、地点が 1 つずつ移るのを目で追って手を離せるようにする
const SPOT_REPEAT_MS = 300

export function useMapFocus({ entries, returnTo, scrollHeldRef, onClose }: UseMapFocusParams) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSpotRef = useRef<HTMLButtonElement>(null)
  // スティックを倒し続けた時に次の地点へ移す rAF 時刻。押した瞬間に置き、空の間は繰り返さない
  const repeatAtRef = useRef<number | null>(null)

  // 開いた時は最初の地点へ焦点を置き、閉じた時は開く前にいた所へ戻す。返却先はマウント時に控える
  const trapTab = useDialogFocus({
    open: true,
    rootRef: panelRef,
    selector: MAP_FOCUSABLE_SELECTOR,
    returnTo,
    initialFocusRef: firstSpotRef,
  })

  // 今の焦点の地点から、その向きで最も近い地点へ焦点を移す。キー以外の入力からも呼べるよう keydown とは分けてある
  const focusSpotToward = (direction: Direction) => {
    const active = document.activeElement
    const currentId = active instanceof HTMLElement ? (active.dataset.spotId ?? null) : null
    const next = spotToward(entries, currentId, direction)
    if (next === null) return
    panelRef.current?.querySelector<HTMLElement>(`[data-spot-id='${next.id}']`)?.focus()
  }

  // スティックの押しっぱなし。押した瞬間に 1 地点移し、倒し続ければ一定の間隔で繰り返す。
  // この地図は村の枠([data-village])の外の兄弟なので、方向キーは枠の onKeyDown(押しっぱなしの ref へ書く経路)へ
  // 届かず下の handleKeyDown だけが受ける。ref へ書くのはスティックだけになり、キーとスティックが二重に動かすことはない
  useHeldDirection({
    heldRef: scrollHeldRef,
    onHeld: (direction, pressed, now) => {
      const repeatAt = repeatAtRef.current
      if (!pressed && (repeatAt === null || now < repeatAt)) return
      repeatAtRef.current = now + SPOT_REPEAT_MS
      focusSpotToward(direction)
    },
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    // M は開閉の切り替え。地図の中でも閉じられる
    if (event.code === 'KeyM') {
      event.preventDefault()
      onClose()
      return
    }

    const direction = ARROW_DIRECTIONS[event.key]
    if (direction !== undefined) {
      event.preventDefault()
      focusSpotToward(direction)
      return
    }

    if (trapTab(event)) return
  }

  return { panelRef, firstSpotRef, handleKeyDown }
}
