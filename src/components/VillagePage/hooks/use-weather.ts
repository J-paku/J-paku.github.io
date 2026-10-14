// マウント時に一度だけ大阪の降水を取得する。アンマウント後は AbortController で中断し、setState しない
import { useEffect, useState } from 'react'
import type { Precipitation } from '@/lib/weather'
import { fetchOsakaPrecipitation } from '@/lib/weather'

export function useWeather(): Precipitation {
  const [precipitation, setPrecipitation] = useState<Precipitation>('none')

  useEffect(() => {
    const controller = new AbortController()
    fetchOsakaPrecipitation(controller.signal).then((result: Precipitation) => {
      if (!controller.signal.aborted) setPrecipitation(result)
    })
    return () => controller.abort()
  }, [])

  return precipitation
}
