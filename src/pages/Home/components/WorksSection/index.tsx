// Works セクションの組み立てのみ行う。Featured/その他 の分け方は works の並び順(ローダー確定)を
// そのまま使い、Home側で再ソートしない。差分は featured prop と CSS だけで表現する
// セクション id / aria-labelledby は Home 組み立て担当(次ラウンド)が付与する
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import styles from './works-section.module.css'

function WorksSection() {
  const { ui, works } = useContent()

  // ハードコードしたslug一覧は持たない。先頭2件をFeaturedとして切り出すだけ
  const featured = works.slice(0, 2)
  const rest = works.slice(2)

  return (
    <section className={styles.works}>
      <h2 className={styles.heading}>{ui.nav.works}</h2>
      {featured.length > 0 ? (
        <ul className={styles.featuredList}>
          {featured.map((work) => (
            <li key={work.slug}>
              <WorkCard work={work} featured />
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <ul className={styles.restList}>
          {rest.map((work) => (
            <li key={work.slug}>
              <WorkCard work={work} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default WorksSection
