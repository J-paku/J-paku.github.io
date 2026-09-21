// 卓上時計の窓が扱う時刻の計算。表示・読み上げ・キー操作が同じ形を使うのでここ 1 か所に置く

export const HOUR_SPAN = 24
export const MINUTE_SPAN = 60
// 分は 10 分刻み。0・10・…・50 の 6 段だけを巡回する
export const MINUTE_STEP = 10

// 2 桁 0 詰め。窓の数字と読み上げの「18:00」が食い違わないよう、両方ともここから作る
export const pad2 = (value: number): string => String(value).padStart(2, '0')

export const formatClock = (hour: number, minute: number): string => `${pad2(hour)}:${pad2(minute)}`
