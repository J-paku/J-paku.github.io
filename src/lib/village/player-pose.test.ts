import { describe, expect, it } from 'vitest'
import type { MoveState } from './movement'
import {
  BITE_BRACE_MS,
  BITE_TUGS,
  FISHING_BITE_TUG_MS,
  FISHING_PULL_MS,
  FISHING_SWING_MS,
  playerPose,
  UMBRELLA_CLOSE_MS,
  UMBRELLA_OPEN_MS,
  umbrellaBusy,
  type FishingPosePhase,
  type UmbrellaPosePhase,
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

  const umbrellaPhases = ['opening', 'open', 'closing'] as const
  it('傘の出し入れの長さは傘の動きの設計どおりの値を持つ', () => {
    expect(UMBRELLA_OPEN_MS).toBe(880)
    expect(UMBRELLA_CLOSE_MS).toBe(960)
  })
  // [経過 ms, 時間表のコマ]。null は時間表を過ぎて歩行コマへ戻った後。境界は直前(x.9)とちょうどの両方を置く
  type UmbrellaRow = readonly [number, string | null]
  const umbrellaTimetable: Record<UmbrellaPosePhase, readonly UmbrellaRow[]> = {
    opening: [
      [0, 'player-umbrella-open-reach'],
      [119.9, 'player-umbrella-open-reach'],
      [120, 'player-umbrella-open-draw'],
      [279.9, 'player-umbrella-open-draw'],
      [280, 'player-umbrella-open-extend'],
      [439.9, 'player-umbrella-open-extend'],
      [440, 'player-umbrella-open-half'],
      [579.9, 'player-umbrella-open-half'],
      [580, 'player-umbrella-open-raise'],
      [719.9, 'player-umbrella-open-raise'],
      [720, 'player-umbrella-down-0'],
      [879.9, 'player-umbrella-down-0'],
      [880, null],
      [5000, null],
    ],
    open: [
      [0, null],
      [5000, null],
    ],
    closing: [
      [0, 'player-umbrella-up-0'],
      [79.9, 'player-umbrella-up-0'],
      [80, 'player-umbrella-close-lower'],
      [219.9, 'player-umbrella-close-lower'],
      [220, 'player-umbrella-close-half'],
      [359.9, 'player-umbrella-close-half'],
      [360, 'player-umbrella-close-closed'],
      [519.9, 'player-umbrella-close-closed'],
      [520, 'player-umbrella-close-compact'],
      [699.9, 'player-umbrella-close-compact'],
      [700, 'player-umbrella-close-stow'],
      [879.9, 'player-umbrella-close-stow'],
      // 仕舞い終えた背面は傘を持たない普段の背面の絵
      [880, 'player-up-0'],
      [959.9, 'player-up-0'],
      [960, null],
      [5000, null],
    ],
  }
  // 時間表を過ぎた後に戻る歩行コマの系統。広げ終えたら傘を差したまま、畳み終えたら傘なし
  const umbrellaSettled: Record<UmbrellaPosePhase, string> = {
    opening: 'player-umbrella',
    open: 'player-umbrella',
    closing: 'player',
  }
  // 時間表を過ぎた後の静止コマ。傘を差した左向きは原画の左向きのコマを反転せずに使い、
  // 傘の無い左向きは右向きの反転
  const settledPose = (phase: UmbrellaPosePhase, facing: (typeof facings)[number]) =>
    umbrellaSettled[phase] === 'player-umbrella' && facing === 'left'
      ? { key: 'player-umbrella-left-0', flip: false, animating: false }
      : {
          key: `${umbrellaSettled[phase]}-${facing === 'left' ? 'right' : facing}-0`,
          flip: facing === 'left',
          animating: false,
        }
  for (const phase of umbrellaPhases) {
    it(`${phase} の傘のコマは経過で時間表どおりに進み、その間は向きに関わらず反転しない`, () => {
      for (const facing of facings) {
        for (const [elapsed, cut] of umbrellaTimetable[phase]) {
          expect(
            playerPose({ ...state, facing }, false, null, 0, phase, elapsed),
            `${facing} ${elapsed}ms`
          ).toEqual(
            cut === null ? settledPose(phase, facing) : { key: cut, flip: false, animating: true }
          )
        }
      }
    })
  }
  it('傘の animating は段階ごとの決まった時刻で一度だけ false になり、以後コマも変わらない', () => {
    // ループはこれが false になった時点で眠るので、その後に時間でコマが変わると描き漏れる
    const settleAt: Record<UmbrellaPosePhase, number> = { opening: 880, open: 0, closing: 960 }
    for (const phase of umbrellaPhases) {
      let settledKey: string | null = null
      for (let tenths = 0; tenths <= 20000; tenths += 1) {
        const elapsed = tenths / 10
        const pose = playerPose(state, false, null, 0, phase, elapsed)
        expect(pose.animating, `${phase} ${elapsed}ms`).toBe(elapsed < settleAt[phase])
        if (!pose.animating) {
          settledKey ??= pose.key
          expect(pose.key, `${phase} ${elapsed}ms`).toBe(settledKey)
        }
      }
    }
  })
  it('reduced motion では広げる・畳むコマを飛ばし、最初から終えた後の立ちコマを出す', () => {
    for (const facing of facings) {
      for (const phase of umbrellaPhases) {
        for (const elapsed of [0, 119, 120, 720, 879.9, 959.9, 5000]) {
          expect(
            playerPose({ ...state, facing, motion, stride: 1 }, true, null, 0, phase, elapsed),
            `${facing} ${phase} ${elapsed}ms`
          ).toEqual(settledPose(phase, facing))
        }
      }
    }
  })
  it('釣っている間は傘の段階に関わらず竿のコマを出し、時間で変わるかも竿だけで決まる', () => {
    for (const phase of umbrellaPhases) {
      for (const facing of facings) {
        const direction = facing === 'left' ? 'right' : facing
        // 竿を振り始めたところ。傘も時間表の最初にいる
        expect(playerPose({ ...state, facing }, false, 'casting', 0, phase, 0)).toEqual({
          key: `player-fish-${direction}-windup`,
          flip: facing === 'left',
          animating: true,
        })
        // 竿は振り終えた構え。傘がまだ時間表の途中でも、出ているのは竿のコマなので時間で変わらない
        expect(
          playerPose({ ...state, facing }, false, 'casting', FISHING_SWING_MS, phase, 0)
        ).toEqual({ key: `player-fish-${direction}`, flip: facing === 'left', animating: false })
      }
    }
  })
  it('傘を差したままの歩行コマは普段の歩行コマと同じ選び方で、傘の系統の鍵を使う', () => {
    const open = (moving: MoveState) => playerPose(moving, false, null, 0, 'open', 0)
    expect(open({ ...state, facing: 'down', motion, stride: 1 })).toEqual({
      key: 'player-umbrella-down-2',
      flip: false,
      animating: false,
    })
    expect(open({ ...state, facing: 'up', motion, stride: 0 })).toEqual({
      key: 'player-umbrella-up-1',
      flip: false,
      animating: false,
    })
    // 横向きは軸足によらず 1 番。傘を差した左は原画の左向きのコマで、反転しない
    expect(open({ ...state, facing: 'left', motion, stride: 1 })).toEqual({
      key: 'player-umbrella-left-1',
      flip: false,
      animating: false,
    })
    const motions = [null, motion, { ...motion, progress: 0.49 }, { ...motion, progress: 0.5 }]
    for (const facing of facings) {
      for (const stride of [0, 1] as const) {
        for (const walk of motions) {
          for (const reduceMotion of [false, true]) {
            const moving: MoveState = { ...state, facing, motion: walk, stride }
            const withUmbrella = (phase: UmbrellaPosePhase, elapsed: number) =>
              playerPose(moving, reduceMotion, null, 0, phase, elapsed)
            const plain = playerPose(moving, reduceMotion)
            // 傘を差した左向きだけは右向きの反転ではなく原画の左向きのコマ
            const covered =
              facing === 'left'
                ? {
                    ...plain,
                    key: plain.key.replace(/^player-right-/, 'player-umbrella-left-'),
                    flip: false,
                  }
                : { ...plain, key: plain.key.replace(/^player-/, 'player-umbrella-') }
            const label = `${facing} ${stride} ${walk?.progress} ${reduceMotion}`
            expect(withUmbrella('open', 0), label).toEqual(covered)
            // 広げ終えた後は差したままと同じ
            expect(withUmbrella('opening', 880), label).toEqual(covered)
            // 畳み終えた後は傘の無い普段の歩行コマそのもの
            expect(withUmbrella('closing', 960), label).toEqual(plain)
          }
        }
      }
    }
  })
  it('umbrellaBusy は傘のコマが時間で替わる間(animating)とちょうど重なる', () => {
    // 移動を止める間と、止まって見せる出し入れのコマの間がずれると、歩きながら広げる絵が出る
    const since = 1000
    for (const phase of umbrellaPhases) {
      for (let tenths = 0; tenths <= 12000; tenths += 1) {
        const elapsed = tenths / 10
        const busy = umbrellaBusy({ phase, since }, since + elapsed, false)
        const pose = playerPose(state, false, null, 0, phase, elapsed)
        expect(busy, `${phase} ${elapsed}ms`).toBe(pose.animating)
      }
    }
  })
})

describe('umbrellaBusy', () => {
  const since = 1000
  it('広げる間は入った時刻から 880ms 未満、畳む間は 960ms 未満だけ最中とみなす', () => {
    expect(umbrellaBusy({ phase: 'opening', since }, since, false)).toBe(true)
    expect(umbrellaBusy({ phase: 'opening', since }, since + 879.9, false)).toBe(true)
    expect(umbrellaBusy({ phase: 'opening', since }, since + 880, false)).toBe(false)
    expect(umbrellaBusy({ phase: 'closing', since }, since, false)).toBe(true)
    expect(umbrellaBusy({ phase: 'closing', since }, since + 959.9, false)).toBe(true)
    expect(umbrellaBusy({ phase: 'closing', since }, since + 960, false)).toBe(false)
  })
  it('差したまま・傘なし・reduced motion では最中にならない', () => {
    expect(umbrellaBusy({ phase: 'open', since }, since, false)).toBe(false)
    expect(umbrellaBusy({ phase: 'open', since }, since + 5000, false)).toBe(false)
    expect(umbrellaBusy(null, since, false)).toBe(false)
    expect(umbrellaBusy({ phase: 'opening', since }, since, true)).toBe(false)
    expect(umbrellaBusy({ phase: 'closing', since }, since, true)).toBe(false)
  })
})
