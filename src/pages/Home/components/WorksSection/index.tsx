// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 10段階でジグザグを廃したためカードは単純に縦へ積む。index は NO. 表示のためカードへ渡す。
// LocaleSwitcher はここで描画する — 広い幅では自身のCSSが画面右端の縦レールとして固定し、
// 1024px以下ではヘッダーバー内へ静的に戻る(描画位置は1箇所のまま両対応させる)
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleSwitcher from '@/components/LocaleSwitcher'
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
        <div className={styles.headerTools}>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
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
