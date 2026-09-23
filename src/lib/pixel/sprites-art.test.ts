// 焼く前の絵そのものを検証する。寸法・使える色・継ぎ目の噛み合いなど、文字マトリクスだけで分かること
import { describe, expect, it } from 'vitest'
import { recolor, TILE, validateArt } from './art'
import type { PixelArt } from './art'
import { PLAYER_HEIGHT } from './actors'
import { FISHING_LINES } from './fishing-art'
import { palette } from './palette'
import {
  buildPlayerSprites,
  buildSprites,
  FISHING_MOTIONS,
  PLAYER_ARTS,
  SPRITE_ARTS,
} from './sprites'
import { charsOf, stitch } from './sprites.fixture'
import type { Direction } from '@content/types/world'

describe('SPRITE_ARTS', () => {
  it('地形・建物はすべて十六行十六列である', () => {
    for (const art of Object.values(SPRITE_ARTS)) {
      expect(art).toHaveLength(16)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(SPRITE_ARTS)) {
      expect(validateArt(art, palette, TILE), key).toEqual([])
    }
  })

  it('全素材をデータURIのシートへ変換する', () => {
    const sheet = buildSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(SPRITE_ARTS).length)
    expect(sheet.height).toBe(TILE)
  })

  it('目印の背景が透明である', () => {
    expect(SPRITE_ARTS.marker.join('')).toContain('.')
  })

  it('経歴碑 2×2 は 32×32 の 1 枚に戻り、下辺が輪郭で接地する', () => {
    const art = stitch(['monument-tl', 'monument-tr', 'monument-bl', 'monument-br'], 2)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe(`.${'x'.repeat(TILE * 2 - 2)}.`)
  })

  it('街灯 1×2 は継ぎ目で柱がつながる', () => {
    const top = SPRITE_ARTS['lamp-t']
    const bottom = SPRITE_ARTS['lamp-b']

    // 継ぎ目の 1 行が一致していれば、2 枚を縦に置いたとき柱がずれない。
    // 透明な行同士でも一致してしまうので、その行が柱であること(何か描いてあること)も押さえる
    expect(top[TILE - 1]).toMatch(/[^.]/)
    expect(bottom[0]).toBe(top[TILE - 1])
    expect(charsOf(top).has('.')).toBe(true)
    // 灯りの文字を持つのは上半分だけ
    expect(charsOf(top).has('9')).toBe(true)
    expect(charsOf(bottom).has('9')).toBe(false)
  })

  it('街灯の下半分は短い根元で終わり、その下は歩いて通れるよう透明である', () => {
    const bottom = SPRITE_ARTS['lamp-b']
    // 絵があるのは上の数行だけ。下のマスは通り道になるので、根元から下は 1 ドットも置かない
    const last = bottom.findLastIndex(row => /[^.]/.test(row))

    expect(last).toBeLessThanOrEqual(5)
    // 根元は輪郭で閉じ、左右は草に溶ける
    expect(bottom[last]).toBe(`....${'x'.repeat(8)}....`)
    expect(bottom.slice(last + 1).join('')).toBe('.'.repeat((TILE - 1 - last) * TILE))
  })

  it('縦長の碑 1×2 は 16×32 の 1 枚に戻る', () => {
    const art = stitch(['stele-t', 'stele-b'], 1)

    expect(art).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe('x'.repeat(TILE))
  })

  it('机 3×2 は床の色を塗らず透明で抜く', () => {
    const art = stitch(['desk-tl', 'desk-tm', 'desk-tr', 'desk-bl', 'desk-bm', 'desk-br'], 3)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 3)
    // 'p' は部屋の床タイルの色。構造物側で塗ると床の模様が消える
    expect(charsOf(art).has('p')).toBe(false)
    expect(charsOf(art).has('.')).toBe(true)
  })

  it('屋根は赤 2 色と輪郭だけで描かれ、軒だけが木の色を持つ', () => {
    for (const key of ['roof-red-l', 'roof-red-m', 'roof-red-r'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toMatch(/^\.?Rrx$/)
    }
    for (const key of ['roof-red-l-low', 'roof-red-m-low', 'roof-red-r-low'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toBe('Rekrx')
    }
  })

  it('青い屋根は赤い屋根の色置換で作れる', () => {
    for (const side of ['l', 'm', 'r'] as const) {
      for (const suffix of ['', '-low'] as const) {
        const red = SPRITE_ARTS[`roof-red-${side}${suffix}`]
        const blue = SPRITE_ARTS[`roof-blue-${side}${suffix}`]
        expect(recolor(red, { r: 'u', R: 'U' }), `${side}${suffix}`).toEqual(blue)
      }
    }
  })

  it('壁・窓・扉は同じ位置に柱を持ち、横に並べても継ぎ目が揃う', () => {
    const post = SPRITE_ARTS['wall-m'].map(row => row.slice(0, 4))

    for (const key of ['wall-l', 'wall-r', 'window', 'door', 'entrance-l'] as const) {
      expect(
        SPRITE_ARTS[key].map(row => row.slice(0, 4)),
        key
      ).toEqual(post)
    }
  })
})

describe('PLAYER_ARTS', () => {
  it('主人公はすべて二十四行十六列である', () => {
    for (const art of Object.values(PLAYER_ARTS)) {
      expect(art).toHaveLength(PLAYER_HEIGHT)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(PLAYER_ARTS)) {
      expect(validateArt(art, palette, TILE, PLAYER_HEIGHT), key).toEqual([])
    }
  })

  it('主人公のシートは高さ 24 の別シートになる', () => {
    const sheet = buildPlayerSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(PLAYER_ARTS).length)
    expect(sheet.height).toBe(PLAYER_HEIGHT)
  })

  it('静止コマは足元がマスの下辺(最終行)に着き、頭上 4 行は空である', () => {
    for (const key of ['player-up-0', 'player-down-0', 'player-right-0'] as const) {
      const art = PLAYER_ARTS[key]
      expect(art.slice(0, 4).join('')).toBe('.'.repeat(64))
      expect(art[PLAYER_HEIGHT - 1]).toMatch(/x/)
    }
  })

  it('主人公の静止コマと歩行コマが異なる', () => {
    expect(PLAYER_ARTS['player-up-0']).not.toEqual(PLAYER_ARTS['player-up-1'])
    expect(PLAYER_ARTS['player-down-0']).not.toEqual(PLAYER_ARTS['player-down-1'])
    expect(PLAYER_ARTS['player-right-0']).not.toEqual(PLAYER_ARTS['player-right-1'])
  })

  it('軸足が変わっても頭部と胴のドットは変わらない', () => {
    for (const direction of ['up', 'down'] as const) {
      const first = PLAYER_ARTS[`player-${direction}-1`]
      const second = PLAYER_ARTS[`player-${direction}-2`]
      expect(first.slice(0, -1)).toEqual(second.slice(0, -1))
      expect(first.at(-1)).not.toEqual(second.at(-1))
    }
  })

  it('横向きは反転してもずれないよう 1〜14 列に収まる', () => {
    // 竿のコマも左向きは scaleX(-1) で作るので、同じ掟が要る。釣りの動きのコマも含めて横向きは全部見る
    const rights = Object.entries(PLAYER_ARTS).filter(([key]) => key.includes('-right'))
    // 静止・歩行の 2 枚、糸を垂らして待つ 1 枚、動きの場面の数だけ
    expect(rights).toHaveLength(2 + 1 + FISHING_MOTIONS.length)
    for (const [key, art] of rights) {
      for (const row of art) {
        expect(row[0], key).toBe('.')
        expect(row[15], key).toBe('.')
      }
    }
  })

  it('主人公の背景が透明である', () => {
    for (const art of Object.values(PLAYER_ARTS)) expect(art.join('')).toContain('.')
  })
})

describe('釣りの体の動き', () => {
  const FACINGS = ['up', 'down', 'right'] as const
  const STAND: Record<string, PixelArt> = Object.fromEntries(
    FACINGS.map(facing => [facing, PLAYER_ARTS[`player-${facing}-0`]])
  )
  // 糸を垂らして待つコマ。動きのコマはこれと比べる
  const HOLD: Record<string, PixelArt> = Object.fromEntries(
    FACINGS.map(facing => [facing, PLAYER_ARTS[`player-fish-${facing}`]])
  )
  // 釣りの鍵は player-fish-{向き} と player-fish-{向き}-{場面}
  const facingOf = (key: string): string => key.split('-')[2]
  const fishing = Object.entries(PLAYER_ARTS).filter(([key]) => key.startsWith('player-fish-'))
  const motions = fishing.filter(([key]) => key.split('-').length === 4)

  // 竿・糸・浮きの文字。静止コマの体には 1 つも使っていない(最初の検査で確かめる)ので、
  // これが載っている升を除けば、残りは体のドットになる
  const ROD = new Set(['e', 'E', 'S', 's', 'h', 'R'])

  it('3 向きぶんの待つコマと動きのコマがそろっている', () => {
    // 鍵の拾い漏れがあると、下の検査が黙って少ないコマだけを見て通ってしまう
    expect(fishing).toHaveLength(FACINGS.length * (1 + FISHING_MOTIONS.length))
    expect(motions).toHaveLength(FACINGS.length * FISHING_MOTIONS.length)
  })

  it('静止コマの体は竿の文字を使わない', () => {
    // ここが崩れると、竿として除いた升に体のドットが混じり、動いた足や動いていない体を見逃す
    for (const facing of FACINGS) {
      const rodChars = [...charsOf(STAND[facing])].filter(ch => ROD.has(ch))
      expect(rodChars, facing).toEqual([])
    }
  })

  it('どの釣りのコマも腰から下と足元の 3 行は静止コマのまま(竿が前を横切るだけ)', () => {
    // 釣りの間は主人公の位置をロジック側で動かさないので、足の接地点がそのまま村の座標になる。
    // 竿の升は静止コマの升として読み、それ以外の升が 1 つでも違えば腰や足が動いている
    const LEGS = [PLAYER_HEIGHT - 3, PLAYER_HEIGHT - 2, PLAYER_HEIGHT - 1]
    const legsOf = (art: PixelArt, stand: PixelArt): string[] =>
      LEGS.map(y => [...art[y]].map((ch, x) => (ROD.has(ch) ? stand[y][x] : ch)).join(''))

    expect(
      Object.fromEntries(fishing.map(([key, art]) => [key, legsOf(art, STAND[facingOf(key)])]))
    ).toEqual(
      Object.fromEntries(fishing.map(([key]) => [key, LEGS.map(y => STAND[facingOf(key)][y])]))
    )
  })

  it('投げ・当たり・釣り上げのコマは、待つコマから体そのものが動く', () => {
    // 竿の升はどちらのコマでも数えず、体のドットが待つコマから何升変わったかを数える。
    // 静止コマへ竿と手を描き替えただけのコマ(以前の投げの 2 場面)は 10 升に届かず、
    // 頭を 1 行動かすと輪郭と顔がまるごと入れ替わって 90 升を超える。その間を取って 40 升を下限にする
    const MIN_BODY_CHANGE = 40
    const changedIn = (row: string, before: string): number =>
      [...row].filter((ch, x) => !ROD.has(ch) && !ROD.has(before[x]) && ch !== before[x]).length
    const bodyChange = (art: PixelArt, hold: PixelArt): number =>
      art.reduce((sum, row, y) => sum + changedIn(row, hold[y]), 0)
    const changes = motions.map(([key, art]) => ({
      key,
      change: bodyChange(art, HOLD[facingOf(key)]),
    }))

    expect(changes.filter(({ change }) => change < MIN_BODY_CHANGE)).toEqual([])
  })
})

describe('釣り糸', () => {
  // 竿を構えたコマ・浮き・糸の 3 枚を、村と同じ置き方でドットの座標へ並べて確かめる。
  // 座標は主人公が立つマスの左上を (0, 0) とするドット。主人公の絵は頭が半マス(8 行)上へはみ出し、
  // 左向きは右向きの絵を scaleX(-1) で反転する(scene.module.css の .player と use-walk-loop.ts)。
  // 重なりは下から糸・浮き・主人公の順(FishingFloat は糸を浮きより先に同じ高さで置き、
  // 主人公はそれより上の高さ)なので、竿や体の下、浮きの下へ入った糸のドットは見えない。
  // 糸が見えている間、主人公は待つコマと当たりの 2 コマ(-tense・-bite)を行き来する。
  // 糸の絵は向きごとに 1 枚なので、3 コマとも同じ穂先でその糸につながっていなければならない
  const FRAMES = ['', '-tense', '-bite'] as const

  const FACED: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }

  // 浮きが沈む深さ(ドット)。当たりの合図(fishing-float.module.css の village-float-bite)は
  // 0.12 マス ≈ 1.92 ドット下げる。格子に乗らない深さなので切り上げた 2 ドットで見る —
  // 2 ドット沈めても離れなければ、それより浅い実際の沈みでも糸の端と浮きの糸は離れない。
  // 動くのは当たりの浮きだけだが、投げた浮きも同じ深さまで確かめる
  const SINKS = [0, 2] as const

  // 絵の透明でないドットを「x,y → 文字」で返す。flip は 16 列の中で左右を入れ替える
  const placeDots = (
    art: PixelArt,
    left: number,
    top: number,
    flip: boolean
  ): Map<string, string> => {
    const dots = new Map<string, string>()
    art.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        if (ch !== '.') dots.set(`${left + (flip ? TILE - 1 - x : x)},${top + y}`, ch)
      })
    })
    return dots
  }

  const xOf = (dot: string): number => Number(dot.split(',')[0])
  const yOf = (dot: string): number => Number(dot.split(',')[1])

  // 8 近傍(斜めも 1 本の線としてつながって見える)
  const neighbors = (dot: string): string[] => {
    const [x, y] = dot.split(',').map(Number)
    return [-1, 0, 1]
      .flatMap(dy => [-1, 0, 1].map(dx => `${x + dx},${y + dy}`))
      .filter(near => near !== dot)
  }

  const inspect = (
    facing: Direction,
    frame: (typeof FRAMES)[number],
    float: 'bobber' | 'bobber-bite',
    sink: number
  ) => {
    const pose = PLAYER_ARTS[`player-fish-${facing === 'left' ? 'right' : facing}${frame}`]
    const player = placeDots(pose, 0, -8, facing === 'left')
    const bobber = placeDots(
      SPRITE_ARTS[float],
      FACED[facing].x * TILE,
      FACED[facing].y * TILE + sink,
      false
    )
    const placement = FISHING_LINES[facing]
    const line = placeDots(
      SPRITE_ARTS[placement.key],
      placement.x * TILE,
      placement.y * TILE,
      placement.flip
    )
    const visibleLine = [...line.keys()].filter(dot => !player.has(dot) && !bobber.has(dot))
    // 穂先は竿(e)の先端。下向きは足元の水へ下ろすので一番下、それ以外は立てるので一番上
    const rod = [...player].filter(([, ch]) => ch === 'e').map(([dot]) => dot)
    const [tip] = rod.sort((a, b) => (facing === 'down' ? yOf(b) - yOf(a) : yOf(a) - yOf(b)))
    const floatLine = [...bobber].filter(([, ch]) => ch === 's').map(([dot]) => dot)
    const floatColumn = new Set(floatLine.map(xOf))
    // 穂先から、見えている糸と浮きの糸(s)だけを踏んでたどる
    const path = new Set([...visibleLine, ...floatLine])
    const reached = new Set([tip])
    const queue = [tip]
    for (let dot = queue.pop(); dot !== undefined; dot = queue.pop()) {
      for (const near of neighbors(dot)) {
        if (!path.has(near) || reached.has(near)) continue
        reached.add(near)
        queue.push(near)
      }
    }
    return {
      facing,
      frame,
      float,
      sink,
      // 見えている糸と浮きの糸が、穂先から途切れずに 1 本でつながる
      connected: [...path].every(dot => reached.has(dot)),
      // 浮きの玉や波紋(s 以外)の下へ潜ってよいのは浮きの糸の列だけ。そこは浮きが沈んだ瞬間に
      // 現れて糸の続きになる。ほかの列の潜り込みは玉を横切って引いた描き間違いで、
      // 止まっている間は玉に隠れて見えないので、ここで捕まえる
      underBody: [...line.keys()].filter(
        dot => (bobber.get(dot) ?? 's') !== 's' && !floatColumn.has(xOf(dot))
      ),
      // 2×2 が埋まっていない = 太さ 1 ドットのまま。糸の縦の部分が浮きの糸と 1 列ずれて
      // 並ぶと、つながってはいても 2 列の太い糸に見える(左向きを右の単純な鏡像に置いたときがこれ)
      thick: [...path].filter(dot => {
        const [x, y] = dot.split(',').map(Number)
        return [`${x + 1},${y}`, `${x},${y + 1}`, `${x + 1},${y + 1}`].every(near => path.has(near))
      }),
    }
  }

  it('4 向きとも、待つ・身構える・引き込まれるどのコマでも、投げた浮きにもかかった浮きにも、沈んだ瞬間にも穂先から途切れずにつながる', () => {
    const cases = (['up', 'down', 'left', 'right'] as const).flatMap(facing =>
      FRAMES.flatMap(frame =>
        (['bobber', 'bobber-bite'] as const).flatMap(float =>
          SINKS.map(sink => ({ facing, frame, float, sink }))
        )
      )
    )

    expect(
      cases.map(({ facing, frame, float, sink }) => inspect(facing, frame, float, sink))
    ).toEqual(
      cases.map(({ facing, frame, float, sink }) => ({
        facing,
        frame,
        float,
        sink,
        connected: true,
        underBody: [],
        thick: [],
      }))
    )
  })

  it('糸は浮きの糸と同じ 1 色だけで描く', () => {
    for (const key of ['fishing-line-up', 'fishing-line-down', 'fishing-line-right'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toBe('.s')
    }
  })
})
