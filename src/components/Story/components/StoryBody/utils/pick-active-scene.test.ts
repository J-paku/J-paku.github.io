// @vitest-environment happy-dom
// 交差の通知から今の場面を選ぶ(pick-active-scene)のテスト。帯に入った通知・出た通知・番号の無い要素・
// HTMLElement でない要素を並べ、通知の並びで最後に入った場面を選ぶかを見る
import { describe, expect, it } from 'vitest'
import { pickActiveScene } from './pick-active-scene'

// 場面の番号を付けた section(フックの ref のコールバックが付ける形)
const section = (index: number) => {
  const element = document.createElement('section')
  element.dataset.sceneIndex = String(index)
  return element
}

const entered = (target: Element) => ({ isIntersecting: true, target })
const left = (target: Element) => ({ isIntersecting: false, target })

describe('pickActiveScene', () => {
  it('通知が空なら null', () => {
    expect(pickActiveScene([])).toBeNull()
  })

  it('帯から出た通知だけなら null(今の場面を変えない)', () => {
    expect(pickActiveScene([left(section(0)), left(section(2))])).toBeNull()
  })

  it('帯に入った場面の番号を返す', () => {
    expect(pickActiveScene([entered(section(2))])).toBe(2)
  })

  it('入った場面が2つあれば、通知の並びで最後のもの', () => {
    expect(pickActiveScene([entered(section(1)), entered(section(3))])).toBe(3)
  })

  it('入った場面の後に出た場面が続いても、入った場面を返す', () => {
    expect(pickActiveScene([entered(section(1)), left(section(2))])).toBe(1)
  })

  it('番号が数でない要素は数えない', () => {
    const unnumbered = document.createElement('section')
    expect(pickActiveScene([entered(section(1)), entered(unnumbered)])).toBe(1)
    expect(pickActiveScene([entered(unnumbered)])).toBeNull()
  })

  it('HTMLElement でない要素は、番号が付いていても数えない', () => {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    shape.setAttribute('data-scene-index', '4')
    expect(pickActiveScene([entered(section(1)), entered(shape)])).toBe(1)
  })
})
