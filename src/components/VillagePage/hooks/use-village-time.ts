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
import {
  customClockTime,
  initialClockTime,
  realtimeClockTime,
  type ClockTime,
} from '../components/Village/utils/set-clock-time'

export type VillageTimeState = ClockTime & {
  setRealtime: () => void
  setCustomTime: (hour: number, minute: number) => void
  resetTimeState: () => void
}

// 状態の移り方(初期値・実時刻へ戻す・時刻を決める)は utils/set-clock-time.ts が決め、ここは set へ渡すだけ
export const useVillageTime = create<VillageTimeState>()(set => ({
  ...initialClockTime(),
  setRealtime: () => set(realtimeClockTime()),
  setCustomTime: (hour, minute) => set(customClockTime(hour, minute)),
  resetTimeState: () => set(initialClockTime()),
}))
