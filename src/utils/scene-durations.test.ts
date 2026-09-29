// 場面アニメーションの周期表(SCENE_ANIMATION_DURATIONS_MS)の単体テスト。表は各SVGの
// animation-durationを手で写したものなので、配信する場面の絵と食い違っていないかを見る。
// 照らし合わせはリール(use-story-reel)と場面モーダル(use-scene-carousel)が使う「表 ?? 既定値」の形で行う
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCENE_ANIMATION_DURATION_MS,
  SCENE_ANIMATION_DURATIONS_MS,
} from './scene-durations'

// 場面の絵はpublic/works/<作品>/scene<番号>-<場面id>.svgに置く(scene-durations.tsの冒頭の対応表と同じ並び)。
// utilsのテストはlintの層境界でcontentを読めないため、場面idはこのファイル名から取る
const WORKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/works')
const SCENE_FILE = /(?:^|[/\\])scene\d+-([a-z0-9-]+)\.svg$/

// SVGが宣言するanimation-durationをmsで返す。宣言が無い静止画はundefined。
// 複数あるとどれが1周期か決められないので、その時は例外で知らせる
const readSvgCycleMs = (file: string): number | undefined => {
  const svg = readFileSync(path.join(WORKS_DIR, file), 'utf8')
  const found = [...svg.matchAll(/animation-duration:\s*(\d+(?:\.\d+)?)(ms|s)\b/g)]
  if (found.length === 0) return undefined
  if (found.length > 1) throw new Error(`${file}にanimation-durationが${found.length}個ある`)
  const [, value, unit] = found[0]
  return unit === 's' ? Number(value) * 1000 : Number(value)
}

// タプル: [場面id, 絵のファイル, SVGの周期(ms)]。周期を宣言する場面の絵だけ
const cycleCases: Array<[string, string, number]> = readdirSync(WORKS_DIR, {
  recursive: true,
  encoding: 'utf8',
}).flatMap((file): Array<[string, string, number]> => {
  const id = SCENE_FILE.exec(file)?.[1]
  if (id === undefined) return []
  const cycleMs = readSvgCycleMs(file)
  return cycleMs === undefined ? [] : [[id, file, cycleMs]]
})

describe('SCENE_ANIMATION_DURATIONS_MS', () => {
  it('周期を宣言する場面の絵が配信物にある', () => {
    expect(cycleCases.length).toBeGreaterThan(0)
  })

  it.each(cycleCases)('場面%sの周期は絵%sのanimation-durationと一致する', (id, _file, cycleMs) => {
    expect(SCENE_ANIMATION_DURATIONS_MS[id] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS).toBe(cycleMs)
  })

  // 絵の無い場面idの行は上の照らし合わせに一度も掛からず、SVGと食い違っても気付けない
  it('表の場面idはどれも場面の絵と照らし合わせられる', () => {
    const checkedIds = cycleCases.map(([id]) => id)
    for (const id of Object.keys(SCENE_ANIMATION_DURATIONS_MS)) expect(checkedIds).toContain(id)
  })
})
