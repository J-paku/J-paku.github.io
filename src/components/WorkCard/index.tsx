// 作品カードの組み立てのみを行う。Featured/その他 の見た目差分は CSS(featured 修飾子)に寄せ、
// コンポーネントを2つに割らない(割ると wip の分岐ルールを2箇所で守る必要が生まれる)
import { Link } from 'react-router'
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { withLocale } from '@/utils/locale-path'
import TechTag from '@/components/TechTag'
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
  const hasMeta = work.period !== undefined || work.role !== undefined || work.scale !== undefined
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined

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
        {hasMeta ? (
          <dl className={styles.meta}>
            {work.period !== undefined ? (
              <div className={styles.metaItem}>
                <dt>{ui.work.period}</dt>
                <dd>{work.period}</dd>
              </div>
            ) : null}
            {work.role !== undefined ? (
              <div className={styles.metaItem}>
                <dt>{ui.work.role}</dt>
                <dd>{work.role}</dd>
              </div>
            ) : null}
            {work.scale !== undefined ? (
              <div className={styles.metaItem}>
                <dt>{ui.work.scale}</dt>
                <dd>{work.scale}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {work.stack.length > 0 ? (
          <ul className={styles.stack} aria-label={ui.work.stack}>
            {work.stack.map((tech) => (
              <li key={tech}>
                <TechTag label={tech} />
              </li>
            ))}
          </ul>
        ) : null}
        {hasLinks ? (
          <div className={styles.links}>
            {work.links.live !== undefined ? (
              <a href={work.links.live} rel="noreferrer" className={styles.link}>
                {ui.work.live}
              </a>
            ) : null}
            {work.links.repo !== undefined ? (
              <a href={work.links.repo} rel="noreferrer" className={styles.link}>
                {ui.work.repo}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default WorkCard
