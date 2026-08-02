// パレットが開いている間だけ背景スクロールを止める。
// <dialog>のmodal表示はブラウザによって背景スクロールを止めない環境があるため自前で行う。
// 閉じたら元のoverflow値へ必ず戻す(決め打ちで''に戻さない)
import { useEffect } from 'react'

export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return

    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = original
    }
  }, [isLocked])
}
