// 画面の四隅に固定する導線。右下=一覧⇄マップ、右上=設定メニュー(言語・テーマ)。文言は content から受け取る
import Link from 'next/link'
import type { Locale, UiStrings } from '@content/types/content'
import { toHref } from '@/utils/locale-path'
import SettingsMenu from '@/components/ui/SettingsMenu'
import styles from './navigation.module.css'

type NavigationProps = {
  locale: Locale
  current: 'village' | 'list' | 'story'
  // 右下リンクの文言(current に応じて呼び出し側が toList / toVillage を渡す)
  switchLabel: string
  // 設定メニュー(言語・テーマ)の文言
  ui: UiStrings
  // 言語切替先で同じ内容を指すパス(locale 接頭辞なし)
  pathname: string
}

function Navigation({ locale, current, switchLabel, ui, pathname }: NavigationProps) {
  const switchHref = current === 'village' ? toHref('/list', locale) : toHref('/', locale)
  return (
    <>
      <SettingsMenu locale={locale} pathname={pathname} ui={ui} />
      <Link
        className={`${styles.switch}${current === 'village' ? ` ${styles.exit}` : ''}`}
        href={switchHref}
      >
        {switchLabel}
        {current === 'village' && <span aria-hidden='true'>→</span>}
      </Link>
    </>
  )
}

export default Navigation
