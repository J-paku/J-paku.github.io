// 静的書き出しのためサーバは常に'day'を返す。クライアントでは VillagePage が置いたインライン
// スクリプトが初回描画の前に data-phase を実際の段階へ書き換えているので、このフックはマウント後に
// React 側の状態をその値へ揃え、以後は1分ごとに再計算して段階の変わり目を追う
// 机上時計で時刻を止めている間(timeMode === 'custom')は実時刻を見ず、指定された時から段階を決め、
// 1分ごとの再計算も張らない。止めたはずの空が実時刻の経過で動いてしまうため
import { useEffect, useState } from 'react'
import { useVillageTime, villagePhase } from './use-village-time'
import type { DayPhase } from '@/utils/day-phase'

const CHECK_INTERVAL_MS = 60_000

export function useDayPhase(): DayPhase {
  // 針を動かしている最中の分は段階を変えないので customMinute は読まない(読むと毎分再レンダーになる)
  const timeMode = useVillageTime(state => state.timeMode)
  const customHour = useVillageTime(state => state.customHour)
  const [phase, setPhase] = useState<DayPhase>('day')

  useEffect(() => {
    const apply = () => setPhase(villagePhase({ timeMode, customHour }, new Date()))
    apply()
    if (timeMode === 'custom') return
    const id = setInterval(apply, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [timeMode, customHour])

  return phase
}
