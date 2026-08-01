// Now セクションの組み立てのみ行う。件数は now[] の長さにそのまま追従し、ハードコードしない
// セクション id / aria-labelledby は Home 組み立て担当(次ラウンド)が付与する
import { useContent } from '@/hooks/use-content'
import styles from './now-section.module.css'

function NowSection() {
  const { ui, now } = useContent()

  return (
    <section className={styles.now}>
      <h2 className={styles.heading}>{ui.nav.now}</h2>
      <dl className={styles.list}>
        {now.map((entry) => (
          <div key={`${entry.date}-${entry.body}`} className={styles.entry}>
            <dt className={styles.date}>{entry.date}</dt>
            <dd className={styles.body}>{entry.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default NowSection
