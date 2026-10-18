// 画面の四隅に固定する導線。右下=マップへ戻る、右上=設定メニュー(言語・テーマ)。文言は content から受け取る。
// 村から一覧への出口は VillagePage の ExitLink が担うので、村では切替リンクを描かない
import Link from 'next/link'
import type { Locale, UiStrings } from '@content/types/content'
import { toHref } from '@/utils/locale-path'
import SettingsMenu from '@/components/ui/SettingsMenu'
import styles from './navigation.module.css'

type NavigationProps = {
  locale: Locale
  // 右下「マップで見る」の文言。村では渡さない(出口は ExitLink が担う)
  switchLabel?: string
  // 設定メニュー(言語・テーマ)の文言
  ui: UiStrings
  // 言語切替先で同じ内容を指すパス(locale 接頭辞なし)
  pathname: string
}

function Navigation({ locale, switchLabel, ui, pathname }: NavigationProps) {
  return (
    <>
      <SettingsMenu locale={locale} pathname={pathname} ui={ui} />
      {switchLabel !== undefined ? (
        <Link className={styles.switch} href={toHref('/', locale)}>
          {switchLabel}
        </Link>
      ) : null}
    </>
  )
}

export default Navigation
