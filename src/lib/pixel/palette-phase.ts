// 昼夜のフェーズに応じてパレットを派生させる純粋関数。DOM・Reactには一切依存しない
// dayはbaseをそのまま返し、それ以外は光源文字(4~9)を固定の発光色に差し替え、
// 残りの文字はtint色へratioの比率だけ線形に混ぜる
import type { Palette } from './art'
// DayPhaseの正本はsrc/utils/day-phase.tsに置く。utils→libの一方向レイヤー境界(eslint)により
// utils側からこのファイルは参照できないため、ここでは型を取り込むだけにする。
// 再輸出はしない — 同じ型の入口が2つあると、呼び出し側ごとにどちらを使うかがばらつくため
import type { DayPhase } from '@/utils/day-phase'

// 灯り用に予約した文字。地形・主人公の絵はこの文字を使わない(予約はsprites.test.tsが固定する)
export const LIGHT_KEYS = ['4', '5', '6', '7', '8', '9', '+', '*', '#'] as const

export type LightKey = (typeof LIGHT_KEYS)[number]

// LIGHT_KEYSと同じ文字をちょうど要求する表。1文字でも欠けたり余ったりすれば型検査で落ちる。
// Record<string, string>のままだと'9'を'a'と打ち間違えても気付けず、夜に壁の輪郭が塗り替わる
type LightPalette = Record<LightKey, string>

const LIGHT_KEY_SET = new Set<string>(LIGHT_KEYS)

const isLightKey = (key: string): key is LightKey => LIGHT_KEY_SET.has(key)

// どのフェーズでも色を変えない文字。目的地マーカーの赤(m)は「ここへ行け」を示す唯一の目印で、
// 夜のtintに混ぜると暗い紫(#552533)へ沈んで読めなくなる。mを使う絵はmarkerだけなので副作用は無い。
// 灯り用の文字にはしない — そうすると昼に黄色く光ってしまい、昼シートのバイト同一性も壊れる
const FIXED_KEYS = new Set<string>(['m'])

// dayを除く3フェーズの、光源以外の文字を混ぜる先の色と比率
type Tint = { readonly tint: string; readonly ratio: number }

// フェーズごとの色調(目視調整しやすいよう数値だけをここに集約する)
// 夜は #182848 の 0.55 では「曇った夕方」にしか見えなかったので、より暗く青い色へ深く混ぜる
const NIGHT_TINT: Tint = { tint: '#101c38', ratio: 0.68 }
// 夕方は橙のまま比率だけ上げ、日没の赤みをはっきり出す
const DUSK_TINT: Tint = { tint: '#c05020', ratio: 0.4 }
// 明け方は紫(#5040a0)が強すぎて濁っていたので、青寄りの薄明色へ替えて比率を上げる
const DAWN_TINT: Tint = { tint: '#5868b8', ratio: 0.4 }

// フェーズごとの光源文字の固定色。夜は完全に発光した色をそのまま置く
const NIGHT_LIGHTS: LightPalette = {
  '4': '#fff0c0',
  '5': '#f8d878',
  '6': '#a8e8ff',
  '7': '#ffffff',
  '8': '#78e0ff',
  '9': '#fff0a0',
  '+': '#ff5040',
  '*': '#50e070',
  '#': '#c070ff',
}
// 夕方・明け方は昼の色を夜の発光色へ 0.8 だけ寄せた値。弱い混色だと灯った窓が
// 同じ明るさの壁に溶けて「点いている」と読めなかったため、夜側へ大きく倒している。
// 今は夕方と明け方で同じ数値だが、時間帯ごとに目で詰められるよう表は分けたままにする
const DUSK_LIGHTS: LightPalette = {
  '4': '#eceacb',
  '5': '#ded38e',
  '6': '#9ee0fa',
  '7': '#fcfaf6',
  '8': '#76d0f1',
  '9': '#feed93',
  '+': '#f66a52',
  '*': '#79d383',
  '#': '#c391f2',
}
const DAWN_LIGHTS: LightPalette = {
  '4': '#eceacb',
  '5': '#ded38e',
  '6': '#9ee0fa',
  '7': '#fcfaf6',
  '8': '#76d0f1',
  '9': '#feed93',
  '+': '#f66a52',
  '*': '#79d383',
  '#': '#c391f2',
}

const PHASE_TINT: Record<Exclude<DayPhase, 'day'>, Tint> = {
  dawn: DAWN_TINT,
  dusk: DUSK_TINT,
  night: NIGHT_TINT,
}
const PHASE_LIGHTS: Record<Exclude<DayPhase, 'day'>, LightPalette> = {
  dawn: DAWN_LIGHTS,
  dusk: DUSK_LIGHTS,
  night: NIGHT_LIGHTS,
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i

// #rrggbb を1chごとの0~255へ分解する
const parseChannels = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

const toHexByte = (value: number): string => value.toString(16).padStart(2, '0')

// baseからtintへratioの比率だけ線形に寄せる。0で元色、1でtintそのもの
const mixChannel = (base: number, tint: number, ratio: number): number =>
  Math.round(base + (tint - base) * ratio)

// #rrggbb同士を線形に混ぜて小文字の#rrggbbで返す。16進表記でない値はそのまま素通りする
export const mixHex = (base: string, tint: string, ratio: number): string => {
  if (!HEX_PATTERN.test(base) || !HEX_PATTERN.test(tint)) return base
  const [br, bg, bb] = parseChannels(base)
  const [tr, tg, tb] = parseChannels(tint)
  const r = mixChannel(br, tr, ratio)
  const g = mixChannel(bg, tg, ratio)
  const b = mixChannel(bb, tb, ratio)
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

// 昼夜フェーズに応じてパレットを派生させる。'.'(透明)はパレットの文字ではないためここでは扱わない
export const phasePalette = (base: Palette, phase: DayPhase): Palette => {
  if (phase === 'day') return { ...base }
  const tint = PHASE_TINT[phase]
  const lights = PHASE_LIGHTS[phase]
  const result: Palette = {}
  for (const [key, value] of Object.entries(base)) {
    if (FIXED_KEYS.has(key)) {
      result[key] = value
      continue
    }
    result[key] = isLightKey(key) ? lights[key] : mixHex(value, tint.tint, tint.ratio)
  }
  return result
}
