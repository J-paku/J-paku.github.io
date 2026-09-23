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

// 読めるのに書けないストレージ。容量超過(QuotaExceededError)や、保存を拒む
// プライベートモードのように、setItem / removeItem だけが失敗する状況を模す
function createWriteFailingStorage(): Storage {
  const readable = createMemoryStorage()

  return {
    get length() {
      return readable.length
    },
    clear() {
      throw new Error('storage is full')
    },
    getItem(key) {
      return readable.getItem(key)
    },
    key(index) {
      return readable.key(index)
    },
    removeItem() {
      throw new Error('storage is full')
    },
    setItem() {
      throw new Error('storage is full')
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

  it('負値・小数・巨大な座標はそのまま通る(盤面の範囲は見ていない)', () => {
    // 現在の判定は「数値であり有限であること」だけを見て、範囲も整数かどうかも見ない
    // 実測した現状を固定するもので、丸めや拒否を期待するものではない
    const storage = createMemoryStorage()
    const extreme = { worldId: 'room', cell: { x: -5, y: 1e9 }, facing: 'up' as const }
    const fractional = { worldId: 'room', cell: { x: 1.5, y: 2.5 }, facing: 'up' as const }
    storage.setItem('village:extreme:pos', JSON.stringify(extreme))
    storage.setItem('village:fractional:pos', JSON.stringify(fractional))
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readPosition('extreme')).toEqual(extreme)
    expect(readPosition('fractional')).toEqual(fractional)
  })

  it('有限でない座標(桁あふれで Infinity になる値)は null を返す', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'village:overflow:pos',
      '{"worldId":"room","cell":{"x":1e999,"y":0},"facing":"up"}'
    )
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readPosition('overflow')).toBeNull()
  })

  it('訪問済み地点の不正な JSON は空配列を返す', () => {
    const storage = createMemoryStorage()
    storage.setItem('village:malformed-visited:visited', '{')
    vi.stubGlobal(SESSION_STORAGE, storage)

    expect(readVisited('malformed-visited')).toEqual([])
  })

  it('ストレージ読み込みが失敗すると null を返す', () => {
    vi.stubGlobal(LOCAL_STORAGE, {
      getItem() {
        throw new Error('storage unavailable')
      },
    })

    expect(readTheme()).toBeNull()
  })

  it('テーマの書き込みが失敗しても例外を投げず、読み出しは既定のまま', () => {
    vi.stubGlobal(LOCAL_STORAGE, createWriteFailingStorage())

    expect(() => writeTheme('dark')).not.toThrow()
    expect(readTheme()).toBeNull()
  })

  it('位置と訪問済み地点の書き込みが失敗しても例外を投げず、読み出しは既定のまま', () => {
    vi.stubGlobal(SESSION_STORAGE, createWriteFailingStorage())
    const position = { worldId: 'room', cell: { x: 4, y: 7 }, facing: 'left' as const }

    expect(() => writePosition('write-fails', position)).not.toThrow()
    expect(() => writeVisited('write-fails', ['home'])).not.toThrow()

    expect(readPosition('write-fails')).toBeNull()
    expect(readVisited('write-fails')).toEqual([])
  })

  it('進行状況の破棄が失敗しても例外を投げない', () => {
    vi.stubGlobal(SESSION_STORAGE, createWriteFailingStorage())

    expect(() => clearVillageProgress('clear-fails')).not.toThrow()
  })
})
