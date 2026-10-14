// 机上時計の状態と今の時刻から、村の昼夜の段階を決める
import { dayPhaseAt, dayPhaseAtHour, type DayPhase } from '@/utils/day-phase'
import type { ClockTime } from './set-clock-time'

// 段階の導出。机上時計で時刻を決めている間だけ実時刻を見ない。
// custom でも customHour が null(時刻未設定)なら実時刻へ落とす
export const villagePhase = (
  state: Pick<ClockTime, 'timeMode' | 'customHour'>,
  now: Date
): DayPhase =>
  state.timeMode === 'custom' && state.customHour !== null
    ? dayPhaseAtHour(state.customHour)
    : dayPhaseAt(now)
