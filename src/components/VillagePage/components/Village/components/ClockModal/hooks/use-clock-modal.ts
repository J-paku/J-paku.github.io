// 卓上時計の窓の中身。段階(選択 → 時刻)・針の値・焦点とキー操作をここに集め、
// index.tsx は受け取った手を並べるだけにする。時刻の保存先は Village/hooks/use-village-time.ts の store
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { ClockText, Direction } from '@content/types/world'
import { wrapWithin } from '@/utils/wrap-within'
import { useHeldDirection } from '../../../hooks/use-held-direction'
import { useVillageTime } from '../../../hooks/use-village-time'
import { formatClock, HOUR_SPAN, MINUTE_SPAN, MINUTE_STEP } from '../utils/clock-time'

export type ClockStep = 'choose' | 'pick'

// この窓で焦点を移せるのはボタンだけ。Tab の輪はこの並びで回す
const FOCUSABLE_SELECTOR = 'button:not([disabled])'
// まだ一度も時刻を決めていない時の針の位置。夕方は昼夜の変化が一番分かりやすい
const DEFAULT_HOUR = 18
const DEFAULT_MINUTE = 0

// 矢印キーの向き。村の枠は WASD も方向に読むが、この窓で直接受けるのは矢印だけにする
// (WASD は枠を経由してスティックと同じ押しっぱなしの経路に乗る)
const ARROW_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

// 1 段目でスティックを倒し続けた間、焦点を次のボタンへ移し直す間隔(ms)。会話窓の戻る焦点送り
// (FOCUS_BACK_REPEAT_MS)と同じ長さで、ボタンが 1 つずつ移るのを目で追って手を離せるようにする
const CHOOSE_REPEAT_MS = 300
// 2 段目でスティックを倒し続けた時、繰り返しを始めるまでの待ち(ms)。押した瞬間の 1 つで止めたい
// 人が手を離すまで(反応はおよそ 0.2〜0.25 秒)より長くし、1 つだけ動かすつもりで 2 つ進まないようにする
const DIAL_REPEAT_DELAY_MS = 300
// 繰り返しが始まった後の 1 ステップの間隔(ms)。時は左右どちらかへ最大 12 ステップで届くので、
// 倒し続けて 2 秒足らず(300 + 11 × 120 ms)でどの時刻へも着き、かつ 1 ステップずつ目で数えられる速さにする
const DIAL_REPEAT_MS = 120

type UseClockModalParams = {
  text: ClockText
  dialogRef: RefObject<HTMLDivElement | null>
  returnTo: RefObject<HTMLElement | null>
  // スティック(と会話中の方向キー)の押しっぱなしの向き。村の入力が書き、ここは読むだけ
  scrollHeldRef: RefObject<Direction | null>
  announce: (message: string) => void
  onClose: () => void
}

type UseClockModal = {
  step: ClockStep
  hour: number
  minute: number
  // 2 段目へ入った時に焦点を置く「決定」。A(Z)が焦点のボタンを押すので、A がそのまま決定になる
  decideRef: RefObject<HTMLButtonElement | null>
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
  scrollHeldRef,
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
  const decideRef = useRef<HTMLButtonElement>(null)
  // スティックを倒し続けた時に次の 1 つを動かす rAF 時刻。押した瞬間に置き、空の間は繰り返さない
  const repeatAtRef = useRef<number | null>(null)

  // 開いた時(1 段目)は先頭のボタンへ。2 段目へ入った時は「決定」へ置き、A(Z)=決定・B(X)=閉じる・
  // 矢印とスティック=針、と手を持ち替えずに決め切れるようにする(Tab の輪は DOM の並びのまま)
  useEffect(() => {
    // 段階を跨いだ押しっぱなしで、新しい段階の針や焦点を押し直し無しに動かさない
    repeatAtRef.current = null
    if (step === 'pick') {
      decideRef.current?.focus()
      return
    }
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

  // 1 段目で焦点をボタンの並びの中で 1 つ動かす。端では反対の端へ回り込む(ボタンが 3 つしかなく、
  // 行き止まりにすると「やめる」から「現在時間」へ戻るのに 2 回押し直すことになるため)
  const moveFocus = (delta: number) => {
    const dialog = dialogRef.current
    if (dialog === null) return
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) return
    const index = focusable.findIndex(element => element === document.activeElement)
    // 焦点が並びの外にある時は、進むなら先頭・戻るなら末尾から入る
    const entry = delta > 0 ? 0 : focusable.length - 1
    const next = index < 0 ? entry : wrapWithin(index + delta, focusable.length)
    focusable[next].focus()
  }

  // 向き 1 つ分の操作。キーボードとスティックが同じ割り当てを読む。
  // 1 段目は上・左が前のボタン、下・右が次のボタン。2 段目は左右が時、上下が分(上が進む)
  const applyDirection = (direction: Direction) => {
    if (step === 'choose') {
      moveFocus(direction === 'up' || direction === 'left' ? -1 : 1)
      return
    }
    if (direction === 'left') stepHour(-1)
    else if (direction === 'right') stepHour(1)
    else if (direction === 'up') stepMinute(MINUTE_STEP)
    else stepMinute(-MINUTE_STEP)
  }

  // スティック(村の枠が受けた WASD も)の押しっぱなし。押した瞬間に 1 つ動かし、倒し続ければ繰り返す。
  // 1 段目は一定の間隔で、2 段目は少し待ってから速めの間隔で(1 つだけ動かしたい時と遠くへ回したい時を両立する)
  useHeldDirection({
    heldRef: scrollHeldRef,
    onHeld: (direction, pressed, now) => {
      const repeatAt = repeatAtRef.current
      if (!pressed && (repeatAt === null || now < repeatAt)) return
      const interval =
        step === 'choose' ? CHOOSE_REPEAT_MS : pressed ? DIAL_REPEAT_DELAY_MS : DIAL_REPEAT_MS
      repeatAtRef.current = now + interval
      applyDirection(direction)
    },
  })

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

    // 矢印キーは 1 段目でボタンの移動、2 段目で針に割り当てる。押す(自動反復を含む)たびに 1 つ動かすので、
    // 速い連打も 1 回ずつ数えられる
    const direction = ARROW_TO_DIRECTION[event.key]
    if (direction === undefined) return
    event.preventDefault()
    // 村の枠まで伝わると、枠は会話中の方向キーとしてスティックと同じ押しっぱなしの ref へ書き、
    // 上の useHeldDirection が同じ 1 回を押した瞬間としてもう 1 つ動かす(2 倍進む)。
    // キーはここで 1 回ずつ、スティックは rAF の押下・繰り返しで、と経路を分けるため矢印だけ止める。
    // Escape・M・Z・X は枠(閉じる・地図・A/B)でも受けるので、Tab も含めて今まで通り止めずに伝わらせる
    event.stopPropagation()
    applyDirection(direction)
  }

  return {
    step,
    hour,
    minute,
    decideRef,
    chooseRealtime,
    chooseCustom,
    stepHour,
    stepMinute,
    decide,
    cancelPick,
    handleKeyDown,
  }
}
