// 机上時計(利用者が村の時刻を一時的に動かす仕掛け)の状態。
// VillagePage 専用なので画面のフォルダへ置く(docs/architecture/frontend.md の規約)。
// zustand を使うのは、時計の UI と空・灯り・ポストの LED が親子関係の無い離れた島にあり、
// Context で配ると Provider を上へ置くことになって 'use client' の島が広がるため
// (村の index.tsx はサーバのまま保つ、という VillagePage の決まりを崩さない)。
// persist ミドルウェア・localStorage・sessionStorage は使わない。仕様が「再読み込みしたら
// 実時刻へ戻る」であり、保存すると戻らなくなるから。実内と実外の行き来は同じ JS 文脈のままなので、
// メモリだけで持っていてもその間は保持される。保存は src/lib/preferences.ts 一箇所だけ、
// という不変ルールにも合う
import { create } from 'zustand'
import { dayPhaseAt, dayPhaseAtHour, type DayPhase } from '@/utils/day-phase'
import { wrapWithin } from '@/utils/wrap-within'

export type TimeMode = 'realtime' | 'custom'

export type VillageTimeState = {
  timeMode: TimeMode
  customHour: number | null
  customMinute: number | null
  setRealtime: () => void
  setCustomTime: (hour: number, minute: number) => void
  resetTimeState: () => void
}

// 初期値は実時刻。サーバ描画と初回ペイント前のインラインスクリプトが実時刻前提で動くので、
// 起動直後にここが custom だと最初の空だけ食い違う
const INITIAL_TIME_STATE = {
  timeMode: 'realtime',
  customHour: null,
  customMinute: null,
} satisfies Pick<VillageTimeState, 'timeMode' | 'customHour' | 'customMinute'>

export const useVillageTime = create<VillageTimeState>()(set => ({
  ...INITIAL_TIME_STATE,
  // 実時刻へ戻すときも customHour・customMinute は残す。時計の針の位置を覚えておかないと、
  // 再び机上時計へ切り替えた瞬間に針が跳ぶ。値を消したいときは resetTimeState を使う
  setRealtime: () => set({ timeMode: 'realtime' }),
  setCustomTime: (hour, minute) =>
    set({
      timeMode: 'custom',
      customHour: wrapWithin(hour, 24),
      customMinute: wrapWithin(minute, 60),
    }),
  resetTimeState: () => set({ ...INITIAL_TIME_STATE }),
}))

// 段階の導出。机上時計で時刻を決めている間だけ実時刻を見ない。
// custom でも customHour が null(時刻未設定)なら実時刻へ落とす
export const villagePhase = (
  state: Pick<VillageTimeState, 'timeMode' | 'customHour'>,
  now: Date
): DayPhase =>
  state.timeMode === 'custom' && state.customHour !== null
    ? dayPhaseAtHour(state.customHour)
    : dayPhaseAt(now)
