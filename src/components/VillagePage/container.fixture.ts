// 村のコンテナの props を、サーバローダーと同じ純粋関数で node 側で組む。
// 内容の読み出しとシート合成はブラウザではできないため、globalSetup から provide する。
// style・script の要素はサーバローダーだけが持ち、ここからはデータだけを渡す。
import type { ComponentProps } from 'react'
import type { TestProject } from 'vitest/node'
import type { Locale } from '@content/types/content'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import type VillagePageContainer from './container'
import { villageProps } from './utils/village-props'

export type VillageData = Omit<
  ComponentProps<typeof VillagePageContainer>,
  'spriteStyle' | 'phaseInit'
>

export const villageData = (locale: Locale): VillageData =>
  villageProps(
    locale,
    readContent(locale),
    readVillageText(locale),
    readWorldSet(),
    listStorySlugs(locale)
  )

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
