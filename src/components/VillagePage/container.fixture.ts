// 村の統合テスト(*.browser.test.tsx)へ渡す Village の props を、VillagePage(サーバ)と同じ関数で node 側で組む。
// content の読み出しは node:fs、シートを焼く png.ts は node:zlib、URL の指紋は node:crypto を使うので、ブラウザでは読み込めない。
// vitest.integration.config.ts の globalSetup が src の下の container.fixture.ts としてこのファイルを拾い、node で走らせて
// provide し、テストは inject で受け取る。
// 組み方は隣の index.tsx(src/components/VillagePage/index.tsx)の写し。あちらを変えたらここも合わせる
// (exit だけは要素なので渡せず、テストが listHref と text.toList から ExitLink を組む)
import type { ComponentProps } from 'react'
import type { TestProject } from 'vitest/node'
import type { Locale } from '@content/types/content'
import { readContent, readVillageText, readWorldSet } from '@/lib/content/read'
import { sheetOf } from '@/lib/pixel/sheet-file'
import { buildWeatherSprites } from '@/lib/pixel/sprites'
import { careerRoleLabels } from '@/utils/career-role-labels'
import { DAY_PHASES } from '@/utils/day-phase'
import { toHref } from '@/utils/locale-path'
import { sheetLayout, sheetUrl } from './utils/sprite-css'
import { resolveStopLinks } from './utils/stop-links'
import type Village from './components/Village'

export type VillageData = Omit<ComponentProps<typeof Village>, 'exit'>

export const villageData = (locale: Locale): VillageData => {
  const content = readContent(locale)
  const text = readVillageText(locale)
  const worldSet = readWorldSet()
  const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, locale)
  return {
    lang: locale,
    worldSet,
    text,
    sprites: sheetLayout(sheetOf('sprite', 'day')),
    playerSprites: sheetLayout(sheetOf('player', 'day')),
    weatherSprites: buildWeatherSprites(),
    phaseSheets: DAY_PHASES.map(phase => ({
      phase,
      urls: [sheetUrl('sprite', phase), sheetUrl('player', phase)],
    })),
    stopHrefs,
    stopExternal,
    listHref: toHref('/list', locale),
    catches: content.profile.careers.find(c => c.id === 'current')?.detail?.features?.items ?? [],
    roleLabels: careerRoleLabels(content.ui),
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    // 言語に依らない検査は ja だけで回す(docs/decisions/0015-trim-e2e-overlap-and-ko.md)
    villageJa: VillageData
  }
}

// globalSetup の入口。テストより先に node で 1 回だけ走る
export function setup(project: TestProject): void {
  project.provide('villageJa', villageData('ja'))
}
