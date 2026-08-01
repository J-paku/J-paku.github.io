// About セクションの組み立てのみ行う。経歴・強みは profile の配列をそのまま map する
// セクション id / aria-labelledby は Home 組み立て担当(次ラウンド)が付与する
import { useContent } from '@/hooks/use-content'
import styles from './about-section.module.css'

function AboutSection() {
  const { ui, profile } = useContent()

  return (
    <section className={styles.about}>
      <h2 className={styles.heading}>{ui.nav.about}</h2>
      <ul className={styles.careerList}>
        {profile.careers.map((career) => (
          <li key={career.company} className={styles.careerItem}>
            <h3 className={styles.careerTitle}>{career.company}</h3>
            <dl className={styles.careerMeta}>
              <div className={styles.careerMetaItem}>
                <dt>{ui.work.period}</dt>
                <dd>{career.period}</dd>
              </div>
              <div className={styles.careerMetaItem}>
                <dt>{ui.work.role}</dt>
                <dd>{career.role}</dd>
              </div>
            </dl>
            <p className={styles.careerSummary}>{career.summary}</p>
            <ul className={styles.highlights}>
              {career.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <ul className={styles.strengthList}>
        {profile.strengths.map((strength) => (
          <li key={strength.title} className={styles.strengthItem}>
            <h3 className={styles.strengthTitle}>{strength.title}</h3>
            <p className={styles.strengthBody}>{strength.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default AboutSection
