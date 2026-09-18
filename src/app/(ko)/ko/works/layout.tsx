// 作品詳細の共通枠。読み幅はストーリー側が持ち、一覧とマップへの導線も本文側で描く
import type { ReactNode } from 'react'

type WorksLayoutProps = {
  children: ReactNode
}

export default function WorksLayout({ children }: WorksLayoutProps) {
  return <div data-works-layout>{children}</div>
}
