// 焼く前の絵そのものを検証する。寸法・使える色・継ぎ目の噛み合いなど、文字マトリクスだけで分かること
import { describe, expect, it } from 'vitest'
import { recolor, TILE, validateArt } from './art'
import type { PixelArt } from './art'
import {
  PLAYER_BODY_LEFT,
  PLAYER_BODY_TOP,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  PLAYER_HEIGHT,
} from './actors'
import { FISHING_LINES } from './fishing-art'
import { palette } from './palette'
import { LIGHT_KEYS, phasePalette } from './palette-phase'
import {
  buildPlayerSprites,
  buildSprites,
  FISHING_MOTIONS,
  PLAYER_ARTS,
  SPRITE_ARTS,
} from './sprites'
import { bodyOf, charsOf, stitch } from './sprites.fixture'
import { DAY_PHASES } from '@/utils/day-phase'
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
    // 枚数は実測値で釘付けにする。art.ts が count: keys.length と定義しているので、
    // Object.keys(SPRITE_ARTS).length と比べると両辺が同じ式になり、素材を落としても通ってしまう。
    // 増やすときはこの数を意図的に書き換える(sprites.test.ts の BASELINE と同じ持ち方)
    expect(sheet.count).toBe(63)
    expect(sheet.height).toBe(TILE)
  })

  it('目印の背景が透明である', () => {
    // 「どこかに . がある」では背景を塗り潰しても通る。外周 1 周が透明であることを押さえると、
    // 目印は草の上へ重ねて置くので周りの地面が透けていなければならない、という意図が残る
    const art = SPRITE_ARTS.marker
    const blank = '.'.repeat(TILE)

    expect(art[0], '上辺').toBe(blank)
    expect(art[TILE - 1], '下辺').toBe(blank)
    expect(art.map(row => row[0]).join(''), '左辺').toBe(blank)
    expect(art.map(row => row[TILE - 1]).join(''), '右辺').toBe(blank)
  })

  it('経歴碑 2×2 は 32×32 の 1 枚に戻り、下辺が輪郭で接地する', () => {
    const art = stitch(['monument-tl', 'monument-tr', 'monument-bl', 'monument-br'], 2)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe(`.${'x'.repeat(TILE * 2 - 2)}.`)
  })

  it('街灯 1×2 は柱がつながり、周りは草を見せるため透明である', () => {
    const top = SPRITE_ARTS['lamp-t']
    const bottom = SPRITE_ARTS['lamp-b']

    // 継ぎ目の 1 行が一致していれば、2 枚を縦に置いたとき柱がずれない。
    // 透明な行同士でも一致してしまうので、その行が柱であること(何か描いてあること)も押さえる
    expect(top[TILE - 1]).toMatch(/[^.]/)
    expect(bottom[0]).toBe(top[TILE - 1])
    expect(charsOf(top).has('.')).toBe(true)
    expect(charsOf(bottom).has('.')).toBe(true)
    // 灯りの文字を持つのは上半分だけ
    expect(charsOf(top).has('9')).toBe(true)
    expect(charsOf(bottom).has('9')).toBe(false)
    // 足元は輪郭で接地し、左右は草に溶ける
    expect(bottom[TILE - 1]).toBe(`....${'x'.repeat(8)}....`)
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
  it('主人公はすべて32×32の画布で、体の16×24は左右8列・上8行の余白の下辺中央にある', () => {
    // scene.module.cssの.player::beforeは、画布を2×2マス・体の箱から左右と上へ半マスずつはみ出す形で決め打ちしている。
    // 寸法を変えるならCSSも一緒に変えるので、式ではなく数で留める
    expect({
      width: PLAYER_FRAME_WIDTH,
      height: PLAYER_FRAME_HEIGHT,
      left: PLAYER_BODY_LEFT,
      top: PLAYER_BODY_TOP,
      body: PLAYER_HEIGHT,
    }).toEqual({ width: 32, height: 32, left: 8, top: 8, body: 24 })
    for (const art of Object.values(PLAYER_ARTS)) {
      expect(art).toHaveLength(PLAYER_FRAME_HEIGHT)
      for (const row of art) expect(row).toHaveLength(PLAYER_FRAME_WIDTH)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(PLAYER_ARTS)) {
      expect(validateArt(art, palette, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT), key).toEqual([])
    }
  })

  it('主人公のシートは32×32の画布を並べた別シートになる', () => {
    const sheet = buildPlayerSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    // 地形・建物と同じ理由で実測値を書く(コマ数を数える式を両辺に置くと何も守らない)。
    // 傘のコマ 18 枚(差して立つ・歩く 8、出す 5、しまう 5)を足して 35 から更新
    expect(sheet.count).toBe(53)
    expect({ tile: sheet.tile, height: sheet.height }).toEqual({ tile: 32, height: 32 })
  })

  it('傘の無いコマは画布の余白に何も描かず、体の箱の中だけに収まる', () => {
    // 余白へ描いてよいのは傘だけ。ここへ漏れると、画面では体の箱の外へ絵がはみ出して見える。
    // 体の箱の中身が変わっていないことはsprites.test.tsの基準画像が見ている
    const inBody = (x: number, y: number): boolean =>
      y >= PLAYER_BODY_TOP && x >= PLAYER_BODY_LEFT && x < PLAYER_BODY_LEFT + TILE
    const leaks = Object.entries(PLAYER_ARTS)
      .filter(([key]) => !key.startsWith('player-umbrella-'))
      .flatMap(([key, art]) =>
        art.flatMap((row, y) =>
          [...row].flatMap((ch, x) => (ch === '.' || inBody(x, y) ? [] : [`${key} ${x},${y}`]))
        )
      )

    expect(leaks).toEqual([])
  })

  it('静止コマは足元がマスの下辺(最終行)に着き、頭上 4 行は空である', () => {
    // 傘を差したコマ(player-umbrella-*)は開いた傘が頭上の行を使うので、この掟から名指しで外している
    for (const key of ['player-up-0', 'player-down-0', 'player-right-0'] as const) {
      const art = bodyOf(PLAYER_ARTS[key])
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
    // 竿のコマも左向きは scaleX(-1) で作るので、同じ掟が要る。釣りの動きのコマも含めて横向きは全部見る。
    // 反転の軸は体の箱の真ん中なので、見るのは体の箱の1〜14列(画布の9〜22列)の外が空いていること。
    // 傘の天蓋は体ではない(反転して前後が入れ替わってよい)ので、傘のコマは頭の天辺の行から下だけを見る
    const rights = Object.entries(PLAYER_ARTS).filter(([key]) => key.includes('-right'))
    // 静止・歩行の 2 枚、糸を垂らして待つ 1 枚、動きの場面の数だけ、傘を差した静止・歩行の 2 枚
    expect(rights).toHaveLength(2 + 1 + FISHING_MOTIONS.length + 2)
    const margin = '.'.repeat(PLAYER_BODY_LEFT + 1)
    for (const [key, art] of rights) {
      const from = key.startsWith('player-umbrella-') ? PLAYER_BODY_TOP + 4 : 0
      for (const row of art.slice(from)) {
        expect(row.slice(0, PLAYER_BODY_LEFT + 1), key).toBe(margin)
        expect(row.slice(PLAYER_BODY_LEFT + TILE - 1), key).toBe(margin)
      }
    }
  })

  it('主人公の背景が透明である', () => {
    // 「どこかに . がある」では背景を塗り潰しても通る。コマごとに画布の4隅を名指しで見る。
    // 竿も傘も画布の隅までは届かないので、4隅とも透明のはず
    const last = PLAYER_FRAME_HEIGHT - 1
    const right = PLAYER_FRAME_WIDTH - 1
    for (const [key, art] of Object.entries(PLAYER_ARTS)) {
      const corners = [art[0][0], art[0][right], art[last][0], art[last][right]].join('')
      expect(corners, key).toBe('....')
    }
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
    const LEGS = [PLAYER_FRAME_HEIGHT - 3, PLAYER_FRAME_HEIGHT - 2, PLAYER_FRAME_HEIGHT - 1]
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
  // 主人公のコマは画布に置いてあるので、体の箱の位置(PLAYER_BODY_*)だけ左上へずらして並べる。
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

  // 絵の透明でないドットを「x,y → 文字」で返す。flip は絵の幅(マスは16列、主人公は画布の32列)の中で左右を入れ替える
  const placeDots = (
    art: PixelArt,
    left: number,
    top: number,
    flip: boolean
  ): Map<string, string> => {
    const dots = new Map<string, string>()
    art.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        if (ch !== '.') dots.set(`${left + (flip ? row.length - 1 - x : x)},${top + y}`, ch)
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
    const player = placeDots(pose, -PLAYER_BODY_LEFT, -8 - PLAYER_BODY_TOP, facing === 'left')
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

describe('傘のコマ', () => {
  const umbrella = Object.entries(PLAYER_ARTS).filter(([key]) => key.startsWith('player-umbrella-'))
  const FACINGS = ['up', 'down', 'right'] as const
  type Facing = (typeof FACINGS)[number]
  const umbrellaOf = (facing: Facing, frame: number): PixelArt =>
    PLAYER_ARTS[`player-umbrella-${facing}-${frame}` as keyof typeof PLAYER_ARTS]
  const plainOf = (facing: Facing, frame: number): PixelArt =>
    PLAYER_ARTS[`player-${facing}-${frame}` as keyof typeof PLAYER_ARTS]
  // 差して立つ・歩くコマ。上下は静止と歩行2枚、横向きは静止と歩行。歩行コマは体と一緒に1行下がる
  const POSES = FACINGS.flatMap(facing =>
    (facing === 'right' ? [0, 1] : [0, 1, 2]).map(frame => ({
      facing,
      frame,
      dy: frame === 0 ? 0 : 1,
    }))
  )

  // 静止コマの頭は画布の12〜24行(体の0〜12行)。帽子の天辺から顎まで
  const HEAD_TOP = PLAYER_BODY_TOP + 4
  const HEAD_ROWS = 13
  // 天蓋に使ってよい文字は輪郭(x)と傘専用の5文字だけ
  const CANOPY_CHARS = new Set(['.', 'x', '[', ']', '=', '~', '^'])
  const WOOD = '^'
  // 柄を握る腕の型紙が塗ってよい範囲(静止コマの画布の座標)。握る手の側の肩から先だけ
  const ARM: Record<Facing, { x: [number, number]; y: [number, number] }> = {
    down: { x: [3, 11], y: [23, 28] },
    up: { x: [20, 28], y: [23, 28] },
    right: { x: [14, 18], y: [25, 29] },
  }

  // 天蓋の最下行(白い房の行)
  const canopyBottom = (art: PixelArt): number => art.findLastIndex(row => row.includes('~'))
  // 行の中で透明でない升の幅
  const spanOf = (row: string): number => {
    const first = row.search(/[^.]/)
    return first < 0 ? 0 : row.replace(/\.+$/, '').length - first
  }
  // 素のコマから新しく'V'(手の色)になった升。柄を握る拳
  const fistOf = (art: PixelArt, plain: PixelArt): string[] =>
    art.flatMap((row, y) =>
      [...row].flatMap((ch, x) => (ch === 'V' && plain[y][x] !== 'V' ? [`${x},${y}`] : []))
    )
  const near = (dot: string, diagonal: boolean): string[] => {
    const [x, y] = dot.split(',').map(Number)
    const steps = diagonal
      ? [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => [dx, dy]))
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
    return steps.filter(([dx, dy]) => dx !== 0 || dy !== 0).map(([dx, dy]) => `${x + dx},${y + dy}`)
  }
  // startから、cellsの中を辿って届く升(diagonalなら斜めもつながりに数える)
  const reach = (start: string[], cells: Set<string>, diagonal: boolean): Set<string> => {
    const reached = new Set(start)
    const queue = [...start]
    for (let dot = queue.pop(); dot !== undefined; dot = queue.pop()) {
      for (const next of near(dot, diagonal)) {
        if (!cells.has(next) || reached.has(next)) continue
        reached.add(next)
        queue.push(next)
      }
    }
    return reached
  }
  const woodOf = (art: PixelArt): Set<string> =>
    new Set(
      art.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === WOOD ? [`${x},${y}`] : [])))
    )

  it('開いた天蓋は頭の幅の1.5倍より広く、頭から1〜3行離して浮かせ、その間に柄が見える', () => {
    // 前の傘は頭と同じ幅の天蓋を帽子に貼り付けていて、兜に見えた。幅と間の行数を数で押さえる
    const shapes = FACINGS.map(facing => {
      const art = umbrellaOf(facing, 0)
      const bottom = canopyBottom(art)
      const head = plainOf(facing, 0).slice(HEAD_TOP, HEAD_TOP + HEAD_ROWS)
      const gapRows = art.slice(bottom + 1, HEAD_TOP)
      return {
        facing,
        wide:
          Math.max(...art.slice(0, bottom + 1).map(spanOf)) / Math.max(...head.map(spanOf)) >= 1.5,
        gap: gapRows.length,
        shaftInGap: gapRows.some(row => row.includes(WOOD)),
        // 頭の天辺の行は素のコマで最初に絵のある行
        headTop: plainOf(facing, 0).findIndex(row => /[^.]/.test(row)),
      }
    })

    expect(shapes).toEqual(
      FACINGS.map(facing => ({ facing, wide: true, gap: 2, shaftInGap: true, headTop: HEAD_TOP }))
    )
  })

  it('天蓋は石突き・紺の布・縁の白い房だけで描き、光と陰の面を持つ', () => {
    for (const facing of FACINGS) {
      const art = umbrellaOf(facing, 0)
      const bottom = canopyBottom(art)
      const canopy = art.slice(0, bottom + 1)
      expect(
        canopy.flatMap(row => [...row].filter(ch => !CANOPY_CHARS.has(ch))),
        facing
      ).toEqual([])
      // 最上行は石突きだけ
      expect(canopy[0], facing).toMatch(/^\.+\^\.+$/)
      // 房は縁の下の1行だけに下がり、布の上には散らばらない
      expect(
        art.flatMap((row, y) => (row.includes('~') ? [y] : [])),
        facing
      ).toEqual([bottom])
      // 明るい面(=)・地(=[)・陰(])がそろって初めて丸く見える。1色だけだと板に見える
      expect(
        ['=', '[', ']'].filter(ch => canopy.some(row => row.includes(ch))),
        facing
      ).toEqual(['=', '[', ']'])
    }
  })

  it('頭と顔のドットは素のコマと1つも違わない(柄も天蓋も腕も頭の上を通らない)', () => {
    // 柄を顔のまん中に通すと、傘ではなく顔に刺さった棒に見える。天蓋と柄は体の後ろへ回すので、
    // 素のコマで絵のある升はどれも元の文字のまま残る
    const covered = POSES.flatMap(({ facing, frame, dy }) => {
      const art = umbrellaOf(facing, frame)
      const plain = plainOf(facing, frame)
      return plain.slice(HEAD_TOP + dy, HEAD_TOP + dy + HEAD_ROWS).flatMap((row, i) =>
        [...row].flatMap((ch, x) => {
          const y = HEAD_TOP + dy + i
          return ch !== '.' && art[y][x] !== ch ? [`${facing}-${frame} ${x},${y}`] : []
        })
      )
    })

    expect(covered).toEqual([])
  })

  it('腕の型紙の外は素のコマのままで、握らない方の手は下ろした元の姿勢に残る', () => {
    // 体のドットを塗り替えてよいのは、柄を握る側の肩から先だけ。それ以外で素のコマと違うのは
    // 素のコマが透明だった升(天蓋・柄)だけで、そこも傘の文字しか置かない
    const outside = POSES.flatMap(({ facing, frame, dy }) => {
      const art = umbrellaOf(facing, frame)
      const plain = plainOf(facing, frame)
      const { x: xs, y: ys } = ARM[facing]
      const inArm = (x: number, y: number): boolean =>
        x >= xs[0] && x <= xs[1] && y >= ys[0] + dy && y <= ys[1] + dy
      return art.flatMap((row, y) =>
        [...row].flatMap((ch, x) => {
          if (ch === plain[y][x] || inArm(x, y)) return []
          if (plain[y][x] === '.' && CANOPY_CHARS.has(ch)) return []
          return [`${facing}-${frame} ${x},${y} ${plain[y][x]}→${ch}`]
        })
      )
    })

    expect(outside).toEqual([])
  })

  it('柄を握る拳は1つで、柄に触れている', () => {
    const grips = POSES.map(({ facing, frame }) => {
      const art = umbrellaOf(facing, frame)
      const fist = fistOf(art, plainOf(facing, frame))
      const wood = woodOf(art)
      return {
        pose: `${facing}-${frame}`,
        // 拳の升が1つのかたまり(上下左右でつながる)にまとまっている = 手は1つ
        oneHand: fist.length > 0 && reach([fist[0]], new Set(fist), false).size === fist.length,
        size: fist.length,
        // 拳の上下左右のどこかに柄(木の色)がある
        holds: fist.some(dot => near(dot, false).some(next => wood.has(next))),
      }
    })

    expect(grips).toEqual(
      POSES.map(({ facing, frame }) => ({
        pose: `${facing}-${frame}`,
        oneHand: true,
        size: 4,
        holds: true,
      }))
    )
  })

  it('正面と背面は、天蓋の縁の下から拳まで柄が途切れずにつながる', () => {
    // 頭の外を通す向きでは柄が端から端まで見える。歩いて体が1行下がっても拳から離れない
    const lines = POSES.filter(({ facing }) => facing !== 'right').map(({ facing, frame }) => {
      const art = umbrellaOf(facing, frame)
      const wood = woodOf(art)
      const start = [...wood].filter(dot => Number(dot.split(',')[1]) === canopyBottom(art) + 1)
      const reached = reach(start, wood, true)
      const fist = fistOf(art, plainOf(facing, frame))
      return {
        pose: `${facing}-${frame}`,
        start: start.length,
        toFist: [...reached].some(dot => near(dot, true).some(next => fist.includes(next))),
      }
    })

    expect(lines).toEqual(
      POSES.filter(({ facing }) => facing !== 'right').map(({ facing, frame }) => ({
        pose: `${facing}-${frame}`,
        start: 1,
        toFist: true,
      }))
    )
  })

  it('横向きの柄は頭の後ろを1本の縦の線で通り、帽子の上と拳のすぐ上に同じ列で見える', () => {
    // 胸の前の拳から真上へ上る柄は、顎から帽子までが頭の陰に入る。見える2か所が同じ列なら1本の柄に読める
    for (const frame of [0, 1]) {
      const art = umbrellaOf('right', frame)
      const fist = fistOf(art, plainOf('right', frame))
      const fistTop = Math.min(...fist.map(dot => Number(dot.split(',')[1])))
      const columnsAt = (y: number): number[] =>
        [...art[y]].flatMap((ch, x) => (ch === WOOD ? [x] : []))
      const aboveHead = columnsAt(canopyBottom(art) + 1)
      const aboveFist = columnsAt(fistTop - 1)

      expect(aboveHead, `right-${frame}`).toHaveLength(1)
      expect(aboveFist, `right-${frame}`).toEqual(aboveHead)
    }
  })

  it('歩く間は天蓋・柄・拳が体と一緒に1行下がるだけで、形は静止コマと同じ', () => {
    // 静止コマだけ描き直すと、歩いた途端に別の傘へ入れ替わったり拳が柄から離れたりする。
    // 最下行は脚を振るので除く。軸足を替えた歩行2は歩行1と最下行だけが違う
    for (const facing of FACINGS) {
      const walk = umbrellaOf(facing, 1)
      expect(walk[0], facing).toBe('.'.repeat(PLAYER_FRAME_WIDTH))
      expect(walk.slice(1, -1), facing).toEqual(umbrellaOf(facing, 0).slice(0, -2))
    }
    for (const facing of ['up', 'down'] as const) {
      expect(umbrellaOf(facing, 2).slice(0, -1), facing).toEqual(umbrellaOf(facing, 1).slice(0, -1))
    }
  })

  it('出す・しまう途中のコマも、差して立つコマと同じ拳で同じ柄を握り、開く順に天蓋が広がる', () => {
    // 柄を立ててから開き切るまで(しまう側は逆順)、拳と柄は差して立つコマと同じ所に留まる。
    // 天蓋の縁より下(10行目から)は差して立つコマと1升も違わない
    const BELOW_CANOPY = 10
    const sequences = [
      {
        keys: ['extend', 'half', 'raise'],
        prefix: 'player-umbrella-open-',
        stand: umbrellaOf('down', 0),
      },
      {
        keys: ['closed', 'half', 'lower'],
        prefix: 'player-umbrella-close-',
        stand: umbrellaOf('up', 0),
      },
    ]
    for (const { keys, prefix, stand } of sequences) {
      const frames = keys.map(key => PLAYER_ARTS[`${prefix}${key}` as keyof typeof PLAYER_ARTS])
      for (const [i, art] of frames.entries()) {
        expect(art.slice(BELOW_CANOPY), `${prefix}${keys[i]}`).toEqual(stand.slice(BELOW_CANOPY))
        expect(
          art.slice(0, BELOW_CANOPY).flatMap(row => [...row].filter(ch => !CANOPY_CHARS.has(ch))),
          `${prefix}${keys[i]}`
        ).toEqual([])
      }
      // 畳んだ傘 → 半開き → 開ききる手前 → 差して立つコマの順に、天蓋の幅が広がる
      const widths = [...frames, stand].map(art =>
        Math.max(...art.slice(0, BELOW_CANOPY).map(spanOf))
      )
      expect(widths, prefix).toEqual([...widths].sort((a, b) => a - b))
      expect(new Set(widths).size, prefix).toBe(widths.length)
    }
  })

  it('傘は予約した文字(灯り用・どの段階でも色を変えない文字)を使わない', () => {
    // 灯り用の文字なら夜に傘が光り、段階で色を変えない文字なら夜も昼の色のまま浮く。
    // 傘は服と同じく時間帯で沈む物なので、どちらも使えない。
    // 色を変えない文字の表(palette-phase.ts の FIXED_KEYS)は外へ出していないので、
    // 「昼以外のどの段階でも昼と同じ色のまま」という振る舞いで見分ける
    const phases = DAY_PHASES.filter(phase => phase !== 'day')
    const tinted = phases.map(phase => phasePalette(palette, phase))
    const isLight = (ch: string): boolean => LIGHT_KEYS.some(light => light === ch)
    const isFixed = (ch: string): boolean => tinted.every(colors => colors[ch] === palette[ch])
    const reserved = umbrella.flatMap(([key, art]) =>
      [...charsOf(art)]
        .filter(ch => ch !== '.' && (isLight(ch) || isFixed(ch)))
        .map(ch => `${key}: ${ch}`)
    )

    // 鍵の拾い漏れがあると、黙って少ないコマだけを見て通ってしまう
    expect(umbrella).toHaveLength(18)
    expect(reserved).toEqual([])
  })
})
