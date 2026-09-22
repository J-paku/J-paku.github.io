import { describe, expect, it } from 'vitest'
import type { MoveState } from './movement'
import {
  BITE_BRACE_MS,
  BITE_TUGS,
  FISHING_BITE_TUG_MS,
  FISHING_PULL_MS,
  FISHING_SWING_MS,
  playerPose,
  type FishingPosePhase,
} from './player-pose'

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
  const facings = ['up', 'down', 'left', 'right'] as const
  const phases = ['casting', 'bite', 'landing', 'caught'] as const
  it('正面・背面の一歩ごとに専用コマで軸足を交代する', () => {
    for (const facing of ['up', 'down'] as const) {
      expect(playerPose({ ...state, facing, motion, stride: 0 }, false)).toEqual({
        key: `player-${facing}-1`,
        flip: false,
        animating: false,
      })
      expect(playerPose({ ...state, facing, motion, stride: 1 }, false)).toEqual({
        key: `player-${facing}-2`,
        flip: false,
        animating: false,
      })
    }
  })
  it('横向きの反転は進行方向だけで決まり、軸足では後ろを向かない', () => {
    for (const stride of [0, 1] as const) {
      expect(playerPose({ ...state, facing: 'left', motion, stride }, false)).toEqual({
        key: 'player-right-1',
        flip: true,
        animating: false,
      })
      expect(playerPose({ ...state, facing: 'right', motion, stride }, false)).toEqual({
        key: 'player-right-1',
        flip: false,
        animating: false,
      })
    }
  })
  it('静止時とreduced motionでは歩行コマを使わない', () => {
    expect(playerPose({ ...state, facing: 'down', stride: 1 }, false)).toEqual({
      key: 'player-down-0',
      flip: false,
      animating: false,
    })
    expect(playerPose({ ...state, facing: 'down', motion, stride: 1 }, true)).toEqual({
      key: 'player-down-0',
      flip: false,
      animating: false,
    })
  })
  it('釣っている間は向きごとの竿コマを使い、歩いていても歩行コマへ戻らない', () => {
    for (const facing of ['up', 'down', 'right'] as const) {
      expect(
        playerPose({ ...state, facing, motion, stride: 1 }, false, 'casting', FISHING_SWING_MS)
      ).toEqual({
        key: `player-fish-${facing}`,
        flip: false,
        animating: false,
      })
    }
  })
  it('釣っている左向きは右向きの竿コマを反転して作る', () => {
    // 竿コマも歩行コマと同じで、左向きの絵は持たない
    expect(
      playerPose({ ...state, facing: 'left', stride: 0 }, false, 'casting', FISHING_SWING_MS)
    ).toEqual({
      key: 'player-fish-right',
      flip: true,
      animating: false,
    })
  })
  it('絵・E2E と共有する長さは約束どおりの値を持つ', () => {
    expect(FISHING_SWING_MS).toBe(480)
    // fishing-float.module.css の village-float-bite 0.3s と同じ
    expect(FISHING_BITE_TUG_MS).toBe(300)
    expect(FISHING_PULL_MS).toBe(200)
    // 合図の前後で力む長さと、体が引かれる回数(village-float-bite の反復回数 2 と同じ)
    expect(BITE_BRACE_MS).toBe(50)
    expect(BITE_TUGS).toBe(2)
  })
  // [経過 ms, 接尾辞, まだ時間でコマが変わるか]。境界は直前(x.9)とちょうどの両方を置く
  const timetable: Record<FishingPosePhase, readonly (readonly [number, string, boolean])[]> = {
    casting: [
      [0, '-windup', true],
      [119.9, '-windup', true],
      [120, '-backswing', true],
      [239.9, '-backswing', true],
      [240, '-cast', true],
      [359.9, '-cast', true],
      [360, '-follow', true],
      [479.9, '-follow', true],
      [480, '', false],
      [5000, '', false],
    ],
    bite: [
      [0, '', true],
      [99.9, '', true],
      [100, '-tense', true],
      [149.9, '-tense', true],
      // 浮きが沈み始める(周期の後半)のと同時に引かれる
      [150, '-bite', true],
      [249.9, '-bite', true],
      [250, '-tense', true],
      [299.9, '-tense', true],
      [300, '', true],
      [399.9, '', true],
      [400, '-tense', true],
      [449.9, '-tense', true],
      [450, '-bite', true],
      [549.9, '-bite', true],
      [550, '-tense', true],
      [599.9, '-tense', true],
      [600, '-tense', false],
      [5000, '-tense', false],
    ],
    landing: [
      [0, '-pull', true],
      [199.9, '-pull', true],
      [200, '-hoist', false],
      [5000, '-hoist', false],
    ],
    caught: [
      [0, '-hoist', false],
      [5000, '-hoist', false],
    ],
  }
  for (const phase of phases) {
    it(`${phase} の竿コマは段階に入ってからの経過で時間表どおりに進む(4 方向)`, () => {
      for (const facing of facings) {
        const direction = facing === 'left' ? 'right' : facing
        for (const [elapsed, suffix, animating] of timetable[phase]) {
          expect(playerPose({ ...state, facing }, false, phase, elapsed), `${elapsed}ms`).toEqual({
            key: `player-fish-${direction}${suffix}`,
            flip: facing === 'left',
            animating,
          })
        }
      }
    })
  }
  it('animating は段階ごとの決まった時刻で一度だけ false になり、以後コマも変わらない', () => {
    // ループはこれが false になった時点で眠るので、その後に時間でコマが変わると描き漏れる
    const settleAt: Record<FishingPosePhase, number> = {
      casting: 480,
      bite: 600,
      landing: 200,
      caught: 0,
    }
    for (const phase of phases) {
      let settledKey: string | null = null
      for (let tenths = 0; tenths <= 10000; tenths += 1) {
        const elapsed = tenths / 10
        const pose = playerPose(state, false, phase, elapsed)
        expect(pose.animating, `${phase} ${elapsed}ms`).toBe(elapsed < settleAt[phase])
        if (!pose.animating) {
          settledKey ??= pose.key
          expect(pose.key, `${phase} ${elapsed}ms`).toBe(settledKey)
        }
      }
    }
  })
  it('reduced motion では時間で切り替えず、段階ごとの止まったコマだけを出す', () => {
    const still: Record<FishingPosePhase, string> = {
      casting: '',
      bite: '-tense',
      landing: '-hoist',
      caught: '-hoist',
    }
    for (const facing of facings) {
      const direction = facing === 'left' ? 'right' : facing
      for (const phase of phases) {
        for (const elapsed of [0, 130, 160, 260, 5000]) {
          expect(playerPose({ ...state, facing }, true, phase, elapsed)).toEqual({
            key: `player-fish-${direction}${still[phase]}`,
            flip: facing === 'left',
            animating: false,
          })
        }
      }
    }
  })
  it('釣っていなければ経過に関わらず今まで通りの歩行コマを返し、時間では変わらない', () => {
    expect(playerPose({ ...state, facing: 'down', motion, stride: 0 }, false, null)).toEqual({
      key: 'player-down-1',
      flip: false,
      animating: false,
    })
    expect(playerPose({ ...state, facing: 'left' }, false, null, 100)).toEqual({
      key: 'player-right-0',
      flip: true,
      animating: false,
    })
  })
  it('progressが0.5ちょうどなら歩行コマを終え、0.49ならまだ歩行コマを使う', () => {
    expect(
      playerPose(
        { ...state, facing: 'down', motion: { ...motion, progress: 0.5 }, stride: 0 },
        false
      )
    ).toEqual({ key: 'player-down-0', flip: false, animating: false })
    expect(
      playerPose(
        { ...state, facing: 'down', motion: { ...motion, progress: 0.49 }, stride: 0 },
        false
      )
    ).toEqual({ key: 'player-down-1', flip: false, animating: false })
  })
})
