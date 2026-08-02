// 作品カードの組み立てのみを行う。Featured/その他 の見た目差分は CSS(featured 修飾子)に寄せ、
// コンポーネントを2つに割らない(割ると wip の分岐ルールを2箇所で守る必要が生まれる)
import { Link } from 'react-router'
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { withLocale } from '@/utils/locale-path'
import WorkMeta from '@/components/WorkMeta'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  featured?: boolean
}

function WorkCard({ work, featured = false }: WorkCardProps) {
  const { ui } = useContent()
  const { locale } = useLocale()

  const isPublished = work.status === 'published'
  const workPath = withLocale(`/works/${work.slug}`, locale)

  const cardClassName = featured ? `${styles.card} ${styles.featured}` : styles.card

  return (
    <article className={cardClassName}>
      {work.thumbnail !== undefined ? (
        <img src={work.thumbnail} alt="" className={styles.thumbnail} />
      ) : null}
      <div className={styles.body}>
        {/* wip はここに <a> を作らない。 status !== 'published' の間はプレーンテキストのまま */}
        <h3 className={styles.title}>
          {isPublished ? (
            <Link to={workPath} className={styles.titleLink}>
              {work.title}
            </Link>
          ) : (
            work.title
          )}
        </h3>
        {work.status === 'wip' ? <span className={styles.wipBadge}>{ui.work.wipBadge}</span> : null}
        <p className={styles.tagline}>{work.tagline}</p>
        <WorkMeta variant="card" period={work.period} role={work.role} scale={work.scale} />
        <WorkStack stack={work.stack} />
        <WorkLinks live={work.links.live} repo={work.links.repo} />
      </div>
    </article>
  )
}

export default WorkCard
