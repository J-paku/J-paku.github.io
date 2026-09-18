// 全スプライトを一つの型付き辞書へまとめる
import { buildSheet } from './art'
import type { PixelArt, Sheet } from './art'
import { playerArt } from './actors'
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

export type SpriteKey = keyof typeof terrainArt | keyof typeof structureArt | PlayerSpriteKey

export const SPRITE_ARTS: Record<SpriteKey, PixelArt> = {
  ...terrainArt,
  ...structureArt,
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
