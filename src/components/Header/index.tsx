// ヘッダーの組み立てのみを行う。状態・計算式は LocaleSwitcher・ThemeToggle 側に委譲する
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import styles from './header.module.css'

const NAV_ITEMS = [
  { key: 'works', href: '#works' },
  { key: 'now', href: '#now' },
  { key: 'skills', href: '#skills' },
  { key: 'about', href: '#about' },
] as const

function Header() {
  const { locale } = useLocale()
  const { ui } = useContent()
  const homePath = locale === 'ko' ? '/ko' : '/'

  return (
    <header className={styles.header}>
      <Link to={homePath} className={styles.logo}>
        J-paku
      </Link>
      <nav aria-label={ui.nav.label} className={styles.nav}>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ key, href }) => (
            <li key={key}>
              <a href={href} className={styles.navLink}>
                {ui.nav[key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.controls}>
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}

export default Header
