// 設定メニューの統合テスト(src/components/ui/SettingsMenu の下の *.integration.test.tsx)へ渡す文言(ui)を、Navigation の呼び出し元と同じ readContent で node 側で読む。
// content の読み出し(@/lib/content/read)は node:fs を使うのでブラウザでは読み込めず、content の実データを components から
// 直接 import することも層の規則(eslint.config.mjs)が禁じている。
// vitest.integration.config.ts の globalSetup が __tests__ の下の container.fixture.ts としてこのファイルを拾い、node で走らせて
// provide し、テストは inject で受け取る
import type { TestProject } from 'vitest/node'
import type { Locale, UiStrings } from '@content/types/content'
import { readContent } from '@/lib/content/read'

declare module 'vitest' {
  export interface ProvidedContext {
    // 言語ごとの文言。言語リンクの検査は ja と ko の両方で描く
    settingsMenuUi: Record<Locale, UiStrings>
  }
}

// globalSetup の入口。テストより先に node で 1 回だけ走る
export function setup(project: TestProject): void {
  project.provide('settingsMenuUi', { ja: readContent('ja').ui, ko: readContent('ko').ui })
}
