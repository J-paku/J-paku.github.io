// 静的書き出しのためサーバは常に'day'を返す。クライアントでは VillagePage が置いたインライン
// スクリプトが初回描画の前に data-phase を実際の段階へ書き換えているので、このフックはマウント後に
// React 側の状態をその値へ揃え、以後は1分ごとに再計算して段階の変わり目を追う
import { useEffect, useState } from 'react'
import { dayPhaseAt, type DayPhase } from '@/utils/day-phase'

const CHECK_INTERVAL_MS = 60_000

export function useDayPhase(): DayPhase {
  const [phase, setPhase] = useState<DayPhase>('day')

  useEffect(() => {
    setPhase(dayPhaseAt(new Date()))
    const id = setInterval(() => {
      setPhase(dayPhaseAt(new Date()))
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return phase
}
