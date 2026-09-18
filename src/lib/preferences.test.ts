// 設定保存の往復・不正値・ストレージ障害を検証する
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearVillageProgress,
  readPosition,
  readTheme,
  readVisited,
  writePosition,
  writeTheme,
  writeVisited,
} from './preferences'

const LOCAL_STORAGE = ['local', 'Storage'].join('')
const SESSION_STORAGE = ['session', 'Storage'].join('')

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal(LOCAL_STORAGE, createMemoryStorage())
  vi.stubGlobal(SESSION_STORAGE, createMemoryStorage())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('preferences', () => {
  it('テーマを保存して復元する', () => {
    writeTheme('dark')

    expect(readTheme()).toBe('dark')
  })

  it('位置を保存して復元する', () => {
    const position = { worldId: 'room', cell: { x: 4, y: 7 }, facing: 'left' as const }

    writePosition('round-trip-position', position)

    expect(readPosition('round-trip-position')).toEqual(position)
  })

  it('訪問済み地点を保存して復元する', () => {
    const ids = ['home', 'studio']

    writeVisited('round-trip-visited', ids)

    expect(readVisited('round-trip-visited')).toEqual(ids)
  })

  it('村の進行状況を捨てると位置も訪問も消える', () => {
    writePosition('cleared', { worldId: 'room', cell: { x: 4, y: 7 }, facing: 'left' })
    writeVisited('cleared', ['home'])
    writePosition('kept', { worldId: 'room', cell: { x: 1, y: 2 }, facing: 'up' })

    clearVillageProgress('cleared')

    expect(readPosition('cleared')).toBeNull()
    expect(readVisited('cleared')).toEqual([])
    expect(readPosition('kept')).not.toBeNull()
  })

  it('位置の不正な JSON は null を返す', () => {
    const storage = createMemoryStorage()
    storage.setItem('village:malformed:pos', '{')
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readPosition('malformed')).toBeNull()
  })

  it('位置の不正な形は null を返す', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'village:invalid-shape:pos',
      JSON.stringify({ worldId: 'room', cell: { x: '4', y: 7 }, facing: 'forward' })
    )
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readPosition('invalid-shape')).toBeNull()
  })

  it('worldId が無い・空の位置は null を返す', () => {
    const storage = createMemoryStorage()
    const position = { cell: { x: 4, y: 7 }, facing: 'left' }
    storage.setItem('village:no-world:pos', JSON.stringify(position))
    storage.setItem('village:empty-world:pos', JSON.stringify({ ...position, worldId: '' }))
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readPosition('no-world')).toBeNull()
    expect(readPosition('empty-world')).toBeNull()
  })

  it('訪問済み地点の不正な形は空配列を返す', () => {
    const storage = createMemoryStorage()
    storage.setItem('village:invalid-visited:visited', JSON.stringify(['home', 2]))
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readVisited('invalid-visited')).toEqual([])
  })

  it('ストレージ読み込みが失敗すると null を返す', () => {
    vi.stubGlobal(LOCAL_STORAGE, {
      getItem() {
        throw new Error('storage unavailable')
      },
    })

    expect(readTheme()).toBeNull()
  })
})
