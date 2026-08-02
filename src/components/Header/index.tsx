// ヘッダーの組み立てのみを行う。状態・計算式は LocaleSwitcher・ThemeToggle 側に委譲する
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'
import { useScrollSpy } from '@/hooks/use-scroll-spy'
import { withLocale } from '@/utils/locale-path'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import CommandPalette from '@/components/CommandPalette'
import styles from './header.module.css'

const NAV_ITEMS = [
  { key: 'works', href: '#works' },
  { key: 'now', href: '#now' },
  { key: 'skills', href: '#skills' },
  { key: 'about', href: '#about' },
] as const

// useScrollSpy の監視対象id。NAV_ITEMS から一度だけ導出し、レンダーごとに再生成しない
const SECTION_IDS = NAV_ITEMS.map((item) => item.key)

function Header() {
  const { locale } = useLocale()
  const { ui } = useContent()
  const homePath = withLocale('/', locale)
  // Home以外のルート(WorkDetail・NotFound等)ではセクションが存在せず、フックは黙って null を返す
  const currentSectionId = useScrollSpy(SECTION_IDS)

  return (
    <header className={styles.header}>
      <Link to={homePath} className={styles.logo}>
        J-paku
      </Link>
      <nav aria-label={ui.nav.label} className={styles.nav}>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ key, href }) => (
            <li key={key}>
              <a
                href={href}
                className={styles.navLink}
                aria-current={currentSectionId === key ? 'true' : undefined}
              >
                {ui.nav[key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.controls}>
        <CommandPalette />
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}

export default Header
