// 作品カードのリンク覆いの開閉状態。開いている間だけEscと枠外クリックで閉じる購読を張る
import { useState } from 'react'
import type { RefObject } from 'react'
import { useLightDismiss } from '@/hooks/use-light-dismiss'

export function useLinksOverlay(shotRef: RefObject<HTMLDivElement | null>) {
  // リンクの覆いの開閉。この state はタップ用 — ホバー表示は CSS 側の @media (hover: hover) が担う
  const [isLinksOpen, setIsLinksOpen] = useState(false)

  // Esc と「キャプチャ枠の外側クリック」で閉じる。開いている間だけ購読する。
  // 外側判定は shotRef(枠そのもの)基準 — 枠内のトリガー・リンクは各自の onClick が処理する
  useLightDismiss({
    open: isLinksOpen,
    rootRef: shotRef,
    onEscape: () => setIsLinksOpen(false),
    onOutside: () => setIsLinksOpen(false),
    target: 'window',
  })

  return { isLinksOpen, setIsLinksOpen }
}
