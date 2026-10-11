// 場面モーダルのフォーカスの逃がし先(rescue-focus)のテスト。手で送った時と自動送りの時のそれぞれで、
// 先頭・途中・末尾・場面が1つと、今フォーカスが乗っているボタン(前へ・次へ・どちらでもない)の組を並べる
import { describe, expect, it } from 'vitest'
import { focusAfterStep, focusedNav, focusOnAutoAdvance } from './rescue-focus'

describe('focusedNav', () => {
  // DOM を持たない環境なので、ボタンの代わりに別々の素のオブジェクトで同じものかを比べる
  const prev = { name: 'prev' }
  const next = { name: 'next' }
  const other = { name: 'close' }

  it('前へに乗っていれば前へ', () => {
    expect(focusedNav(prev, prev, next)).toBe('prev')
  })

  it('次へに乗っていれば次へ', () => {
    expect(focusedNav(next, prev, next)).toBe('next')
  })

  it('どちらでもないボタンに乗っていれば null', () => {
    expect(focusedNav(other, prev, next)).toBeNull()
  })

  // フォーカスが無い(null)時に、まだ空のボタンの参照(null)と同じものとみなさない
  it.each([
    ['ボタンがそろっている', prev, next],
    ['前へがまだ空', null, next],
    ['次へがまだ空', prev, null],
  ] as const)('フォーカスが無ければ null(%s)', (_label, prevButton, nextButton) => {
    expect(focusedNav(null, prevButton, nextButton)).toBeNull()
  })
})

describe('focusAfterStep', () => {
  // タプル: [説明, 送った先, 場面の数, 逃がし先]
  it.each([
    ['先頭へ着いたら、無効になる前へから次へ逃がす', 0, 4, 'next'],
    ['末尾へ着いたら、無効になる次へから前へ逃がす', 3, 4, 'prev'],
    ['途中では動かさない', 1, 4, null],
    ['末尾の1つ手前でも動かさない', 2, 4, null],
    ['場面が1つで両方が無効になるなら閉じるへ', 0, 1, 'close'],
  ] as const)('%s', (_label, target, count, expected) => {
    expect(focusAfterStep(target, count)).toBe(expected)
  })
})

describe('focusOnAutoAdvance', () => {
  // タプル: [説明, 送った先, 場面の数, 今フォーカスが乗っているボタン, 逃がし先]
  it.each([
    // 末尾から先頭へ巡る: 前へが無効になる
    ['先頭へ巡る時に前へに乗っていれば閉じるへ逃がす', 0, 4, 'prev', 'close'],
    ['先頭へ巡る時に次へに乗っていれば動かさない', 0, 4, 'next', null],
    ['先頭へ巡る時に前へ・次へ以外なら動かさない', 0, 4, null, null],
    // 末尾の1つ手前から末尾へ: 次へが無効になる
    ['末尾へ着く時に次へに乗っていれば前へ逃がす', 3, 4, 'next', 'prev'],
    ['末尾へ着く時に前へに乗っていれば動かさない', 3, 4, 'prev', null],
    ['末尾へ着く時に前へ・次へ以外なら動かさない', 3, 4, null, null],
    // 途中へ送る時はどちらも有効なまま
    ['途中へ送る時は次へに乗っていても動かさない', 2, 4, 'next', null],
    ['途中へ送る時は前へに乗っていても動かさない', 1, 4, 'prev', null],
    // 場面が1つ: 送った先は先頭でも末尾でもある。先頭の扱い(前へに乗っていれば閉じるへ)が勝つ
    ['場面が1つで前へに乗っていれば閉じるへ逃がす', 0, 1, 'prev', 'close'],
    ['場面が1つで次へに乗っていれば動かさない', 0, 1, 'next', null],
  ] as const)('%s', (_label, target, count, focused, expected) => {
    expect(focusOnAutoAdvance(target, count, focused)).toBe(expected)
  })
})
