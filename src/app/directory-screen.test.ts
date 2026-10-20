// 一覧ページのサーバの入口(directory-screen)のテスト。描かずに、呼んで返る React 要素の型と props を見る。
// 画面のコンテナ(@/components/Directory)はここから実行時に import できない(scripts/check-layers.mjs の規則 3。
// import してよいのはローダーと、画面のフォルダの統合テスト・フィクスチャだけ)ので、要素の型は関数の名前で見る
import { describe, expect, it, vi } from 'vitest'
import { readContent, readVillageText } from '@/lib/content/read'
import { directoryProps } from '@/components/Directory/utils/directory-props'
import Directory from './directory-screen'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('Directory(一覧ページの入口)', () => {
  it.each(['ja', 'ko'] as const)(
    '%s の content を読み、一覧のコンテナへデータだけを渡す',
    locale => {
      const content = readContent(locale)
      const text = readVillageText(locale)
      const element = Directory({ locale })

      expect(element.type.name).toBe('DirectoryContainer')
      expect(element.props).toEqual(directoryProps(locale, content, text))
      // 渡すのはその言語の content そのもの(別の言語のものや写しではない)
      expect(element.props.profile).toBe(content.profile)
      expect(element.props.works).toBe(content.works)
      expect(element.props.toVillage).toBe(text.toVillage)
    }
  )
})
