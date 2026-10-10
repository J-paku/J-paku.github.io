// 雲に座る直線飛行の時間・進み方・高さ・影・雲のコマを決める。時間と距離は呼び出し側が渡す

// 屋根を越える高さ。1マスの移動は歩き、2マス以上の移動で飛ぶ
export const FLIGHT_LIFT_CELLS = 2
export const FLIGHT_MIN_DISTANCE = 2

// 短距離にも離着陸の間を残し、町を眺める長距離でも3秒以内に収める
const FLIGHT_BASE_MS = 1000
const FLIGHT_CELL_MS = 90
const FLIGHT_MAX_MS = 3000
// [0,320)ms は0、[320,640)ms は1。雲の縁だけが640ms周期でゆっくり膨らむ
const FLIGHT_FRAME_MS = 320

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value))

// 飛ぶかどうかは呼び出し側が判定する。負の距離は0として時間だけを返す
export const flightDurationMs = (distance: number): number =>
  Math.round(Math.min(FLIGHT_MAX_MS, FLIGHT_BASE_MS + Math.max(0, distance) * FLIGHT_CELL_MS))

// 五次の加減速。中間で最も速く、離着陸で水平速度と加速度がともに0になる
export const flightEase = (t: number): number => {
  const progress = clampRatio(t)
  return progress ** 3 * (10 + progress * (-15 + 6 * progress))
}

// 時間の半分で頂点。頂点付近はなだらかで、最後の1/4は降下を弱めながら座ったまま接地する。
// 離着陸で鉛直速度と加速度がともに0になる。0≦t≦1なら4t(1-t)は0〜1に収まる
export const flightLift = (t: number): number => {
  const progress = clampRatio(t)
  return (4 * progress * (1 - progress)) ** 3
}

// 地上の影は等倍、頂点では55%。小さくなっても現在の地上位置を見失わない
export const flightShadowScale = (lift: number): number => 1 - 0.45 * clampRatio(lift)

// 開始前の時刻は最初のコマに留める
export const flightFrame = (elapsedMs: number): 0 | 1 =>
  Math.max(0, Math.floor(elapsedMs / FLIGHT_FRAME_MS)) % 2 === 0 ? 0 : 1
