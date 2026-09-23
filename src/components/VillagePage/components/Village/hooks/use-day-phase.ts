// 静的書き出しのためサーバは常に'day'を返す。クライアントでは VillagePage が置いたインライン
// スクリプトが初回描画の前に data-phase を実際の段階へ書き換えているので、このフックはマウント後に
// React 側の状態をその値へ揃え、以後は1分ごとに再計算して段階の変わり目を追う
// 机上時計で時刻を止めている間(timeMode === 'custom')は指定された時から段階を決める。
// 時計を止めていても、画像取得の一時的な失敗から戻れるよう1分ごとに準備を確かめる
import { useEffect, useRef, useState } from 'react'
import { useVillageTime, villagePhase } from './use-village-time'
import type { DayPhase } from '@/utils/day-phase'

const CHECK_INTERVAL_MS = 60_000

export type PhaseSheets = readonly { phase: DayPhase; urls: readonly string[] }[]

export function useDayPhase(sheets: PhaseSheets): DayPhase {
  // 針を動かしている最中の分は段階を変えないので customMinute は読まない(読むと毎分再レンダーになる)
  const timeMode = useVillageTime(state => state.timeMode)
  const customHour = useVillageTime(state => state.customHour)
  const [phase, setPhase] = useState<DayPhase>('day')
  const initialized = useRef(false)
  // Image 自体も保持し、未表示の時間帯を長いセッションの途中で初めて取得しない。
  // 配信更新で古い指紋の PNG が消えても、取得済みの絵をそのまま使える。
  const images = useRef(new Map<string, { image: HTMLImageElement; ready: Promise<boolean> }>())

  useEffect(() => {
    let active = true
    let requested: DayPhase
    const load = (url: string): Promise<boolean> => {
      const cached = images.current.get(url)
      if (cached !== undefined) return cached.ready
      const image = new Image()
      image.src = url
      const ready = image.decode().then(
        () => true,
        () => {
          // 一時的な通信失敗なら次の時計更新で再取得できるようにする。
          images.current.delete(url)
          return false
        }
      )
      images.current.set(url, { image, ready })
      return ready
    }
    const apply = () => {
      const next = villagePhase({ timeMode, customHour }, new Date())
      requested = next
      if (!initialized.current) {
        // 初回は描画前のインラインスクリプトと揃え、昼へ巻き戻さない。
        initialized.current = true
        setPhase(next)
      }
      const target = sheets.find(sheet => sheet.phase === next)
      if (target === undefined) return
      void Promise.all(target.urls.map(load)).then(ready => {
        // 地形と主人公が両方描けるまで直前の絵を残す。遅い古い要求で空を戻さない。
        if (active && requested === next && ready.every(Boolean)) setPhase(next)
      })
    }
    apply()
    for (const sheet of sheets) for (const url of sheet.urls) void load(url)
    const id = setInterval(apply, CHECK_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [timeMode, customHour, sheets])

  return phase
}
