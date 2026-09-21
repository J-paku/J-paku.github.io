// next/link によるページ移動を GoatCounter に数えさせる。計測タグ(count.js)は読み込み時の1件しか送らず、
// 以降の移動は URL が変わってもタグからは見えないため、pathname が変わるたびに送信関数を呼ぶ。
// 最初の1件はタグが自分で送っているので、ここではマウント時の pathname を送らない(二重計測を避ける)。
// ja ↔ ko の移動はルートレイアウトが別なので全ページ読み込みになり、そちらもタグが数える。何も描かない
'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { countPageview } from '@/lib/analytics'

function PageviewCounter() {
  const pathname = usePathname()
  // 直前に数えた(または読み込み時にタグが数えた)パス。Strict Mode のエフェクト二重実行でも同じ値なら送らない
  const countedRef = useRef(pathname)

  useEffect(() => {
    if (countedRef.current === pathname) return
    countedRef.current = pathname
    countPageview(pathname)
  }, [pathname])

  return null
}

export default PageviewCounter
