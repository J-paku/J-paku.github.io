// 事実表(ラベル列+値列)を描く。facts・技術スタックの各層・派遣先のfactsで共用する
import type { CareerFact, Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import styles from '../../career-detail.module.css'

type FactsProps = {
  // 表の行。labelが見出し列、valueが本文列
  rows: CareerFact[]
  locale: Locale
}

function Facts({ rows, locale }: FactsProps) {
  return (
    <dl className={styles.facts}>
      {rows.map(row => (
        <div key={row.label} className={styles.factRow}>
          <dt className={styles.factLabel}>
            <PhraseText text={row.label} locale={locale} />
          </dt>
          <dd className={styles.factValue}>
            <PhraseText text={row.value} locale={locale} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default Facts
