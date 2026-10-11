// 卓上時計の窓で、向き 1 つ分の入力を何に読み替えるか(焦点送り・時・分)と、押し続けた時に次の 1 つを
// いつ動かすかを決める。rAF の時刻・ref・state はフック(hooks/use-clock-modal.ts)が持ち、ここは値を受けて答えるだけにする
// (React なしで向き・段階・時刻の境目を網羅的に確かめるため)
import type { Direction } from '@content/types/world'
import { wrapWithin } from '@/utils/wrap-within'
import { HOUR_SPAN, MINUTE_SPAN, MINUTE_STEP } from './clock-time'

export type ClockStep = 'choose' | 'pick'

// 1 段目でスティックを倒し続けた間、焦点を次のボタンへ移し直す間隔(ms)。会話窓の戻る焦点送り
// (FOCUS_BACK_REPEAT_MS)と同じ長さで、ボタンが 1 つずつ移るのを目で追って手を離せるようにする
const CHOOSE_REPEAT_MS = 300
// 2 段目でスティックを倒し続けた時、繰り返しを始めるまでの待ち(ms)。押した瞬間の 1 つで止めたい
// 人が手を離すまで(反応はおよそ 0.2〜0.25 秒)より長くし、1 つだけ動かすつもりで 2 つ進まないようにする
const DIAL_REPEAT_DELAY_MS = 300
// 繰り返しが始まった後の 1 ステップの間隔(ms)。時は左右どちらかへ最大 12 ステップで届くので、
// 倒し続けて 2 秒足らず(300 + 11 × 120 ms)でどの時刻へも着き、かつ 1 ステップずつ目で数えられる速さにする
const DIAL_REPEAT_MS = 120

// 向き 1 つ分の操作。target が動かす先、delta が動かす量(焦点はボタンの数、時は時、分は分)
type ClockMove = {
  target: 'focus' | 'hour' | 'minute'
  delta: number
}

// キーボードとスティックが同じ割り当てを読む。
// 1 段目は上・左が前のボタン、下・右が次のボタン。2 段目は左右が時、上下が分(上が進む)
export const moveForDirection = (step: ClockStep, direction: Direction): ClockMove => {
  if (step === 'choose') {
    return { target: 'focus', delta: direction === 'up' || direction === 'left' ? -1 : 1 }
  }
  if (direction === 'left') return { target: 'hour', delta: -1 }
  if (direction === 'right') return { target: 'hour', delta: 1 }
  if (direction === 'up') return { target: 'minute', delta: MINUTE_STEP }
  return { target: 'minute', delta: -MINUTE_STEP }
}

// 針を delta だけ回す。端を越えたら反対の端へ回り込む(23 時の次は 0 時、0 分の前は 50 分)
export const shiftHour = (hour: number, delta: number): number =>
  wrapWithin(hour + delta, HOUR_SPAN)

export const shiftMinute = (minute: number, delta: number): number =>
  wrapWithin(minute + delta, MINUTE_SPAN)

// 押しっぱなしの 1 フレームで今 1 つ動かすか。動かすなら次に動かす rAF 時刻を、動かさないなら null を返す。
// 押した瞬間は必ず動かす。押し続けている間は repeatAt に届いた(同じ時刻を含む)フレームで動かし、
// repeatAt が空(段階を跨いだ直後)の間は押し直すまで動かさない。
// 1 段目は一定の間隔で、2 段目は少し待ってから速めの間隔で(1 つだけ動かしたい時と遠くへ回したい時を両立する)
export const nextRepeatAt = (
  step: ClockStep,
  pressed: boolean,
  now: number,
  repeatAt: number | null
): number | null => {
  if (!pressed && (repeatAt === null || now < repeatAt)) return null
  const interval =
    step === 'choose' ? CHOOSE_REPEAT_MS : pressed ? DIAL_REPEAT_DELAY_MS : DIAL_REPEAT_MS
  return now + interval
}
