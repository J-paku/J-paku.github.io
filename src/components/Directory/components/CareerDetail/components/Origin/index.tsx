// 現場の手順(origin)の節を描く。見出し・導入・順序付きの流れ・注記で1節を作る
import type { CareerDetail as CareerDetailContent, Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import styles from '../../career-detail.module.css'

type OriginProps = {
  // 描く手順の節。持たない経歴は親が描かない
  origin: NonNullable<CareerDetailContent['origin']>
  locale: Locale
}

function Origin({ origin, locale }: OriginProps) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockHeading}>
        <PhraseText text={origin.heading} locale={locale} />
      </h3>
      {origin.lead !== undefined ? (
        <p className={styles.lead}>
          <PhraseText text={origin.lead} locale={locale} />
        </p>
      ) : null}
      {/* 現場の手順なので順序付きリスト。コマ間の › は装飾のためCSSの疑似要素が持つ */}
      <ol className={styles.flow}>
        {origin.flow.map((step, index) => (
          // 送り記号を枠の外に置くため、<li> は包むだけにしてコマ本体は中の span が持つ
          // 同じ語が再登場しうるので鍵に位置を含める。並びは入力が同じなら常に同じ
          <li key={`${index}:${step.label}`} className={styles.flowItem}>
            <span className={step.emphasis === true ? styles.flowChipStrong : styles.flowChip}>
              {step.emphasis === true ? (
                // 強調は濃さだけに頼らず strong でも示す
                <strong className={styles.flowStrongText}>
                  <PhraseText text={step.label} locale={locale} />
                </strong>
              ) : (
                <PhraseText text={step.label} locale={locale} />
              )}
            </span>
          </li>
        ))}
      </ol>
      {origin.note !== undefined ? (
        <p className={styles.note}>
          <PhraseText text={origin.note} locale={locale} />
        </p>
      ) : null}
    </section>
  )
}

export default Origin
