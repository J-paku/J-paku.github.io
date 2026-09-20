// 全スプライトを型付き辞書へまとめる。地形・建物は 16×16 の1枚、主人公は 16×24 の別シート
import { buildSheet } from './art'
import type { PixelArt, Sheet } from './art'
import { playerArt, PLAYER_HEIGHT } from './actors'
import { palette } from './palette'
import { phasePalette } from './palette-phase'
import { structureArt } from './structures'
import { terrainArt } from './terrain'
import { weatherArt } from './weather-art'
import type { DayPhase } from '@/utils/day-phase'

type PlayerSpriteKey =
  | 'player-up-0'
  | 'player-up-1'
  | 'player-up-2'
  | 'player-down-0'
  | 'player-down-1'
  | 'player-down-2'
  | 'player-right-0'
  | 'player-right-1'

export type SpriteKey = keyof typeof terrainArt | keyof typeof structureArt

export const SPRITE_ARTS: Record<SpriteKey, PixelArt> = {
  ...terrainArt,
  ...structureArt,
}

export const PLAYER_ARTS: Record<PlayerSpriteKey, PixelArt> = {
  'player-up-0': playerArt.up[0],
  'player-up-1': playerArt.up[1],
  'player-up-2': playerArt.up[2],
  'player-down-0': playerArt.down[0],
  'player-down-1': playerArt.down[1],
  'player-down-2': playerArt.down[2],
  'player-right-0': playerArt.right[0],
  'player-right-1': playerArt.right[1],
}

// 天気の 1 コマ = 1 枚。マス 1 つぶんだけを焼くので、そのまま repeat で敷き詰められる
const weatherSheet = (key: string, art: PixelArt): Sheet => buildSheet({ [key]: art }, palette)

// 単段階ぶんのシート。どの段階も同じ順序で同じ枚数を焼くので index と count は 4 枚で共通になる。
// UI は画像の URI だけを差し替えて昼夜を切り替えるため、この不変条件が崩れるとマスの絵がずれる
export const buildSprites = (phase: DayPhase = 'day'): Sheet =>
  buildSheet(SPRITE_ARTS, phasePalette(palette, phase))

// 主人公も同じ段階の色を通す(夜に主人公だけ昼の色だと浮くため)
export const buildPlayerSprites = (phase: DayPhase = 'day'): Sheet =>
  buildSheet(PLAYER_ARTS, phasePalette(palette, phase), PLAYER_HEIGHT)

// 雨・雪をコマごとに別シートで返す。時刻による色替えはしない(降る粒は地形ではない)。
// 2 コマを 1 枚へ横に並べると CSS の繰り返し単位が 2 マス幅になり、コマを送っても模様全体が
// 横へ 1 マスずれるだけで粒が落ちて見えない(ずらした合成が元の左 16px 平行移動と全画素一致)。
// 1 コマ 1 枚なら層ごとに repeat で敷けるので、2 層を重ねて交互に見せれば落ちて見える
export const buildWeatherSprites = (): Record<'rain' | 'snow', readonly [Sheet, Sheet]> => ({
  rain: [weatherSheet('rain-0', weatherArt.rain[0]), weatherSheet('rain-1', weatherArt.rain[1])],
  snow: [weatherSheet('snow-0', weatherArt.snow[0]), weatherSheet('snow-1', weatherArt.snow[1])],
})
