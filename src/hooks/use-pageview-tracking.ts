// ルート遷移のたびに GoatCounter へ1件送る。SPA はルートが変わってもページロードが
// 起きないため、これが無いとトップの初回表示しか計上されない。
//
// 初回表示は index.html の count.js が読み込み時に自動で1件送るので、このフックは
// 最初の発火だけ飛ばす(飛ばさないと初回が二重計上になる)
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { countPageview } from '@/lib/analytics'

export function usePageviewTracking(): void {
  const { pathname, search } = useLocation()
  // StrictMode の二重実行でも同じ ref を見るため、dev では2件目が出る。
  // ただし count.js が localhost を除外するので実際には送信されない
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    countPageview(pathname + search)
  }, [pathname, search])
}
