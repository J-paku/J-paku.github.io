// 作品カードの組み立てのみを行う。
// 08段階でケーススタディ詳細を廃したため、タイトルは内部ルートではなく外部(live)へ繋ぐ。
// wip は不変ルール5どおりリンクを持たない — links 自体が空なので WorkLinks が何も描かない
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useReveal } from '@/hooks/use-reveal'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  // 一覧の配列インデックス(0始まり)。表示は 01 始まりの2桁ゼロ埋めに整える
  index: number
}

function WorkCard({ work, index }: WorkCardProps) {
  const { ui } = useContent()
  const { ref, isRevealed } = useReveal()

  const cardClassName = isRevealed ? `${styles.card} ${styles.cardRevealed}` : styles.card

  const tagClassName =
    work.contextKind === 'personal' ? `${styles.tag} ${styles.tagPersonal}` : styles.tag

  // 通し番号。接頭辞などの文言は付けない(表示文字列は content/ の外に置かない)
  const serial = String(index + 1).padStart(2, '0')

  return (
    <article ref={ref} className={cardClassName}>
      <div className={styles.meta}>
        <div className={styles.metaTop}>
          <div className={styles.head}>
            <span className={styles.serial}>{serial}</span>
            <span className={tagClassName}>{work.context}</span>
            {work.status === 'wip' ? (
              <span className={styles.wipBadge}>{ui.work.wipBadge}</span>
            ) : null}
          </div>
          <h3 className={styles.title}>{work.title}</h3>
          <p className={styles.tagline}>{work.tagline}</p>
        </div>
        <div className={styles.metaBottom}>
          <WorkStack stack={work.stack} />
          <WorkLinks live={work.links.live} repo={work.links.repo} />
        </div>
      </div>
      {/* グリフは背景装飾。要素として置くと支援技術から隠しても色コントラスト検査に掛かるため、
          data 属性で渡して CSS の疑似要素として描く */}
      <div className={styles.shot} data-glyph={work.glyph}>
        {work.thumbnail !== undefined ? (
          <img src={work.thumbnail} alt="" className={styles.thumbnail} />
        ) : (
          <span className={styles.shotPlaceholder}>{ui.work.shotPlaceholder}</span>
        )}
      </div>
    </article>
  )
}

export default WorkCard
