// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// カードは .grid の直下に置く — 左右の交互配置を :nth-child(even) でカード側CSSが持つため、
// 間にラッパー要素(li など)を挟むと入れ替えが効かなくなる。index も同じ理由でカードへ渡す
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import ThemeToggle from '@/components/ThemeToggle'
import styles from './works-section.module.css'

function WorksSection() {
  const { ui, works } = useContent()

  return (
    <section className={styles.works} aria-labelledby="works-heading">
      {/* 原本の .section-header と同じ構成 — 見出しが左、テーマ切り替えが右の底揃え */}
      <header className={styles.header}>
        <h2 id="works-heading" className={styles.title}>
          {ui.nav.works}
        </h2>
        <ThemeToggle />
      </header>

      <div className={styles.grid}>
        {works.map((work, index) => (
          <WorkCard key={work.slug} work={work} index={index} />
        ))}
      </div>

      {/* 文言は content の「フッター専用」計測票(ui.quality.footer)だけを使う。ここで新しい文字列は作らない */}
      <footer className={styles.footer}>
        <p className={styles.footerLabel}>{ui.quality.footer.label}</p>
        <p className={styles.footerNote}>{ui.quality.footer.environment}</p>
        <p className={styles.footerNote}>{ui.quality.footer.limitation}</p>
      </footer>
    </section>
  )
}

export default WorksSection
