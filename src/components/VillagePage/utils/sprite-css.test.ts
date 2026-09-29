// スプライトシートの配信URL・段階ごとの背景規則・配置情報(sprite-css)のテスト
import { describe, expect, it } from 'vitest'
import type { Sheet } from '@/lib/pixel/art'
import { SHEET_KINDS, sheetFileName } from '@/lib/pixel/sheet-file'
import { DAY_PHASES } from '@/utils/day-phase'
import { sheetLayout, sheetUrl, spriteBackgroundCss } from './sprite-css'

// CSS Modulesが払い出す形に似せたクラス名。呼び出し側から受け取った名前をそのまま使うかを見る
const SCENE = { sprite: '_sprite_a1b2', player: '_player_c3d4', root: '_root_e5f6' }

const KIND_PHASE_PAIRS = SHEET_KINDS.flatMap(kind =>
  DAY_PHASES.map(phase => [kind, phase] as const)
)

// 規則を「セレクタ・URL」の組へ分ける。どの形にも当てはまらない文字は組に入らない
const RULE = /([^{}]+)\{background-image:url\('([^']+)'\)\}/g
const parseRules = (css: string): [string, string][] =>
  [...css.matchAll(RULE)].map(match => [match[1], match[2]])

describe('sheetUrl', () => {
  // verify-export.mjsは/sprites/[a-z0-9-]+\.pngで参照を拾う。この形から外れると配信物の検査をすり抜ける
  it.each(KIND_PHASE_PAIRS)('%s・%sは/sprites/<種類>-<段階>-<指紋>.png', (kind, phase) => {
    expect(sheetUrl(kind, phase)).toMatch(
      new RegExp(`^/sprites/${kind}-${phase}-[0-9a-f]{8}\\.png$`)
    )
  })

  // 焼き出し先(build-sprites.mjs)と同じ名前の正本を引く。別の綴りで組むと参照先が無くなる
  it('名前の正本sheetFileNameに/sprites/を前置しただけのURLになる', () => {
    for (const [kind, phase] of KIND_PHASE_PAIRS) {
      expect(sheetUrl(kind, phase)).toBe(`/sprites/${sheetFileName(kind, phase)}`)
    }
  })
})

describe('spriteBackgroundCss', () => {
  const css = spriteBackgroundCss(SCENE)
  const rules = parseRules(css)

  it('属性なしの既定の規則は昼のシートを指す', () => {
    expect(rules.slice(0, 2)).toEqual([
      [`.${SCENE.sprite}`, sheetUrl('sprite', 'day')],
      [`.${SCENE.player}`, sheetUrl('player', 'day')],
    ])
  })

  // 昼は既定の規則が受け持つので、data-phaseの規則は昼以外の段階だけ。DAY_PHASESの順に並ぶ
  it('昼以外の段階だけをdata-phaseの規則で上書きし、その段階のシートを指す', () => {
    const scope = (phase: string) => `.${SCENE.root}[data-phase='${phase}']`
    expect(rules.slice(2)).toEqual([
      [`${scope('dawn')} .${SCENE.sprite}`, sheetUrl('sprite', 'dawn')],
      [`${scope('dawn')} .${SCENE.player}`, sheetUrl('player', 'dawn')],
      [`${scope('dusk')} .${SCENE.sprite}`, sheetUrl('sprite', 'dusk')],
      [`${scope('dusk')} .${SCENE.player}`, sheetUrl('player', 'dusk')],
      [`${scope('night')} .${SCENE.sprite}`, sheetUrl('sprite', 'night')],
      [`${scope('night')} .${SCENE.player}`, sheetUrl('player', 'night')],
    ])
    expect(css).not.toContain(`[data-phase='day']`)
  })

  it('規則のほかに余計な文字を含まない', () => {
    const rebuilt = rules.map(([selector, url]) => `${selector}{background-image:url('${url}')}`)
    expect(rebuilt.join('')).toBe(css)
    expect(rules).toHaveLength(2 * DAY_PHASES.length)
  })
})

describe('sheetLayout', () => {
  // 画像本体(uri)をクライアントへ渡すとhydrationの払い出しにbase64が載る
  it('配置情報(index・count・tile・height)だけを写し、画像本体のuriは落とす', () => {
    const sheet: Sheet = {
      uri: 'data:image/png;base64,AAAA',
      index: { grass: 0, tree: 1 },
      count: 2,
      tile: 16,
      height: 32,
    }
    const layout = sheetLayout(sheet)
    expect(layout).toEqual({ index: { grass: 0, tree: 1 }, count: 2, tile: 16, height: 32 })
    expect(Object.keys(layout).sort()).toEqual(['count', 'height', 'index', 'tile'])
  })
})
