// ローダーと fixture が同じプロフィール・作品・文言を渡すための組み立てを確かめる。
import { describe, expect, it, vi } from 'vitest'
import { readContent, readVillageText } from '@/lib/content/read'
import { directoryProps } from './directory-props'

vi.mock('server-only', () => ({}))

describe('directoryProps', () => {
  it.each(['ja', 'ko'] as const)(
    '%s のプロフィール・作品・文言・村への導線の文言をデータだけで渡す',
    locale => {
      const content = readContent(locale)
      const text = readVillageText(locale)
      const props = directoryProps(locale, content, text)

      expect(props).toEqual({
        locale,
        profile: content.profile,
        works: content.works,
        ui: content.ui,
        toVillage: text.toVillage,
      })
      expect(JSON.parse(JSON.stringify(props))).toEqual(props)
    }
  )
})
