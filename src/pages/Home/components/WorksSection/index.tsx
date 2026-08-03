// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 08段階で Featured / その他 の区別を廃した — モックアップは4枚を同一形式で並べる
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import styles from './works-section.module.css'

function WorksSection() {
  const { ui, works } = useContent()

  return (
    <section className={styles.works} aria-labelledby="works-heading">
      <h2 id="works-heading" className={styles.eyebrow}>
        {ui.nav.works}
      </h2>
      <ul className={styles.list}>
        {works.map((work) => (
          <li key={work.slug} className={styles.listItem}>
            <WorkCard work={work} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default WorksSection
