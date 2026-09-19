// 全スプライトを型付き辞書へまとめる。地形・建物は 16×16 の1枚、主人公は 16×24 の別シート
import { buildSheet } from './art'
import type { PixelArt, Sheet } from './art'
import { playerArt, PLAYER_HEIGHT } from './actors'
import { palette } from './palette'
import { structureArt } from './structures'
import { terrainArt } from './terrain'

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

export const buildSprites = (): Sheet => buildSheet(SPRITE_ARTS, palette)
export const buildPlayerSprites = (): Sheet => buildSheet(PLAYER_ARTS, palette, PLAYER_HEIGHT)
