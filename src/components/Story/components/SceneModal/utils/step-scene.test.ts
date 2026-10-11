// 場面モーダルの場面送りの判定(step-scene)のテスト。端の判定・前へ/次へで移る先・自動送りの待ちを、
// 先頭・途中・末尾・場面が1つ・一時停止中・動きを控える設定で並べる
import { describe, expect, it } from 'vitest'
import { sceneCycleMs } from '@/utils/cycle-scenes'
import { autoAdvanceDelayMs, nextSceneTarget, prevSceneTarget, sceneEdges } from './step-scene'

describe('sceneEdges', () => {
  // タプル: [説明, 添字, 場面の数, 先頭か, 末尾か]
  it.each([
    ['先頭', 0, 4, true, false],
    ['途中', 1, 4, false, false],
    ['末尾の1つ手前', 2, 4, false, false],
    ['末尾', 3, 4, false, true],
    ['場面が1つなら先頭でも末尾でもある', 0, 1, true, true],
  ] as const)('%s', (_label, index, count, isFirst, isLast) => {
    expect(sceneEdges(index, count)).toEqual({ isFirst, isLast })
  })
})

describe('prevSceneTarget', () => {
  it('先頭ではどこへも移らない', () => {
    expect(prevSceneTarget(0)).toBeNull()
  })

  // 先頭の隣(0 へ移る)を入れないと、0 を「移らない」と取り違える実装を見分けられない
  it.each([
    [1, 0],
    [3, 2],
  ] as const)('%iからは%iへ移る', (index, expected) => {
    expect(prevSceneTarget(index)).toBe(expected)
  })
})

describe('nextSceneTarget', () => {
  // 手で送る時は末尾から先頭へ巡らない
  it.each([
    ['末尾', 3, 4],
    ['場面が1つ', 0, 1],
  ] as const)('%sではどこへも移らない', (_label, index, count) => {
    expect(nextSceneTarget(index, count)).toBeNull()
  })

  it.each([
    [0, 4, 1],
    [2, 4, 3],
  ] as const)('%iから(全%i場面)は%iへ移る', (index, count, expected) => {
    expect(nextSceneTarget(index, count)).toBe(expected)
  })
})

describe('autoAdvanceDelayMs', () => {
  // 表で周期が既定値と違う場面を使う。既定値の場面だと、場面を見ずに既定値を返す誤りを見分けられない
  const SCENE_ID = 'camera'

  it('動きを控えず一時停止もしていなければ、その場面の周期だけ待って送る', () => {
    expect(autoAdvanceDelayMs(SCENE_ID, false, false)).toBe(sceneCycleMs(SCENE_ID))
    expect(autoAdvanceDelayMs('nearby', false, false)).toBe(sceneCycleMs('nearby'))
    expect(sceneCycleMs(SCENE_ID)).not.toBe(sceneCycleMs('nearby'))
  })

  // タプル: [説明, 動きを控えるか, 一時停止中か]。片方だけが真の組を両方並べ、どちらの条件も単独で効くことを見る
  it.each([
    ['一時停止中', false, true],
    ['動きを控える設定', true, false],
    ['動きを控える設定で一時停止中', true, true],
  ] as const)('%sは送らない', (_label, reducedMotion, paused) => {
    expect(autoAdvanceDelayMs(SCENE_ID, reducedMotion, paused)).toBeNull()
  })
})
