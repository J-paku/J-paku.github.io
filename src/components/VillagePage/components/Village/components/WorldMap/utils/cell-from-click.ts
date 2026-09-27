// 拡大地図の枠を押した位置(画面座標)から、そこにあたるマスを求める
import type { Cell, World } from '@content/types/world'

type ClickPoint = {
  clientX: number
  clientY: number
}

type CanvasRect = {
  left: number
  top: number
  width: number
  height: number
}

// SVG は mapCanvas いっぱいに伸びているので、枠に対する割合がそのままマスの割合になる。
// 枠の大きさが 0(描かれていない)なら null
export const cellFromClick = (
  event: ClickPoint,
  rect: CanvasRect,
  world: Pick<World, 'width' | 'height'>
): Cell | null => {
  if (rect.width === 0 || rect.height === 0) return null
  // 右端・下端ちょうど(小数ピクセルの境目)を押すと割合が 1 になり枠外のマスを指すので、端のマスへ収める
  const x = Math.min(
    world.width - 1,
    Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * world.width))
  )
  const y = Math.min(
    world.height - 1,
    Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * world.height))
  )
  return { x, y }
}
