// 事例3行(課題/設計/理由)の一覧。件番号は WorkCard の NO. 表記の慣例(--f-mono・--accent)を踏襲する。
// cases が空なら枠だけ残るのを避け、WorkStack と同じく何も描画しない
import type { WorkCase } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import PhraseText from '@/components/PhraseText'
import styles from './case-list.module.css'

type CaseListProps = {
  cases: WorkCase[]
}

function CaseList({ cases }: CaseListProps) {
  const { ui } = useContent()

  if (cases.length === 0) return null

  return (
    <ol className={styles.list}>
      {cases.map((item, index) => {
        const serial = String(index + 1).padStart(2, '0')
        const rows = [
          { key: 'challenge', label: ui.work.caseChallenge, value: item.challenge },
          { key: 'decision', label: ui.work.caseDecision, value: item.decision },
          { key: 'reason', label: ui.work.caseReason, value: item.reason },
        ]

        return (
          <li key={serial} className={styles.case}>
            <span className={styles.serial}>{serial}</span>
            <dl className={styles.rows}>
              {rows.map((row) => (
                <div key={row.key} className={styles.row}>
                  <dt className={styles.label}>
                    <PhraseText text={row.label} />
                  </dt>
                  <dd className={styles.value}>
                    <PhraseText text={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        )
      })}
    </ol>
  )
}

export default CaseList
