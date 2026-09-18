// テーマと村の進行状況を安全に保存・復元する唯一の窓口
import type { Cell, Direction } from '@content/types/world'

export type Theme = 'light' | 'dark'
// worldId = 復元先のワールド。村は複数ワールドなのでマスだけでは位置が決まらない
export type VillagePosition = { worldId: string; cell: Cell; facing: Direction }

export const THEME_STORAGE_KEY = 'theme'

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && DIRECTIONS.includes(value as Direction)
}

function isCell(value: unknown): value is Cell {
  if (typeof value !== 'object' || value === null) return false

  const cell = value as Record<string, unknown>
  return (
    typeof cell.x === 'number' &&
    Number.isFinite(cell.x) &&
    typeof cell.y === 'number' &&
    Number.isFinite(cell.y)
  )
}

function isVillagePosition(value: unknown): value is VillagePosition {
  if (typeof value !== 'object' || value === null) return false

  const position = value as Record<string, unknown>
  return (
    typeof position.worldId === 'string' &&
    position.worldId.length > 0 &&
    isCell(position.cell) &&
    isDirection(position.facing)
  )
}

export function readTheme(): Theme | null {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY)
    return theme === 'light' || theme === 'dark' ? theme : null
  } catch {
    return null
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {}
}

// setId = WorldSet の id。位置も訪問も村ひとまとまりで保存する
export function readPosition(setId: string): VillagePosition | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`village:${setId}:pos`) ?? '')
    return isVillagePosition(value) ? value : null
  } catch {
    return null
  }
}

export function writePosition(setId: string, position: VillagePosition): void {
  try {
    sessionStorage.setItem(`village:${setId}:pos`, JSON.stringify(position))
  } catch {}
}

export function readVisited(setId: string): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`village:${setId}:visited`) ?? '')
    return Array.isArray(value) && value.every(id => typeof id === 'string') ? value : []
  } catch {
    return []
  }
}

export function writeVisited(setId: string, ids: string[]): void {
  try {
    sessionStorage.setItem(`village:${setId}:visited`, JSON.stringify(ids))
  } catch {}
}

// 再読み込みでは最初からやり直すため、位置と訪問をまとめて捨てる
export function clearVillageProgress(setId: string): void {
  try {
    sessionStorage.removeItem(`village:${setId}:pos`)
    sessionStorage.removeItem(`village:${setId}:visited`)
  } catch {}
}
