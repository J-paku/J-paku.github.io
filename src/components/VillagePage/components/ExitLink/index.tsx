// 村から作品一覧への出口。PC・横持ちは右下に固定、縦持ちタッチは枠のすぐ下に横長で並ぶ(配置は CSS)。
// コースの全地点で話し終えると use-village-overlay が data-village-exit を頼りに焦点を移し、data-bounce で跳ねさせる
import Link from 'next/link'
import styles from './exit-link.module.css'

type ExitLinkProps = {
  href: string
  label: string
}

function ExitLink({ href, label }: ExitLinkProps) {
  return (
    <Link className={styles.exit} href={href} data-village-exit=''>
      {label}
      <span aria-hidden='true'>→</span>
    </Link>
  )
}

export default ExitLink
