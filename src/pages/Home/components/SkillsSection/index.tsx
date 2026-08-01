// Skills セクションの組み立てのみ行う。Skillsは列挙ではなく根拠であるため、各項目のevidenceを
// 実在作品の状態(status)から判定してリンク or テキストに振り分ける。slug文字列そのものでは判定しない
import { Link } from 'react-router'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { withLocale } from '@/utils/locale-path'
import styles from './skills-section.module.css'

function SkillsSection() {
  const { ui, skills, works } = useContent()
  const { locale } = useLocale()

  return (
    <section className={styles.skills}>
      <h2 className={styles.heading}>{ui.nav.skills}</h2>
      <div className={styles.categoryGrid}>
        {skills.map((category) => (
          <div key={category.category} className={styles.category}>
            <h3 className={styles.categoryTitle}>{category.category}</h3>
            <ul className={styles.itemList}>
              {category.items.map((item) => (
                <li key={item.name} className={styles.item}>
                  <span className={styles.itemName}>{item.name}</span>
                  {/* evidence が空配列 = 公開作品での根拠なし。リンク領域自体を作らない */}
                  {item.evidence.length > 0 ? (
                    <ul className={styles.evidenceList}>
                      {item.evidence.map((slug) => {
                        const evidenceWork = works.find((work) => work.slug === slug)
                        // wip や未存在のslugはリンクにしない。判定はstatusで行い、slug名では判定しない
                        const isLinkable = evidenceWork?.status === 'published'
                        const label = evidenceWork !== undefined ? evidenceWork.title : slug

                        return (
                          <li key={slug} className={styles.evidenceItem}>
                            {isLinkable ? (
                              <Link
                                to={withLocale(`/works/${slug}`, locale)}
                                className={styles.evidenceLink}
                              >
                                {label}
                              </Link>
                            ) : (
                              <span className={styles.evidenceText}>{label}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  {item.note !== undefined ? <p className={styles.note}>{item.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SkillsSection
