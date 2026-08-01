// ケーススタディの1節を描画するだけの部品。並び順の決定はしない(呼び出し側が CASE_SECTION_ORDER で確定済み)
// マークダウン解釈は行わない。body の各要素をそのまま1段落として描画する
import styles from './case-study-section.module.css'

type CaseStudySectionProps = {
  heading: string
  body: string[]
}

function CaseStudySection({ heading, body }: CaseStudySectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{heading}</h2>
      {body.map((paragraph, index) => (
        <p key={`${heading}-${index}`} className={styles.paragraph}>
          {paragraph}
        </p>
      ))}
    </section>
  )
}

export default CaseStudySection
