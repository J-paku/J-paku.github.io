// 作品カードの組み立てのみを行う。
// 08段階でケーススタディ詳細を廃したため、タイトルは内部ルートではなく外部(live)へ繋ぐ。
// wip は不変ルール5どおりリンクを持たない — links 自体が空なので WorkLinks が何も描かない
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
}

function WorkCard({ work }: WorkCardProps) {
  const { ui } = useContent()

  const tagClassName =
    work.contextKind === 'personal' ? `${styles.tag} ${styles.tagPersonal}` : styles.tag

  return (
    <article className={styles.card}>
      <div className={styles.shot}>
        {work.thumbnail !== undefined ? (
          <img src={work.thumbnail} alt="" className={styles.thumbnail} />
        ) : (
          <span className={styles.shotPlaceholder}>{ui.work.shotPlaceholder}</span>
        )}
      </div>
      <div className={styles.body}>
        <p className={tagClassName}>{work.context}</p>
        <h3 className={styles.title}>{work.title}</h3>
        {work.status === 'wip' ? <span className={styles.wipBadge}>{ui.work.wipBadge}</span> : null}
        <p className={styles.tagline}>{work.tagline}</p>
        <WorkStack stack={work.stack} />
        <WorkLinks live={work.links.live} repo={work.links.repo} />
      </div>
    </article>
  )
}

export default WorkCard
