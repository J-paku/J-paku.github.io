// 雲に座る直線飛行の時間・進み方・高さ・影・雲のコマを決める。時間と距離は呼び出し側が渡す

// 屋根を越える高さ。1マスの移動は歩き、2マス以上の移動で飛ぶ
export const FLIGHT_LIFT_CELLS = 2.5
export const FLIGHT_MIN_DISTANCE = 2

// 短距離にも離着陸の間を残し、町の対角線でも1.44秒以内に収める
const FLIGHT_BASE_MS = 480
const FLIGHT_CELL_MS = 32
const FLIGHT_MAX_MS = 1440
// [0,120)ms は0、[120,240)ms は1。以後は240msごとに繰り返す
const FLIGHT_FRAME_MS = 120

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value))

// 飛ぶかどうかは呼び出し側が判定する。負の距離は0として時間だけを返す
export const flightDurationMs = (distance: number): number =>
  Math.round(Math.min(FLIGHT_MAX_MS, FLIGHT_BASE_MS + Math.max(0, distance) * FLIGHT_CELL_MS))

// 三次の減速。出発が最も速く、着地時の水平速度は0になる
export const flightEase = (t: number): number => 1 - (1 - clampRatio(t)) ** 3

// 時間の1/3で頂点に達し、残り2/3でゆっくり降りる。着地時の鉛直速度も0になる
export const flightLift = (t: number): number => {
  const progress = clampRatio(t)
  // 頂点付近の浮動小数点誤差で1を超えないようにする
  return Math.min(1, (27 / 4) * progress * (1 - progress) ** 2)
}

// 地上の影は等倍、頂点では55%。小さくなっても現在の地上位置を見失わない
export const flightShadowScale = (lift: number): number => 1 - 0.45 * clampRatio(lift)

// 開始前の時刻は最初のコマに留める
export const flightFrame = (elapsedMs: number): 0 | 1 =>
  Math.max(0, Math.floor(elapsedMs / FLIGHT_FRAME_MS)) % 2 === 0 ? 0 : 1
