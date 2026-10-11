// 場面の自動送りの間合いと巡り方(cycle-scenes)のテスト。作品カードのリールと場面モーダルが共有する式なので、
// 周期の引き方・範囲への収め方・末尾から先頭への戻り方を、場面が1つ・端・二周ぶん越えた添字まで並べて固める
import { describe, expect, it } from 'vitest'
import { loopSceneIndex, nextSceneIndex, sceneCycleMs } from './cycle-scenes'
import {
  DEFAULT_SCENE_ANIMATION_DURATION_MS,
  SCENE_ANIMATION_DURATIONS_MS,
} from './scene-durations'

describe('sceneCycleMs', () => {
  // 表に載った場面は表の周期を返す
  it.each(Object.entries(SCENE_ANIMATION_DURATIONS_MS))('場面%sは表の周期%ims', (id, ms) => {
    expect(sceneCycleMs(id)).toBe(ms)
  })

  // 表の周期がどれも既定値と同じだと、表を引かずに既定値を返す誤りを上の行で見分けられない
  it('表には既定値と違う周期の場面がある', () => {
    const periods = Object.values(SCENE_ANIMATION_DURATIONS_MS)
    expect(periods.some(ms => ms !== DEFAULT_SCENE_ANIMATION_DURATION_MS)).toBe(true)
  })

  it('表に無い場面は既定値', () => {
    expect(sceneCycleMs('not-in-table')).toBe(DEFAULT_SCENE_ANIMATION_DURATION_MS)
  })
})

describe('loopSceneIndex', () => {
  // タプル: [説明, 添字, 場面の数, 期待値]
  it.each([
    ['先頭はそのまま', 0, 4, 0],
    ['範囲の中はそのまま', 2, 4, 2],
    ['末尾はそのまま', 3, 4, 3],
    ['数ちょうどは先頭へ戻る', 4, 4, 0],
    // 一周以内しか並べないと、剰余を1回の引き算で代用した実装でも通る
    ['二周ぶん越えても先頭から数え直す', 9, 4, 1],
    ['場面が1つなら常に先頭', 1, 1, 0],
  ] as const)('%s', (_label, index, count, expected) => {
    expect(loopSceneIndex(index, count)).toBe(expected)
  })

  // 0個では添字が決まらない。リール(showReel)もモーダル(開くボタンの有無)も0個では送りを始めない前提を固定する
  it('場面が0個なら添字は決まらない(NaN)', () => {
    expect(loopSceneIndex(0, 0)).toBeNaN()
  })
})

describe('nextSceneIndex', () => {
  // タプル: [説明, 今の添字, 場面の数, 期待値]
  it.each([
    ['先頭の次は2つ目', 0, 4, 1],
    ['途中は1つ進む', 1, 4, 2],
    ['末尾の1つ手前の次は末尾', 2, 4, 3],
    ['末尾の次は先頭へ戻る', 3, 4, 0],
    // 言語を切り替えて場面の数が減ると、前の添字が範囲の外に残りうる。その時も範囲の中へ戻す
    ['範囲の外に残った添字も範囲の中へ戻す', 5, 4, 2],
    ['場面が1つなら先頭のまま', 0, 1, 0],
  ] as const)('%s', (_label, index, count, expected) => {
    expect(nextSceneIndex(index, count)).toBe(expected)
  })
})
