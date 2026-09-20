// 大阪の現在の降水種別を Open-Meteo から取る(API キー不要)
// 失敗・タイムアウト・応答形の不一致は全て 'none' に丸める — 雨が出ないのはバグではなくフォールバック
export type Precipitation = 'rain' | 'snow' | 'none'

const OSAKA_LATITUDE = 34.69
const OSAKA_LONGITUDE = 135.5
const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${OSAKA_LATITUDE}&longitude=${OSAKA_LONGITUDE}&current=precipitation,snowfall`
// 5秒でタイムアウト。ネットワーク障害・応答形の不一致・タイムアウトは全部 'none' に丸めて静かに諦める
const TIMEOUT_MS = 5000

type OpenMeteoResponse = {
  current: {
    precipitation: number
    snowfall: number
  }
}

function isOpenMeteoResponse(value: unknown): value is OpenMeteoResponse {
  if (typeof value !== 'object' || value === null) return false

  const body = value as Record<string, unknown>
  if (typeof body.current !== 'object' || body.current === null) return false

  const current = body.current as Record<string, unknown>
  return typeof current.precipitation === 'number' && typeof current.snowfall === 'number'
}

function combineSignals(timeout: AbortSignal, caller?: AbortSignal): AbortSignal {
  if (caller === undefined) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([timeout, caller])
  // AbortSignal.any が無い実行環境ではタイムアウトだけを使う(呼び出し側の中断は反映されない)
  return timeout
}

export const fetchOsakaPrecipitation = async (signal?: AbortSignal): Promise<Precipitation> => {
  try {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
    const response = await fetch(OPEN_METEO_URL, { signal: combineSignals(timeoutSignal, signal) })
    if (!response.ok) return 'none'

    const body: unknown = await response.json()
    if (!isOpenMeteoResponse(body)) return 'none'

    if (body.current.snowfall > 0) return 'snow'
    if (body.current.precipitation > 0) return 'rain'
    return 'none'
  } catch {
    return 'none'
  }
}
