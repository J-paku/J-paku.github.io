// 焼き上がったシートを検証する。4 段階ぶんの並び・枚数・色と、昼のバイト同一性(BASELINE)。
// 絵そのものは sprites-art.test.ts、夜の差し替えは sprites-night.test.ts、天気は sprites-weather.test.ts
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildSheet, TILE } from './art'
import { palette } from './palette'
import { phasePalette } from './palette-phase'
import {
  buildPlayerSprites,
  buildSprites,
  PLAYER_ARTS,
  SPRITE_ARTS,
  SPRITE_NIGHT_ARTS,
} from './sprites'
import { charsOf, litKeys, sampler } from './sprites.fixture'
import { DAY_PHASES } from '@/utils/day-phase'

describe('時刻ごとのシート', () => {
  // 経歴碑を木の額へ描き直した後の昼のシート。街灯 2 枚・焚き火・卓上時計は従来通り外して比べる。
  // 後から足した素材を外したままにするのは、基準を焼き直さずに「既存のマスが 1 バイトも動いていない」
  // ことだけを言い続けるため(足すたびに基準を書き換えると、この検査は何も守らなくなる)。
  // 釣りの小物(浮き・当たりの浮き・巻物)3 枚を足したので更新
  const BASELINE = { count: 56, length: 3542, sha256: 'd01b770a892c73ce' }

  // 主人公の昼のシートを焼いて取った実測値。主人公にも夜の双子ができたので、地形・建物と同じく
  // バイト同一性で留める。夜の差し替えが昼の絵へ漏れれば枚数・長さ・指紋のどれかが動く。
  // この指紋の先頭は配信ファイル名にも入る(sprites.ts の sheetFileName)ので、
  // ここが動くときは配る URL も変わる = 古い PNG を掴んだままの利用者が出ない。
  // 釣り竿を持つ 3 コマ(上・下・右)を足したので更新
  const PLAYER_BASELINE = { count: 11, length: 1538, sha256: '16c42e43a1810762' }

  it('昼のシートは消灯レンズと経歴碑を含む基準画像と一致する', () => {
    const arts = Object.fromEntries(
      Object.entries(SPRITE_ARTS).filter(
        ([key]) => key !== 'lamp-t' && key !== 'lamp-b' && key !== 'campfire' && key !== 'clock'
      )
    )
    const sheet = buildSheet(arts, phasePalette(palette, 'day'))

    expect(sheet.count).toBe(BASELINE.count)
    expect(sheet.uri).toHaveLength(BASELINE.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(BASELINE.sha256)
  })

  it('昼の主人公シートは 1 バイトも変わらない', () => {
    const sheet = buildPlayerSprites('day')

    expect(sheet.count).toBe(PLAYER_BASELINE.count)
    expect(sheet.uri).toHaveLength(PLAYER_BASELINE.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(
      PLAYER_BASELINE.sha256
    )
  })

  it('どの段階も同じ並び順・同じ枚数で焼ける', () => {
    const sheets = DAY_PHASES.map(phase => buildSprites(phase))
    const [first] = sheets

    for (const sheet of sheets) {
      expect(sheet.index).toEqual(first.index)
      expect(sheet.count).toBe(Object.keys(SPRITE_ARTS).length)
      expect(sheet.height).toBe(TILE)
    }
    for (const phase of DAY_PHASES) {
      expect(buildPlayerSprites(phase).index).toEqual(buildPlayerSprites('day').index)
    }
  })

  it('夜のシートは昼のシートと別物である', () => {
    expect(buildSprites('night').uri).not.toBe(buildSprites('day').uri)
    expect(buildPlayerSprites('night').uri).not.toBe(buildPlayerSprites('day').uri)
  })

  it('昼は今までの色、夜は発光色になる', () => {
    // '4' が窓のハイライト、'5' が地のガラス。取り違えると夜の窓が 1 段暗くなる
    const lights = [
      { label: '窓ガラスの明るい側', key: 'window', x: 6, y: 4, day: '#a0d0f8', night: '#fff0c0' },
      { label: '窓ガラス', key: 'window', x: 7, y: 4, day: '#78c0e8', night: '#f8d878' },
      { label: 'ロボットのレンズ', key: 'robot', x: 3, y: 8, day: '#6d90ba', night: '#78e0ff' },
      { label: '経歴碑の星', key: 'monument-tl', x: 12, y: 6, day: '#f8e060', night: '#fff0a0' },
      { label: '街灯のガラス', key: 'lamp-t', x: 5, y: 9, day: '#f8e060', night: '#fff0a0' },
      { label: 'モニターの画面', key: 'desk-tm', x: 9, y: 2, day: '#78c0e8', night: '#a8e8ff' },
      { label: 'モニターの光', key: 'desk-tm', x: 10, y: 2, day: '#f0e8d0', night: '#ffffff' },
    ]
    const day = sampler(buildSprites('day'))
    const night = sampler(buildSprites('night'))

    // 1 行ずつ expect すると最初の不一致で打ち切られ、後ろの行の誤りが隠れる。まとめて 1 回で比べる
    const actual = lights.map(light => ({
      label: light.label,
      day: day(light.key, light.x, light.y),
      night: night(light.key, light.x, light.y),
    }))

    expect(actual).toEqual(
      lights.map(light => ({ label: light.label, day: light.day, night: light.night }))
    )
  })

  it('目的地マーカーの赤はどの時刻でも沈まない', () => {
    // 'm' は marker だけが使う色。色調に混ぜると夜は暗い紫(#552533)になり、目印として読めない
    const actual = DAY_PHASES.map(phase => sampler(buildSprites(phase))('marker', 7, 5))

    expect(actual).toEqual(DAY_PHASES.map(() => '#e83828'))
  })

  it('灯り用の文字は予約された素材だけが使う', () => {
    // 地形や主人公がこの文字を持つと、夜に地面や服が光ってしまう。
    // 経歴碑は星が上半分にしかないため tl・tr だけ、机も画面が上段だけなので上 3 枚だけが該当する。
    // 卓上時計は液晶の数字だけが灯る
    expect(litKeys(SPRITE_ARTS)).toEqual([
      'campfire',
      'clock',
      'desk-tl',
      'desk-tm',
      'desk-tr',
      'lamp-t',
      'monument-tl',
      'monument-tr',
      'robot',
      'window',
    ])
    expect(litKeys(PLAYER_ARTS)).toEqual([])
  })
})

describe('焚き火', () => {
  it('どの段階のシートにも同じ索引で載る', () => {
    const at = Object.keys(SPRITE_ARTS).indexOf('campfire')

    expect(at).toBeGreaterThanOrEqual(0)
    expect(DAY_PHASES.map(phase => buildSprites(phase).index.campfire)).toEqual(
      DAY_PHASES.map(() => at)
    )
  })

  it('夜だけの差し替えを持たない(昼も燃えている絵 1 枚で足りる)', () => {
    expect(SPRITE_NIGHT_ARTS.campfire).toEqual(SPRITE_ARTS.campfire)
  })

  it('炎の身は夜に発光し、外側のふちだけが暗く沈む', () => {
    // (7,5) は炎の上半身、(7,8) は下半身。どちらも灯り用の文字('9')。
    // ここが黄(F)のままだと夜に #5a5b45 まで落ち、炎が「黄色い塊に暗い縁が付いたもの」に見える。
    // (5,8) は外側のふち('r')で、ここは夜に沈んだままでよい — 沈むから炎の輪郭になる
    const day = sampler(buildSprites('day'))
    const night = sampler(buildSprites('night'))

    expect({
      upper: { day: day('campfire', 7, 5), night: night('campfire', 7, 5) },
      lower: { day: day('campfire', 7, 8), night: night('campfire', 7, 8) },
      edge: { day: day('campfire', 5, 8), night: night('campfire', 5, 8) },
    }).toEqual({
      upper: { day: palette['9'], night: phasePalette(palette, 'night')['9'] },
      lower: { day: palette['9'], night: phasePalette(palette, 'night')['9'] },
      edge: { day: palette.r, night: phasePalette(palette, 'night').r },
    })
  })

  it('黄色いドットは 1 つ残らず灯り用の文字で描く', () => {
    // 昼は '9' と F が同じ色なので、F が 1 つ混じっていても昼の絵では気付けない。
    // 気付けるのは夜だけで、そこだけ暗い黄土のドットとして炎に穴が開く
    expect(charsOf(SPRITE_ARTS.campfire).has('F')).toBe(false)
    expect(charsOf(SPRITE_ARTS.campfire).has('9')).toBe(true)
  })

  it('炎を灯り用の文字へ移しても昼のタイルは 1 バイトも変わらない', () => {
    // 文字を入れ替える前(F のまま)に焼いて取った実測値。'9' の昼の色は F と同じ #f8e060 なので、
    // 色を替えたのではなく発光する文字へ移しただけなら昼のタイルはここへ一致する。
    // 動いたときは「昼の絵のほうを触った」ということなので、この値を書き換えて合わせない
    const CAMPFIRE_DAY = { length: 266, sha256: 'a0dffbdc7976d42c' }
    const sheet = buildSheet({ campfire: SPRITE_ARTS.campfire }, phasePalette(palette, 'day'))

    expect(sheet.uri).toHaveLength(CAMPFIRE_DAY.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(
      CAMPFIRE_DAY.sha256
    )
    // 指紋だけだと「なぜ一致していられるのか」が残らないので、昼の色が等しいことも直接言う
    expect(phasePalette(palette, 'day')['9']).toBe(phasePalette(palette, 'day').F)
  })
})
