// 作品カードのリンク覆いの開閉状態。開いている間だけEscと枠外クリックで閉じる購読を張る
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export function useLinksOverlay(shotRef: RefObject<HTMLDivElement | null>) {
  // リンクの覆いの開閉。この state はタップ用 — ホバー表示は CSS 側の @media (hover: hover) が担う
  const [isLinksOpen, setIsLinksOpen] = useState(false)

  // Esc と「キャプチャ枠の外側クリック」で閉じる。開いている間だけ購読する。
  // 外側判定は shotRef(枠そのもの)基準 — 枠内のトリガー・リンクは各自の onClick が処理する
  useEffect(() => {
    if (!isLinksOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLinksOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const shot = shotRef.current
      if (shot !== null && event.target instanceof Node && !shot.contains(event.target)) {
        setIsLinksOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isLinksOpen, shotRef])

  return { isLinksOpen, setIsLinksOpen }
}
