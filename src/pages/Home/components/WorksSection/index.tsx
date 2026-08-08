// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 10段階でジグザグを廃したためカードは単純に縦へ積む。index は NO. 表示のためカードへ渡す。
// 言語切替は左列の底(位置・GitHub の下)にある — 縦レール案は試したうえで廃止した
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import ThemeToggle from '@/components/ThemeToggle'
import styles from './works-section.module.css'

function WorksSection() {
  const { ui, works } = useContent()

  return (
    <section className={styles.works} aria-labelledby="works-heading">
      {/* ヘッダーバー(10段階)。左 = 索引文言、右 = 言語+テーマ。下に全幅のヘアライン */}
      <header className={styles.header}>
        <h2 id="works-heading" className={styles.title}>
          {ui.work.index}
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

      {/* 奥付。著作権と、デザイン探索に Variant を使った旨をさりげなく1行で */}
      <div className={styles.colophon}>
        <p className={styles.colophonItem}>{ui.colophon.copyright}</p>
        <p className={styles.colophonItem}>{ui.colophon.credit}</p>
      </div>
    </section>
  )
}

export default WorksSection
