// 拡大地図の印の重なりを、描いた直後と画面の大きさが変わるたびに測り直してずらす
import { useLayoutEffect, useRef } from 'react'

import type { World } from '@content/types/world'
import type { MapEntry } from '@/lib/village/map-entries'

import { arrangeBadges } from '../utils/arrange-badges'

type UseBadgeLayoutParams = {
  entries: MapEntry[]
  world: World
}

// 印を並べる mapCanvas に付ける ref を返す
export function useBadgeLayout({ entries, world }: UseBadgeLayoutParams) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // 札の置き場所が変わった時だけ測り直す(entries は描き直しのたびに別の配列になり得るので、中身の文字列で比べる)
  const badgeLayoutKey = entries
    .map(entry => `${entry.id}:${entry.cell.x},${entry.cell.y}`)
    .join('|')

  // 地図が描かれた直後(描画前)に 1 回、以後は画面の大きさ・向きが変わるたびに 1 フレームへまとめて 1 回測る
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    arrangeBadges(canvas)
    let frame: number | null = null
    const handleResize = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        arrangeBadges(canvas)
      })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [badgeLayoutKey, world])

  return canvasRef
}
