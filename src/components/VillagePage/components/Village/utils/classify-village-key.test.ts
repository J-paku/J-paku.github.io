// 村のキー判定(classifyVillageKey・keyDirection)のテスト
import { describe, expect, it } from 'vitest'
import type { Direction } from '@content/types/world'
import { classifyVillageKey, keyDirection } from './classify-village-key'
import type { VillageKey } from './classify-village-key'

// 修飾キーも自動反復も無い素の1回押し。確かめる値だけ上書きする
const press = (code: string, extra: Partial<VillageKey> = {}): VillageKey => ({
  code,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
})

const DIRECTIONS: [string, Direction][] = [
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['KeyW', 'up'],
  ['KeyS', 'down'],
  ['KeyA', 'left'],
  ['KeyD', 'right'],
]

const MODIFIERS = ['ctrlKey', 'metaKey', 'altKey'] as const

// 何もせず既定の動作を残す
const NONE = { kind: 'none', preventDefault: false }

describe('classifyVillageKey', () => {
  it.each([false, true])('Escape は locked=%s でも閉じる操作にして既定の動作を止める', locked => {
    expect(classifyVillageKey(press('Escape'), locked)).toStrictEqual({
      kind: 'escape',
      preventDefault: true,
    })
  })

  it.each([false, true])('M は locked=%s でも地図の開閉にする', locked => {
    expect(classifyVillageKey(press('KeyM'), locked)).toStrictEqual({
      kind: 'map',
      preventDefault: true,
    })
  })

  it.each([false, true])('Z は A・X は B。locked=%s でも受け付ける', locked => {
    expect(classifyVillageKey(press('KeyZ'), locked)).toStrictEqual({
      kind: 'a',
      preventDefault: true,
    })
    expect(classifyVillageKey(press('KeyX'), locked)).toStrictEqual({
      kind: 'b',
      preventDefault: true,
    })
  })

  it.each(MODIFIERS)('Z/X に %s が付くと何もせず既定の動作を残す(歩きも止めない)', modifier => {
    for (const code of ['KeyZ', 'KeyX']) {
      for (const locked of [false, true]) {
        expect(classifyVillageKey(press(code, { [modifier]: true }), locked)).toStrictEqual(NONE)
      }
    }
  })

  it('Z/X の自動反復は既定の動作だけ止めて A/B を呼ばない', () => {
    for (const code of ['KeyZ', 'KeyX']) {
      expect(classifyVillageKey(press(code, { repeat: true }), false)).toStrictEqual({
        kind: 'none',
        preventDefault: true,
      })
    }
  })

  it('修飾キー付きの自動反復は、修飾キーの方を先に見て既定の動作を残す', () => {
    const key = press('KeyZ', { ctrlKey: true, repeat: true })
    expect(classifyVillageKey(key, false)).toStrictEqual(NONE)
  })

  it('修飾キーと自動反復は Z/X 以外の判定を変えない', () => {
    const noisy = { ctrlKey: true, metaKey: true, altKey: true, repeat: true }
    expect(classifyVillageKey(press('Escape', noisy), false)).toStrictEqual({
      kind: 'escape',
      preventDefault: true,
    })
    expect(classifyVillageKey(press('ArrowUp', noisy), false)).toStrictEqual({
      kind: 'walk',
      direction: 'up',
      preventDefault: true,
    })
    expect(classifyVillageKey(press('KeyE', noisy), false)).toStrictEqual({
      kind: 'talk',
      preventDefault: true,
    })
  })

  it.each(DIRECTIONS)('歩ける間の %s は %s へ歩く', (code, direction) => {
    expect(classifyVillageKey(press(code), false)).toStrictEqual({
      kind: 'walk',
      direction,
      preventDefault: true,
    })
  })

  it.each(DIRECTIONS)('locked の間の %s は %s へ本文送り・焦点移動する', (code, direction) => {
    expect(classifyVillageKey(press(code), true)).toStrictEqual({
      kind: 'scroll',
      direction,
      preventDefault: true,
    })
  })

  it.each(['KeyE', 'Enter', 'NumpadEnter'])('歩ける間の %s は話しかける', code => {
    expect(classifyVillageKey(press(code), false)).toStrictEqual({
      kind: 'talk',
      preventDefault: true,
    })
  })

  it.each(['KeyE', 'Enter', 'NumpadEnter', 'Space', 'KeyQ'])(
    'locked の間の方向キー以外(%s)は歩きを止めるだけで既定の動作を残す',
    code => {
      expect(classifyVillageKey(press(code), true)).toStrictEqual({
        kind: 'release',
        preventDefault: false,
      })
    }
  )

  it.each(['Space', 'KeyQ', 'Tab', ''])('歩ける間の関係ないキー(%s)は何もしない', code => {
    expect(classifyVillageKey(press(code), false)).toStrictEqual(NONE)
  })

  it('event.code は大文字小文字を区別する。小文字の綴りや key の値(z)では反応しない', () => {
    for (const code of ['escape', 'keym', 'keyz', 'keyx', 'z', 'arrowup', 'keye', 'enter']) {
      expect(classifyVillageKey(press(code), false)).toStrictEqual(NONE)
    }
  })
})

describe('keyDirection', () => {
  it.each(DIRECTIONS)('%s は %s', (code, direction) => {
    expect(keyDirection(code)).toBe(direction)
  })

  it('方向キーでなければ undefined(大文字小文字も区別する)', () => {
    for (const code of ['KeyE', 'arrowup', 'keyw', 'Up', '']) {
      expect(keyDirection(code)).toBeUndefined()
    }
  })
})
