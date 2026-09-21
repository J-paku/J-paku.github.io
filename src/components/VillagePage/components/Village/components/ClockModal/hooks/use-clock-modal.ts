// 卓上時計の窓の中身。段階(選択 → 時刻)・針の値・焦点とキー操作をここに集め、
// index.tsx は受け取った手を並べるだけにする。時刻の保存先は Village/hooks/use-village-time.ts の store
import { useEffect, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { ClockText } from '@content/types/world'
import { wrapWithin } from '@/utils/wrap-within'
import { useVillageTime } from '../../../hooks/use-village-time'
import { formatClock, HOUR_SPAN, MINUTE_SPAN, MINUTE_STEP } from '../utils/clock-time'

export type ClockStep = 'choose' | 'pick'

// この窓で焦点を移せるのはボタンだけ。Tab の輪はこの並びで回す
const FOCUSABLE_SELECTOR = 'button:not([disabled])'
// まだ一度も時刻を決めていない時の針の位置。夕方は昼夜の変化が一番分かりやすい
const DEFAULT_HOUR = 18
const DEFAULT_MINUTE = 0

type UseClockModalParams = {
  text: ClockText
  dialogRef: RefObject<HTMLDivElement | null>
  returnTo: RefObject<HTMLElement | null>
  announce: (message: string) => void
  onClose: () => void
}

type UseClockModal = {
  step: ClockStep
  hour: number
  minute: number
  chooseRealtime: () => void
  chooseCustom: () => void
  stepHour: (delta: number) => void
  stepMinute: (delta: number) => void
  decide: () => void
  // 2 段目の「やめる」。取り消しの一言を出してから閉じる(1 段目の「やめる」は何も言わずに閉じる)
  cancelPick: () => void
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function useClockModal({
  text,
  dialogRef,
  returnTo,
  announce,
  onClose,
}: UseClockModalParams): UseClockModal {
  const setRealtime = useVillageTime(state => state.setRealtime)
  const setCustomTime = useVillageTime(state => state.setCustomTime)
  // 針の初期位置。前に決めた時刻が残っていればそこから始める(setRealtime は値を消さない)
  const savedHour = useVillageTime(state => state.customHour)
  const savedMinute = useVillageTime(state => state.customMinute)

  const [step, setStep] = useState<ClockStep>('choose')
  const [hour, setHour] = useState(() => savedHour ?? DEFAULT_HOUR)
  const [minute, setMinute] = useState(() => savedMinute ?? DEFAULT_MINUTE)

  // 開いた時は先頭のボタンへ。段階が変わった時も新しい段階の先頭へ移す
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
  }, [dialogRef, step])

  // 閉じた時は開く前にいた所(村の枠)へ戻す。返却先はマウント時に控える
  useEffect(() => {
    const returnTarget = returnTo.current

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo])

  const chooseRealtime = () => {
    setRealtime()
    announce(text.setRealtime)
    onClose()
  }

  const chooseCustom = () => setStep('pick')

  const stepHour = (delta: number) => setHour(current => wrapWithin(current + delta, HOUR_SPAN))

  const stepMinute = (delta: number) =>
    setMinute(current => wrapWithin(current + delta, MINUTE_SPAN))

  const decide = () => {
    setCustomTime(hour, minute)
    announce(text.setCustom.replace('{time}', formatClock(hour, minute)))
    onClose()
  }

  const cancelPick = () => {
    announce(text.cancelled)
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }

    // 時刻を選ぶ段階だけ、矢印キーを針に割り当てる。左右が時、上下が分(上が進む)
    if (step !== 'pick') return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      stepHour(-1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      stepHour(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      stepMinute(MINUTE_STEP)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      stepMinute(-MINUTE_STEP)
    }
  }

  return {
    step,
    hour,
    minute,
    chooseRealtime,
    chooseCustom,
    stepHour,
    stepMinute,
    decide,
    cancelPick,
    handleKeyDown,
  }
}
