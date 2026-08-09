// 仕様表(期間・役割・規模)。10段階でモックアップのスライダーを廃し、リポが既に持つ事実だけを表にする。
// 新しい事実・文言はここで作らない — 値は Work.period/role/scale、ラベルは ui.work.* をそのまま使う。
// wip 作品は3フィールドとも無いので、その場合は表そのものを描画しない(枠だけ残ると欠落に見える)
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import PhraseText from '@/components/PhraseText'
import styles from './work-spec.module.css'

type WorkSpecProps = {
  work: Work
}

function WorkSpec({ work }: WorkSpecProps) {
  const { ui } = useContent()

  const rows = [
    { key: 'period', label: ui.work.period, value: work.period },
    { key: 'role', label: ui.work.role, value: work.role },
    { key: 'scale', label: ui.work.scale, value: work.scale },
  ].filter((row): row is { key: string; label: string; value: string } => row.value !== undefined)

  if (rows.length === 0) return null

  return (
    <dl className={styles.spec}>
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
  )
}

export default WorkSpec
