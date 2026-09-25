// 主人公に重なった街灯を、主人公の上へ重ねる層(LampVeil)の席へ DOM 直接で写す。
// どの街灯に重なるかは lib の lampVeilAt が決め、ここは立つマスと重なりが変わった時だけ調べ・書く。
// 毎フレーム調べ直すと、止まっている間も判定と DOM 書き込みが空回りする
import type { RefObject } from 'react'
import type { Cell, World } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { lampVeilAt, type LampVeil } from '@/lib/village/lamp-veil'
import { spriteIndex, spriteStyle } from '../../sprite-style'
import type { WalkFrameState } from './types'

// 主人公に重なった街灯を、主人公の上へ重ねる層(LampVeil)の席へ写す。
// 席は 1 組ぶんしか無いので、返ってきたマスを頭から順に入れ、余った席は消す。
// null(どの街灯にも重なっていない)なら全部の席を消す — 消さないと幽霊の街灯が残る。
// 呼ぶのは重なりが変わったフレームだけ。markLoop と同じで、同じ値を書き直さない
const applyLampVeil = (root: HTMLElement | null, veil: LampVeil | null, sprites: SheetLayout) => {
  if (root === null) return
  Array.from(root.children).forEach((slot, i) => {
    if (!(slot instanceof HTMLElement)) return
    if (veil === null || i >= veil.cells.length) {
      delete slot.dataset.villageVeilOn
      return
    }
    const { cell, key } = veil.cells[i]
    // 置き場と添字の求め方は地形の層(Ground)と同じ 1 か所から取る。
    // spriteStyle は React 用に CSSProperties を返すので、DOM へ書くときだけ文字列にする
    const style = spriteStyle(cell.x, cell.y, spriteIndex(sprites, key))
    slot.style.left = String(style.left)
    slot.style.top = String(style.top)
    slot.style.setProperty('--i', String(style['--i']))
    slot.dataset.villageVeilOn = ''
  })
}

// 主人公に重なった街灯を主人公の上へ重ねる。どの街灯に重なるかは規則の層が決め、
// ここは変わった時だけ DOM へ写す。立つマスが同じ間は判定も呼ばない。
// 置き場は calc(var(--cell) * マス) で書くので、枠の大きさが変わっても書き直さなくてよい
export const paintLampVeil = (
  frameState: WalkFrameState,
  lampVeilRef: RefObject<HTMLDivElement | null>,
  world: World,
  cell: Cell,
  sprites: SheetLayout
): void => {
  const veilCell = `${world.id}:${cell.x},${cell.y}`
  if (frameState.veilCell !== veilCell) {
    frameState.veilCell = veilCell
    const veil = lampVeilAt(world, cell)
    const veilId = veil === null ? '' : `${world.id}:${veil.id}`
    if (frameState.veilId !== veilId) {
      frameState.veilId = veilId
      applyLampVeil(lampVeilRef.current, veil, sprites)
    }
  }
}
