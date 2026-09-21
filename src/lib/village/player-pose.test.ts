import { describe, expect, it } from 'vitest'
import type { MoveState } from './movement'
import { playerPose } from './player-pose'

describe('playerPose', () => {
  const state: MoveState = {
    cell: { x: 1, y: 1 },
    facing: 'down',
    motion: null,
    route: [],
    fast: false,
    turnRemainingMs: 0,
    stride: 0,
  }
  const motion = { from: state.cell, to: { x: state.cell.x + 1, y: state.cell.y }, progress: 0.25 }
  it('正面・背面の一歩ごとに専用コマで軸足を交代する', () => {
    for (const facing of ['up', 'down'] as const) {
      expect(playerPose({ ...state, facing, motion, stride: 0 }, false)).toEqual({
        key: `player-${facing}-1`,
        flip: false,
      })
      expect(playerPose({ ...state, facing, motion, stride: 1 }, false)).toEqual({
        key: `player-${facing}-2`,
        flip: false,
      })
    }
  })
  it('横向きの反転は進行方向だけで決まり、軸足では後ろを向かない', () => {
    for (const stride of [0, 1] as const) {
      expect(playerPose({ ...state, facing: 'left', motion, stride }, false)).toEqual({
        key: 'player-right-1',
        flip: true,
      })
      expect(playerPose({ ...state, facing: 'right', motion, stride }, false)).toEqual({
        key: 'player-right-1',
        flip: false,
      })
    }
  })
  it('静止時とreduced motionでは歩行コマを使わない', () => {
    expect(playerPose({ ...state, facing: 'down', stride: 1 }, false)).toEqual({
      key: 'player-down-0',
      flip: false,
    })
    expect(playerPose({ ...state, facing: 'down', motion, stride: 1 }, true)).toEqual({
      key: 'player-down-0',
      flip: false,
    })
  })
  it('釣っている間は向きごとの竿コマを使い、歩いていても歩行コマへ戻らない', () => {
    for (const facing of ['up', 'down', 'right'] as const) {
      expect(playerPose({ ...state, facing, motion, stride: 1 }, false, true)).toEqual({
        key: `player-fish-${facing}`,
        flip: false,
      })
    }
  })
  it('釣っている左向きは右向きの竿コマを反転して作る', () => {
    // 竿コマも歩行コマと同じで、左向きの絵は持たない
    expect(playerPose({ ...state, facing: 'left', stride: 0 }, false, true)).toEqual({
      key: 'player-fish-right',
      flip: true,
    })
  })
  it('釣っていなければ今まで通りの歩行コマを返す', () => {
    expect(playerPose({ ...state, facing: 'down', motion, stride: 0 }, false, false)).toEqual({
      key: 'player-down-1',
      flip: false,
    })
  })
  it('progressが0.5ちょうどなら歩行コマを終え、0.49ならまだ歩行コマを使う', () => {
    expect(
      playerPose(
        { ...state, facing: 'down', motion: { ...motion, progress: 0.5 }, stride: 0 },
        false
      )
    ).toEqual({ key: 'player-down-0', flip: false })
    expect(
      playerPose(
        { ...state, facing: 'down', motion: { ...motion, progress: 0.49 }, stride: 0 },
        false
      )
    ).toEqual({ key: 'player-down-1', flip: false })
  })
})
