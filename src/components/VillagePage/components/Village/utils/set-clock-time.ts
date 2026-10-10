// 机上時計の状態の移り方。ストア(hooks/use-village-time.ts)は操作ごとに、ここが返す値を set へ渡すだけにする。
// zustand の set は浅く合成するので、返さなかった欄は前の値のまま残る
import { wrapWithin } from '@/utils/wrap-within'

export type TimeMode = 'realtime' | 'custom'

// 机上時計の状態のうち、操作の手を除いた値の部分
export type ClockTime = {
  timeMode: TimeMode
  customHour: number | null
  customMinute: number | null
}

// 初期値は実時刻。サーバ描画と初回ペイント前のインラインスクリプトが実時刻前提で動くので、
// 起動直後にここが custom だと最初の空だけ食い違う。値を消して戻すときもこれを set する
export const initialClockTime = (): ClockTime => ({
  timeMode: 'realtime',
  customHour: null,
  customMinute: null,
})

// 実時刻へ戻す。customHour・customMinute は返さずに残す。時計の針の位置を覚えておかないと、
// 再び机上時計へ切り替えた瞬間に針が跳ぶ
export const realtimeClockTime = (): Pick<ClockTime, 'timeMode'> => ({ timeMode: 'realtime' })

// 机上時計の時刻を決める。範囲の外の時・分は一周させて 0〜23 時・0〜59 分へ収める
export const customClockTime = (hour: number, minute: number): ClockTime => ({
  timeMode: 'custom',
  customHour: wrapWithin(hour, 24),
  customMinute: wrapWithin(minute, 60),
})
