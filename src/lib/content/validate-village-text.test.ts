// 地点の文言(validateVillageText)のテスト
import type { StopText, VillageText } from '@content/types/world'
import { validateVillageText } from './validate-world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { townSet, pairSet } from './validate-world.fixture'

// 検証するのは stops のキーだけなので、他の文言は持たせない
const villageText = (ids: string[]): VillageText =>
  ({
    stops: Object.fromEntries(ids.map(id => [id, {} as StopText])),
  }) as VillageText

describe('validateVillageText', () => {
  it('stops のキーが全ワールドの spots と一致すれば問題なし', () => {
    expect(validateVillageText(pairSet(), villageText(['home', 's1']), 'ja')).toEqual([])
  })
  it('地点の文言が無ければ locale 付きで報告する', () => {
    expect(validateVillageText(townSet(), villageText([]), 'ko')).toContain(
      'ko: 地点 "s1" の文言が無い'
    )
  })
  it('spots に無いキーが文言にあれば報告する', () => {
    expect(validateVillageText(townSet(), villageText(['s1', 'ghost']), 'ja')).toContain(
      'ja: 文言に未知の地点 "ghost" がある'
    )
  })
  it('実際の ja / ko の文言は全ワールドの地点を満たす', () => {
    expect(validateVillageText(worldSet, villageJa, 'ja')).toEqual([])
    expect(validateVillageText(worldSet, villageKo, 'ko')).toEqual([])
  })
})
