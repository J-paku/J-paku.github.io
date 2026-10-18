// 一覧の統合テスト(src/components/Directory の下の *.integration.test.tsx)へ渡すコンテナの props を、
// 入口(src/components/Directory/index.tsx)と同じ純粋関数(src/components/Directory/utils/directory-props.ts)で node 側で組む。
// content の読み出し(src/lib/content/read.ts)は node:fs を使うので、ブラウザでは読み込めない。
// vitest.integration.config.ts の globalSetup が __tests__ の下の container.fixture.ts としてこのファイルを拾い、node で走らせて
// provide し、テストは inject で受け取る
import type { ComponentProps } from 'react'
import type { TestProject } from 'vitest/node'
import type { Locale } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import type DirectoryContainer from '@/components/Directory/container'
import { directoryProps } from '@/components/Directory/utils/directory-props'

export type DirectoryData = ComponentProps<typeof DirectoryContainer>

export const directoryData = (locale: Locale): DirectoryData =>
  directoryProps(locale, readContent(locale), readVillageText(locale))

declare module 'vitest' {
  export interface ProvidedContext {
    // 言語に依らない検査は ja だけで回す(docs/decisions/0015-trim-e2e-overlap-and-ko.md)
    directoryJa: DirectoryData
    // 言語の接頭(/ko)を保つリンクの検査だけが使う
    directoryKo: DirectoryData
  }
}

// globalSetup の入口。テストより先に node で 1 回だけ走る
export function setup(project: TestProject): void {
  project.provide('directoryJa', directoryData('ja'))
  project.provide('directoryKo', directoryData('ko'))
}
