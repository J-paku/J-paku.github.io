// phasePaletteのテスト。実パレットに依存させず、光源文字(4~9)・通常文字・
// 時間帯で変えない文字・16進以外の値を含む最小のフィクスチャで検証する
import { describe, expect, it } from 'vitest'
import type { Palette } from './art'
import { phasePalette } from './palette-phase'
import { DAY_PHASES } from '@/utils/day-phase'

// 混色対象の通常文字。tintより明るい色を選び、混ぜると暗くなる方向を検証できるようにする
const NORMAL_KEY = 'g'
const NORMAL_COLOR = '#78c060'
// 時間帯で色を変えない文字(目的地マーカーの赤)。実パレットと同じ文字・同じ色を使う
const FIXED_KEY = 'm'
const FIXED_COLOR = '#e83828'
// 16進表記でない値。素通りするか確認する
const NON_HEX_KEY = 'label'
const NON_HEX_VALUE = 'transparent'

const base: Palette = {
  [NORMAL_KEY]: NORMAL_COLOR,
  [FIXED_KEY]: FIXED_COLOR,
  [NON_HEX_KEY]: NON_HEX_VALUE,
  '4': '#a0d0f8',
  '5': '#78c0e8',
  '6': '#78c0e8',
  '7': '#f0e8d0',
  '8': '#6d90ba',
  '9': '#f8e060',
  // ポストの LED(消灯時のレンズ)。実パレットと同じ文字・同じ色を使う。
  // この3文字をフィクスチャへ入れておかないと、LIGHT_KEYS に並んでいるだけで
  // どの表の値も一度も読まれず、発光色を黒へ書き換えても全検査が素通りする
  '+': '#4a3a38',
  '*': '#384a3c',
  '#': '#43384a',
}

// sRGB値をそのまま重み付けした簡易輝度。暗さの相対比較にのみ使う(WCAG厳密値ではない)
const luma = (hex: string): number => {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('phasePalette', () => {
  // 段階の一覧(正本は src/utils/day-phase.ts)をここでも正面から押さえる。
  // it.each(DAY_PHASES) だけに頼ると、組を削っても検査が回る回数が減るだけで緑のまま通り、
  // 「赤が出ないのに検査が消える」いちばん危ない壊れ方になる
  it('段階は明け方・昼・夕方・夜の4つ', () => {
    expect(DAY_PHASES).toEqual(['dawn', 'day', 'dusk', 'night'])
  })

  it('dayはbaseとdeep-equal', () => {
    expect(phasePalette(base, 'day')).toEqual(base)
  })

  // toEqual は参照の同一性を見ないので、base をそのまま返しても deep-equal は通る。
  // 呼び出し側は返った表へ後から文字を足せる前提なので、同じ実体を返すと元の表まで書き換わる
  it('dayでもbaseそのものではなく複製を返す', () => {
    expect(phasePalette(base, 'day')).not.toBe(base)
  })

  it('nightの光源文字は指定の固定色になる', () => {
    const result = phasePalette(base, 'night')
    expect(result['4']).toBe('#fff0c0')
    expect(result['5']).toBe('#f8d878')
    expect(result['6']).toBe('#a8e8ff')
    expect(result['7']).toBe('#ffffff')
    expect(result['8']).toBe('#78e0ff')
    expect(result['9']).toBe('#fff0a0')
    // ポストの LED の3色(赤・緑・紫)
    expect(result['+']).toBe('#ff5040')
    expect(result['*']).toBe('#50e070')
    expect(result['#']).toBe('#c070ff')
  })

  // 夕方・明け方は昼の色を夜の発光色へ 0.8 寄せた値。灯った窓が壁と同じ明るさにならない強さ
  it('duskの光源文字は指定の固定色になる', () => {
    const result = phasePalette(base, 'dusk')
    expect(result['4']).toBe('#eceacb')
    expect(result['5']).toBe('#ded38e')
    expect(result['6']).toBe('#9ee0fa')
    expect(result['7']).toBe('#fcfaf6')
    expect(result['8']).toBe('#76d0f1')
    expect(result['9']).toBe('#feed93')
    expect(result['+']).toBe('#f66a52')
    expect(result['*']).toBe('#79d383')
    expect(result['#']).toBe('#c391f2')
  })

  it('dawnの光源文字は指定の固定色になる', () => {
    const result = phasePalette(base, 'dawn')
    expect(result['4']).toBe('#eceacb')
    expect(result['5']).toBe('#ded38e')
    expect(result['6']).toBe('#9ee0fa')
    expect(result['7']).toBe('#fcfaf6')
    expect(result['8']).toBe('#76d0f1')
    expect(result['9']).toBe('#feed93')
    expect(result['+']).toBe('#f66a52')
    expect(result['*']).toBe('#79d383')
    expect(result['#']).toBe('#c391f2')
  })

  // 色調と比率をここで釘付けにする。tintやratioを触ると必ずこのテストが落ちる
  it.each([
    ['night', '#315045'],
    ['dusk', '#92bb60'],
    ['dawn', '#6b9d83'],
  ] as const)('%sの通常文字は色調へ混ざった固定値になる', (phase, expected) => {
    expect(phasePalette(base, phase)[NORMAL_KEY]).toBe(expected)
  })

  it('通常文字は夜のほうが昼より暗い(輝度比較)', () => {
    const day = phasePalette(base, 'day')[NORMAL_KEY]
    const night = phasePalette(base, 'night')[NORMAL_KEY]
    expect(luma(night)).toBeLessThan(luma(day))
  })

  // 目的地マーカーの赤。混ぜると夜は暗い紫へ沈み、唯一の「ここへ行け」の目印が読めなくなる
  it('時間帯で変えない文字はどのフェーズでも昼の色のまま', () => {
    const actual = DAY_PHASES.map(phase => phasePalette(base, phase)[FIXED_KEY])
    expect(actual).toEqual(DAY_PHASES.map(() => FIXED_COLOR))
  })

  it.each(DAY_PHASES)('%sの出力キー集合は入力と同じ', phase => {
    expect(Object.keys(phasePalette(base, phase)).sort()).toEqual(Object.keys(base).sort())
  })

  it('16進表記でない値は素通りする', () => {
    expect(phasePalette(base, 'night')[NON_HEX_KEY]).toBe(NON_HEX_VALUE)
    expect(phasePalette(base, 'dusk')[NON_HEX_KEY]).toBe(NON_HEX_VALUE)
    expect(phasePalette(base, 'dawn')[NON_HEX_KEY]).toBe(NON_HEX_VALUE)
  })
})
