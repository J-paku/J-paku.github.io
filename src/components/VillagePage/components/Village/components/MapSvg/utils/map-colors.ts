// 地図の地形タイルと建物を塗る色
import type { Structure, Tile } from '@content/types/world'

// 地図に出るのは屋外だけだが、型を全タイルで埋めるため屋内(floor・wall・mat)も持つ
export const MINI_COLORS: Record<Tile, string> = {
  grass: '#6bb36a',
  'grass-alt': '#6bb36a',
  path: '#e0c98a',
  water: '#4f8fd1',
  plaza: '#cfd3c4',
  flower: '#7cc06f',
  tree: '#2f6b3a',
  fence: '#8a6a3a',
  floor: '#e8d090',
  wall: '#785030',
  mat: '#f0e8d0',
  doorway: '#785030',
}

const STRUCTURE_COLORS = {
  'house-red': '#c9553f',
  'house-blue': '#4c6fb0',
  robot: '#8a6a3a',
  mailbox: '#7fb7d6',
  desk: '#8a6a3a',
  bed: '#8a6a3a',
  table: '#8a6a3a',
  monument: '#9a9a8c',
  stele: '#9a9a8c',
  lamp: '#c9a13c',
  campfire: '#c9843e',
  clock: '#8a6a3a',
} as const

export function structureColor(structure: Structure) {
  if (structure.kind === 'house') return STRUCTURE_COLORS[`house-${structure.roof}`]

  return STRUCTURE_COLORS[structure.kind]
}
