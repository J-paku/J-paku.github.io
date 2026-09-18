// 派遣先1件分の担当内容を描く。節ラベル(ASSIGNMENT NN)+題字+事実表で1節を作る
import type { CareerDetailAssignment, Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import Facts from '../Facts'
import styles from '../../career-detail.module.css'

type AssignmentProps = {
  assignment: CareerDetailAssignment
  // 並び順(0始まり)。節番号はここから作る
  index: number
  locale: Locale
}

function Assignment({ assignment, index, locale }: AssignmentProps) {
  return (
    <section className={styles.assignmentBlock}>
      {/* 節番号はラテンのみの装飾なのでcontentには置かず、並び順から作る */}
      <p className={styles.assignmentEyebrow}>
        {`ASSIGNMENT ${String(index + 1).padStart(2, '0')}`}
      </p>
      <h3 className={styles.assignmentClient}>
        <PhraseText text={assignment.client} locale={locale} />
      </h3>
      <p className={styles.assignmentTitle}>
        <PhraseText text={assignment.title} locale={locale} />
      </p>
      <p className={styles.overviewMeta}>
        <PhraseText text={assignment.meta} locale={locale} />
      </p>
      {assignment.lead !== undefined ? (
        <p className={styles.lead}>
          <PhraseText text={assignment.lead} locale={locale} />
        </p>
      ) : null}
      {assignment.core !== undefined ? (
        <div className={styles.core}>
          <p className={styles.coreClaim}>
            <PhraseText text={assignment.core.claim} locale={locale} />
          </p>
          <p className={styles.body}>
            <PhraseText text={assignment.core.body} locale={locale} />
          </p>
        </div>
      ) : null}
      <Facts rows={assignment.facts} locale={locale} />
    </section>
  )
}

export default Assignment
