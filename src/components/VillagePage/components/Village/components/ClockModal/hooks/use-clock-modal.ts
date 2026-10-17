// 卓上時計の窓の中身。段階(選択 → 時刻)・針の値・焦点とキー操作をここに集め、
// container.tsx は受け取った手を並べるだけにする。時刻の読み書きは村の I/O コンテナから props で受け取る
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { ClockText, Direction } from '@content/types/world'
import { wrapWithin } from '@/utils/wrap-within'
import { useDialogFocus } from '@/hooks/use-dialog-focus'
import { useHeldDirection } from '@/hooks/use-held-direction'
import { CLOCK_FOCUSABLE_SELECTOR, focusablesIn } from '@/utils/focusables'
import { formatClock } from '../utils/clock-time'
import { moveForDirection, nextRepeatAt, shiftHour, shiftMinute } from '../utils/step-clock-time'
import type { ClockStep } from '../utils/step-clock-time'

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

export type ClockSettings = {
  savedHour: number | null
  savedMinute: number | null
  setRealtime: () => void
  setCustomTime: (hour: number, minute: number) => void
}

type UseClockModalParams = {
  text: ClockText
  clock: ClockSettings
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
  clock: { savedHour, savedMinute, setRealtime, setCustomTime },
  dialogRef,
  returnTo,
  scrollHeldRef,
  announce,
  onClose,
}: UseClockModalParams): UseClockModal {
  const [step, setStep] = useState<ClockStep>('choose')
  // 開いた時の props だけを針の初期位置に使う。開いている間の更新では選びかけの針を戻さない。
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
    dialogRef.current?.querySelector<HTMLElement>(CLOCK_FOCUSABLE_SELECTOR)?.focus()
  }, [dialogRef, step])

  // 閉じた時は開く前にいた所(村の枠)へ戻す。返却先はマウント時に控える。
  // 開いた時の焦点は段階で変わるので上の effect が置き、ここでは渡さない
  const trapTab = useDialogFocus({
    open: true,
    rootRef: dialogRef,
    selector: CLOCK_FOCUSABLE_SELECTOR,
    returnTo,
  })

  const chooseRealtime = () => {
    setRealtime()
    announce(text.setRealtime)
    onClose()
  }

  const chooseCustom = () => setStep('pick')

  const stepHour = (delta: number) => setHour(current => shiftHour(current, delta))

  const stepMinute = (delta: number) => setMinute(current => shiftMinute(current, delta))

  const decide = () => {
    setCustomTime(hour, minute)
    // {time}は全て置き換え、値は関数で渡して$記法として読まない(spot-textのfillPlaceと同じ)
    announce(text.setCustom.replaceAll('{time}', () => formatClock(hour, minute)))
    onClose()
  }

  const cancelPick = () => {
    announce(text.cancelled)
    onClose()
  }

  // 1 段目で焦点をボタンの並びの中で 1 つ動かす。端では反対の端へ回り込む(ボタンが 3 つしかなく、
  // 行き止まりにすると「やめる」から「現在時間」へ戻るのに 2 回押し直すことになるため)
  const moveFocus = (delta: number) => {
    // 窓が外れた後、押しっぱなしのループの片付けより先にフレームが来た時(遷移で村を外した直後)は窓が無い
    const dialog = dialogRef.current
    if (dialog === null) return
    // 1 段目のボタン(現在時間・カスタム・やめる)はいつも描かれ、無効にもならないので並びは空にならない
    const focusable = focusablesIn(dialog, CLOCK_FOCUSABLE_SELECTOR)
    const index = focusable.findIndex(element => element === document.activeElement)
    // 焦点が並びの外にある時は、進むなら先頭・戻るなら末尾から入る
    const entry = delta > 0 ? 0 : focusable.length - 1
    const next = index < 0 ? entry : wrapWithin(index + delta, focusable.length)
    focusable[next].focus()
  }

  // 向き 1 つ分の操作。キーボードとスティックが同じ割り当てを読む(割り当ては utils/step-clock-time.ts)
  const applyDirection = (direction: Direction) => {
    const move = moveForDirection(step, direction)
    if (move.target === 'focus') moveFocus(move.delta)
    else if (move.target === 'hour') stepHour(move.delta)
    else stepMinute(move.delta)
  }

  // スティック(村の枠が受けた WASD も)の押しっぱなし。押した瞬間に 1 つ動かし、倒し続ければ繰り返す。
  // 1 段目は一定の間隔で、2 段目は少し待ってから速めの間隔で(1 つだけ動かしたい時と遠くへ回したい時を両立する)
  useHeldDirection({
    heldRef: scrollHeldRef,
    onHeld: (direction, pressed, now) => {
      const repeatAt = nextRepeatAt(step, pressed, now, repeatAtRef.current)
      if (repeatAt === null) return
      repeatAtRef.current = repeatAt
      applyDirection(direction)
    },
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (trapTab(event)) return

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
