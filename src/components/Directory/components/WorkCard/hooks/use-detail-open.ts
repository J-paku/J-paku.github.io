// 作品カードの折りたたみ詳細の開閉状態。#slug 付きで到着した時だけ mount 後に開く
import { useEffect, useState } from 'react'

export function useDetailOpen(slug: string) {
  // #slug 付きで到着した時だけ最初から開く。アンカーへのスクロールはブラウザ標準に任せ、
  // ここでは開閉の初期値だけを決める(追加のスクロール操作はしない)
  // 初期状態は SSR と一致させるため false。ハッシュは mount 後に読む(hydration 不一致を避ける)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ハッシュは mount 後に一度だけ読み、以後は利用者が開閉する状態のため(useSyncExternalStore ではクライアント遷移の初回描画とハッシュ変更時の開閉が変わる)
    if (window.location.hash === `#${slug}`) setIsDetailOpen(true)
  }, [slug])

  return { isDetailOpen, setIsDetailOpen }
}
