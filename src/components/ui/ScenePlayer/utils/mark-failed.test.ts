// 取得に失敗した場面の印(mark-failed)のテスト。印の無い場面を足すと新しい集まりになり、
// もう印のある場面では同じ集まりのまま(状態の更新が描き直しを起こさない)かを見る
import { describe, expect, it } from 'vitest'
import { markFailed } from './mark-failed'

describe('markFailed', () => {
  it('印の無い場面は、足した新しい集まりを返し、前の集まりは変えない', () => {
    const failed = new Set(['scene-1'])
    const next = markFailed(failed, 'scene-2')

    expect(next).not.toBe(failed)
    expect([...next]).toEqual(['scene-1', 'scene-2'])
    expect([...failed]).toEqual(['scene-1'])
  })

  it('もう印のある場面は、同じ集まりをそのまま返す', () => {
    const failed = new Set(['scene-1', 'scene-2'])

    expect(markFailed(failed, 'scene-1')).toBe(failed)
    expect([...failed]).toEqual(['scene-1', 'scene-2'])
  })
})
