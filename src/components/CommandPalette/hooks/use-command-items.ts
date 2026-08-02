// works・言語・テーマ・外部リンクから検索対象コマンド一覧を組み立てるフック。
// 実行(run)は各コマンドが個別に持ち、選択後の遷移・状態変更まで内包する。
// 言語切替はuseLocale().switchTo、テーマ切替はuseTheme().setThemeをそのまま呼び、
// パスの組み立てはwithLocaleに委譲する(同一概念の判定基準を増やさない)
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { useTheme } from '@/hooks/use-theme'
import { withLocale } from '@/utils/locale-path'
import type { Locale } from '@/types/content'
import type { ThemePreference } from '@/lib/preferences'
import type { CommandItem } from '../type'

const LOCALES: Locale[] = ['ja', 'ko']
const THEMES: ThemePreference[] = ['system', 'light', 'dark']

// onSelectは項目実行の直前に必ず呼ぶ(ダイアログを閉じてトリガーへフォーカスを戻す処理)。
// 呼び出し側でuseCallback化して参照を安定させること(不安定だとこのフックのuseMemoが
// 毎レンダー再計算され、検索結果の参照が壊れて activeIndex の自動リセットが誤発火する)
export function useCommandItems(onSelect: () => void): CommandItem[] {
  const { works, ui } = useContent()
  const { locale, switchTo } = useLocale()
  const { setTheme } = useTheme()
  const navigate = useNavigate()

  return useMemo<CommandItem[]>(() => {
    // wipは行き先が無いので一覧に入れない(不変ルール5)。作品項目・外部リンク項目の両方でこの1つの配列を使う
    const publishedWorks = works.filter((work) => work.status === 'published')

    const workItems: CommandItem[] = publishedWorks.map((work) => ({
      id: `work:${work.slug}`,
      group: 'works',
      label: work.title,
      keywords: [work.title, work.tagline, ...work.stack],
      run: () => {
        onSelect()
        navigate(withLocale(`/works/${work.slug}`, locale))
      },
    }))

    const localeItems: CommandItem[] = LOCALES.map((item) => ({
      id: `locale:${item}`,
      group: 'locale',
      label: ui.localeMenu[item],
      keywords: [ui.localeMenu[item]],
      run: () => {
        onSelect()
        navigate(switchTo(item))
      },
    }))

    const themeItems: CommandItem[] = THEMES.map((item) => ({
      id: `theme:${item}`,
      group: 'theme',
      label: ui.theme[item],
      keywords: [ui.theme[item]],
      run: () => {
        onSelect()
        setTheme(item)
      },
    }))

    const externalItems: CommandItem[] = publishedWorks.flatMap((work) => {
      const items: CommandItem[] = []
      if (work.links.live !== undefined) {
        const live = work.links.live
        items.push({
          id: `external:${work.slug}:live`,
          group: 'external',
          label: `${work.title} - ${ui.work.live}`,
          keywords: [work.title, ui.work.live],
          run: () => {
            onSelect()
            window.open(live, '_blank', 'noopener,noreferrer')
          },
        })
      }
      if (work.links.repo !== undefined) {
        const repo = work.links.repo
        items.push({
          id: `external:${work.slug}:repo`,
          group: 'external',
          label: `${work.title} - ${ui.work.repo}`,
          keywords: [work.title, ui.work.repo],
          run: () => {
            onSelect()
            window.open(repo, '_blank', 'noopener,noreferrer')
          },
        })
      }
      return items
    })

    return [...workItems, ...localeItems, ...themeItems, ...externalItems]
  }, [works, ui, locale, switchTo, setTheme, navigate, onSelect])
}
