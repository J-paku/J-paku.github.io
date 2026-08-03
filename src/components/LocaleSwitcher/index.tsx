// 言語切替。08段階で左列の .out(列の底)へ移したため、地球儀ボタンで開くドロップダウンをやめ、
// 2言語をそのまま並べる形にした。狭いヘッダー内に畳む必要が無くなり、開閉状態・矢印キー移動・
// 外側クリック検出・フォーカス復帰の全てが不要になっている。
// 表記は ui.localeMenu の自言語表記(日本語 / 한국어)のまま — モックアップの JA / KO へは寄せない。
// 読み手が自分の言語を字面で見つけられる方が確実なため
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'
import type { Locale } from '@/types/content'
import styles from './locale-switcher.module.css'

const LOCALES: Locale[] = ['ja', 'ko']

function LocaleSwitcher() {
  const { locale, switchTo } = useLocale()
  const { ui } = useContent()

  return (
    <nav aria-label={ui.localeMenu.label} className={styles.switcher}>
      {LOCALES.map((item) => (
        <Link
          key={item}
          to={switchTo(item)}
          className={styles.link}
          aria-current={item === locale ? 'true' : undefined}
        >
          {ui.localeMenu[item]}
        </Link>
      ))}
    </nav>
  )
}

export default LocaleSwitcher
