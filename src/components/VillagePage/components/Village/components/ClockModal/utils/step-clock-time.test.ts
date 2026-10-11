// 卓上時計の窓の向きの読み替え・針の回り込み・押し続けた時の繰り返し(step-clock-time)のテスト
import { describe, expect, it } from 'vitest'
import { moveForDirection, nextRepeatAt, shiftHour, shiftMinute } from './step-clock-time'

describe('moveForDirection', () => {
  // 4 つの向きを全部並べる。上・左と下・右のどちらかを取り違えると、どれかの行が落ちる
  it.each([
    ['up', -1],
    ['left', -1],
    ['down', 1],
    ['right', 1],
  ] as const)('1段目の%sは焦点を%iつ動かす', (direction, delta) => {
    expect(moveForDirection('choose', direction)).toEqual({ target: 'focus', delta })
  })

  // 2 段目は左右が時を 1 つ、上下が分を 10 分(上が進む)
  it.each([
    ['left', 'hour', -1],
    ['right', 'hour', 1],
    ['up', 'minute', 10],
    ['down', 'minute', -10],
  ] as const)('2段目の%sは%sを%i動かす', (direction, target, delta) => {
    expect(moveForDirection('pick', direction)).toEqual({ target, delta })
  })
})

describe('shiftHour', () => {
  // 端を越える 2 つ(23 → 0・0 → 23)と、越えない途中の 2 つを対で並べる
  it.each([
    [23, 1, 0],
    [0, -1, 23],
    [18, 1, 19],
    [5, -1, 4],
  ] as const)('%i時を%i動かすと%i時', (hour, delta, expected) => {
    expect(shiftHour(hour, delta)).toBe(expected)
  })
})

describe('shiftMinute', () => {
  it.each([
    [50, 10, 0],
    [0, -10, 50],
    [20, 10, 30],
    [30, -10, 20],
  ] as const)('%i分を%i動かすと%i分', (minute, delta, expected) => {
    expect(shiftMinute(minute, delta)).toBe(expected)
  })
})

describe('nextRepeatAt', () => {
  // 時刻は 0 より大きい値で測る。null と比べる式は null を 0 と読むので、0 では空の繰り返しと見分けられない
  const NOW = 1000

  describe('押した瞬間', () => {
    // 1 段目も 2 段目も、押した瞬間は 300ms 後に次を置く
    it.each(['choose', 'pick'] as const)('%sは繰り返しが空でも動かす', step => {
      expect(nextRepeatAt(step, true, NOW, null)).toBe(1300)
    })

    // 押し直しは繰り返しの待ちを待たない
    it('次の時刻より前でも動かす', () => {
      expect(nextRepeatAt('pick', true, NOW, NOW + 500)).toBe(1300)
    })
  })

  describe('押し続けている間', () => {
    // 段階を跨いだ直後(繰り返しが空)は押し直すまで動かさない
    it.each(['choose', 'pick'] as const)('%sは繰り返しが空なら動かさない', step => {
      expect(nextRepeatAt(step, false, NOW, null)).toBeNull()
    })

    // 次の時刻の直前・同じ時刻・直後の 3 点。同じ時刻で動くので、< と <= の取り違えが落ちる
    it('次の時刻の1ms前は動かさない', () => {
      expect(nextRepeatAt('pick', false, NOW, NOW + 1)).toBeNull()
    })

    it('次の時刻ちょうどに動かす', () => {
      expect(nextRepeatAt('pick', false, NOW, NOW)).toBe(1120)
    })

    it('次の時刻を1ms過ぎても動かす', () => {
      expect(nextRepeatAt('pick', false, NOW, NOW - 1)).toBe(1120)
    })

    // 1 段目は押した瞬間と同じ間隔、2 段目は押した瞬間より短い間隔で繰り返す
    it('1段目は300ms、2段目は120msごとに繰り返す', () => {
      expect(nextRepeatAt('choose', false, NOW, NOW)).toBe(1300)
      expect(nextRepeatAt('pick', false, NOW, NOW)).toBe(1120)
    })
  })
})
