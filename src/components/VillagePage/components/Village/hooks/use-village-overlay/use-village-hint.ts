// 話せる相手がいない所で出す一言だけを持つ。一定時間で消し、ワープやアンマウントでも持ち越さない
import { useCallback, useEffect, useRef, useState } from 'react'
import type { World } from '@content/types/world'

// 一言を消すまでの間
const HINT_DURATION = 2500

type VillageHintOptions = {
  world: World
}

type UseVillageHint = {
  // 話せる相手がいない所で話しかけた時の一言。無ければ null
  hintText: string | null
  showHint: (message: string) => void
  clearHint: () => void
}

export function useVillageHint({ world }: VillageHintOptions): UseVillageHint {
  const [hintText, setHintText] = useState<string | null>(null)
  // 一言を消すタイマー。新しい一言が入ったら前の分を捨てる
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // タイマーと一言をまとめて消す
  const clearHint = useCallback(() => {
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    setHintText(null)
  }, [])

  // 一言を出し、前の分が残っていれば先に捨てる
  const showHint = useCallback(
    (message: string) => {
      clearHint()
      setHintText(message)
      hintTimerRef.current = setTimeout(() => clearHint(), HINT_DURATION)
    },
    [clearHint]
  )

  // アンマウント時に一言とタイマーを残さない
  useEffect(() => clearHint, [clearHint])

  // ワープ(ワールド変更)では一言を持ち越さない
  useEffect(() => {
    clearHint()
  }, [world, clearHint])

  return { hintText, showHint, clearHint }
}
