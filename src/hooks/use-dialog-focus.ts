// 重ね表示の窓に共通の焦点まわり。開いた時に返却先を控えて閉じた時にそこへ戻し、Tab はこの窓の中で回す
import { useEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import { focusablesIn } from '@/utils/focusables'
import { wrapFocusIndex } from '@/utils/wrap-focus-index'

type UseDialogFocusParams = {
  // 開いているか。窓は開いている間だけ描かれる(描かれている間が開いている間)ので常に true で、型でそう固める。
  // 閉じている間の場合を持たないので、このフックはこの値を読まない
  open: true
  // Tab の輪を回す根。この中の selector に合う要素を DOM 順に並べる
  rootRef: RefObject<HTMLElement | null>
  selector: string
  // 閉じた時に戻す先。マウント時(開いた時)の値を控える
  returnTo: RefObject<HTMLElement | null>
  // 開いた時に最初に焦点を置く所。段階で置き場所が変わる窓は渡さず、呼び出し元が自分で置く
  initialFocusRef?: RefObject<HTMLElement | null>
  // 並びの外で輪の先頭と同じに扱う所(tabIndex -1 の見出しなど)。ここで Shift+Tab を押すと末尾へ回す
  leadRef?: RefObject<HTMLElement | null>
}

// 戻り値は onKeyDown の中から呼ぶ Tab の手。Tab だった時は true を返す(呼び出し元はそこで打ち切る)
export function useDialogFocus({
  rootRef,
  selector,
  returnTo,
  initialFocusRef,
  leadRef,
}: UseDialogFocusParams): (event: KeyboardEvent<HTMLElement>) => boolean {
  // 返却先はマウント時に控え、アンマウントの片付けでそこへ戻す
  useEffect(() => {
    const returnTarget = returnTo.current
    initialFocusRef?.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo, initialFocusRef])

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return false

    // 呼ぶのは窓(か、窓を包む覆い)の keydown だけ。キーを受けている間は窓が描かれていて、根の ref は付いている
    const focusable = focusablesIn(rootRef.current!, selector)

    // 端で回すかどうかは utils/wrap-focus-index.ts が決め、ここは結果どおりに焦点を移すだけ
    const target = wrapFocusIndex<Element>({
      items: focusable,
      active: document.activeElement,
      lead: leadRef?.current,
      shift: event.shiftKey,
    })
    if (target !== null) {
      event.preventDefault()
      focusable[target].focus()
    }
    return true
  }

  return trapTab
}
