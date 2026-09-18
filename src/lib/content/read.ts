// content/{ja,ko} を明示 import で束ねるローダー。バンドラの glob に頼らず、
// 登録表と実ファイル一覧を build 時に突き合わせて登録漏れを落とす。
// サーバ(ビルド)専用 — クライアントへ持ち込むと server-only が import 時点で落とす
import 'server-only'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import type { Content, Locale, Work } from '@content/types/content'
import type { WorldSet, VillageText } from '@content/types/world'
import { sortWorks, validateContent } from './validate'
import { validateWorldSet, validateVillageText } from './validate-world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'
import { profile as profileJa } from '@content/ja/profile'
import { profile as profileKo } from '@content/ko/profile'
import { skills as skillsJa } from '@content/ja/skills'
import { skills as skillsKo } from '@content/ko/skills'
import { now as nowJa } from '@content/ja/now'
import { now as nowKo } from '@content/ko/now'
import { aiHarness as aiHarnessJa } from '@content/ja/works/ai-harness'
import { aiHarness as aiHarnessKo } from '@content/ko/works/ai-harness'
import { meishiCrossPlatform as meishiJa } from '@content/ja/works/meishi-cross-platform'
import { meishiCrossPlatform as meishiKo } from '@content/ko/works/meishi-cross-platform'
import { seatmapDemo as seatmapJa } from '@content/ja/works/seatmap-demo'
import { seatmapDemo as seatmapKo } from '@content/ko/works/seatmap-demo'

// 登録表。作品を増やすときはファイル追加 + ここへ2行(ja/ko)追加。漏れは validate が落とす
const WORKS: Record<Locale, Work[]> = {
  ja: [aiHarnessJa, meishiJa, seatmapJa],
  ko: [aiHarnessKo, meishiKo, seatmapKo],
}

const listWorkFiles = (): string[] =>
  readdirSync(path.join(process.cwd(), 'content', 'ja', 'works'))
    .filter(name => name.endsWith('.ts'))
    .map(name => name.replace(/\.ts$/, ''))

const CONTENT: Record<Locale, Content> = {
  ja: { ui: uiJa, profile: profileJa, skills: skillsJa, now: nowJa, works: sortWorks(WORKS.ja) },
  ko: { ui: uiKo, profile: profileKo, skills: skillsKo, now: nowKo, works: sortWorks(WORKS.ko) },
}

const issues = validateContent(CONTENT.ja, CONTENT.ko, listWorkFiles())
if (issues.length > 0) {
  throw new Error(`content の整合性検査に失敗:\n- ${issues.join('\n- ')}`)
}

export const readContent = (locale: Locale): Content => CONTENT[locale]

export const listStorySlugs = (locale: Locale): string[] =>
  CONTENT[locale].works
    .filter(w => w.status === 'published' && w.story !== undefined)
    .map(w => w.slug)

export const findStoryWork = (locale: Locale, slug: string): Work | null => {
  const found = CONTENT[locale].works.find(w => w.slug === slug)
  if (found === undefined || found.status !== 'published' || found.story === undefined) return null
  return found
}

const worldIssues = validateWorldSet(worldSet)
// 地点の文言が両言語に揃っているか、story リンクの slug が実在するかも build で落とす
const allSpotIds = Object.values(worldSet.worlds).flatMap(w => w.spots.map(s => s.id))
for (const locale of ['ja', 'ko'] as const) {
  const text = locale === 'ja' ? villageJa : villageKo
  worldIssues.push(...validateVillageText(worldSet, text, locale))
  for (const id of allSpotIds) {
    const link = text.stops[id]?.link
    if (link === undefined || link.target.kind !== 'story') continue
    if (findStoryWork(locale, link.target.slug) === null)
      worldIssues.push(`${locale}: 地点 "${id}" の slug "${link.target.slug}" に story が無い`)
  }
}
if (worldIssues.length > 0)
  throw new Error(`world の整合性検査に失敗:\n- ${worldIssues.join('\n- ')}`)

export const readWorldSet = (): WorldSet => worldSet
export const readVillageText = (locale: Locale): VillageText =>
  locale === 'ja' ? villageJa : villageKo
