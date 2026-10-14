// ローダーと fixture が同じ内容・リンク・シート配置を渡すための組み立てを確かめる。
import { describe, expect, it, vi } from 'vitest'
import type { Career, Content } from '@content/types/content'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import { sheetOf } from '@/lib/pixel/sheet-file'
import { buildWeatherSprites } from '@/lib/pixel/sprites'
import { DAY_PHASES } from '@/utils/day-phase'
import { toHref } from '@/utils/locale-path'
import { sheetLayout, sheetUrl } from './sprite-css'
import { resolveStopLinks } from './stop-links'
import { villageProps } from './village-props'

vi.mock('server-only', () => ({}))

describe('villageProps', () => {
  it.each(['ja', 'ko'] as const)(
    '%s の文言・リンク・4 時間帯のシートをデータだけで渡す',
    locale => {
      const content = readContent(locale)
      const text = readVillageText(locale)
      const worldSet = readWorldSet()
      const slugs = listStorySlugs(locale)
      const props = villageProps(locale, content, text, worldSet, slugs)
      const current = content.profile.careers.find(career => career.id === 'current')!

      expect(props).toEqual({
        lang: locale,
        name: content.profile.name,
        ui: content.ui,
        shortcuts: content.works
          .filter(work => work.status === 'published' && work.story !== undefined)
          .map(work => ({ href: toHref(`/works/${work.slug}`, locale), title: work.title })),
        worldSet,
        text,
        sprites: sheetLayout(sheetOf('sprite', 'day')),
        playerSprites: sheetLayout(sheetOf('player', 'day')),
        weatherSprites: buildWeatherSprites(),
        phaseSheets: DAY_PHASES.map(phase => ({
          phase,
          urls: [sheetUrl('sprite', phase), sheetUrl('player', phase)],
        })),
        ...resolveStopLinks(worldSet, text, locale),
        listHref: toHref('/list', locale),
        catches: current.detail!.features!.items,
        roleLabels: {
          design: content.ui.career.roleDesign,
          build: content.ui.career.roleBuild,
          release: content.ui.career.roleRelease,
        },
      })
      expect(JSON.parse(JSON.stringify(props))).toEqual(props)
    }
  )

  it('ショートカットは指定された作品だけを元の作品順で並べる', () => {
    const content = readContent('ja')
    const [first, second, third] = content.works
    const props = villageProps('ja', content, readVillageText('ja'), readWorldSet(), [
      third.slug,
      first.slug,
    ])
    expect(props.shortcuts).toEqual([
      { href: `/works/${first.slug}/`, title: first.title },
      { href: `/works/${third.slug}/`, title: third.title },
    ])
    expect(props.shortcuts).not.toContainEqual({
      href: `/works/${second.slug}/`,
      title: second.title,
    })
  })

  it('現職が先頭でなくても現職の機能だけを釣果にする', () => {
    const content = readContent('ja')
    const current = content.profile.careers.find(career => career.id === 'current')!
    const other = { ...current, id: 'past', detail: undefined }
    const variant: Content = {
      ...content,
      profile: { ...content.profile, careers: [other, current] },
    }
    const props = villageProps('ja', variant, readVillageText('ja'), readWorldSet(), [])
    expect(props.catches).toEqual(current.detail!.features!.items)
    expect(props.catches.length).toBeGreaterThan(0)
    expect(props.shortcuts).toEqual([])
  })

  it.each(['no-current', 'no-detail', 'no-features', 'empty-items'] as const)(
    '%s なら釣果は空にする',
    missing => {
      const content = readContent('ja')
      const current = content.profile.careers.find(career => career.id === 'current')!
      const careers: Record<typeof missing, Career[]> = {
        'no-current': [{ ...current, id: 'past' }],
        'no-detail': [{ ...current, detail: undefined }],
        'no-features': [{ ...current, detail: { ...current.detail!, features: undefined } }],
        'empty-items': [
          {
            ...current,
            detail: {
              ...current.detail!,
              features: { ...current.detail!.features!, items: [] },
            },
          },
        ],
      }
      const variant: Content = {
        ...content,
        profile: { ...content.profile, careers: careers[missing] },
      }
      expect(
        villageProps('ja', variant, readVillageText('ja'), readWorldSet(), []).catches
      ).toEqual([])
    }
  )
})
