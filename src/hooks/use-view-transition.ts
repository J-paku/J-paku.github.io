// ルート遷移などをView Transitions APIで包む薄いラッパー。
// 対応判定はdocument.startViewTransitionの存在有無のみで行う。ポリフィルは入れない
// (未対応ブラウザではAPIを使わず即座に遷移するため機能損失がない)
import { useCallback } from 'react'

export const useViewTransition = (): ((callback: () => void) => void) => {
  // 呼び出し側が毎レンダーで新しい関数を受け取らないよう、参照を安定させる
  return useCallback((callback: () => void) => {
    if (typeof document.startViewTransition !== 'function') {
      callback()
      return
    }

    // reduced-motionではAPI自体を呼ばずcallbackだけ実行する。
    // アニメーション時間を0msにする手もあるが、そもそも呼び出し経路を分けた方が
    // Promiseの後始末などの失敗しうる箇所が少なく単純
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      callback()
      return
    }

    try {
      document.startViewTransition(callback)
    } catch {
      // startViewTransitionが同期的にthrowした場合、ブラウザ側はcallbackを呼ばないため
      // ここで代わりに実行し、画面遷移だけは必ず起きるようにする
      callback()
    }
  }, [])
}
