// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 10段階でジグザグを廃したためカードは単純に縦へ積む。index は NO. 表示のためカードへ渡す。
// 言語・テーマは右上固定の SettingsMenu へ統合したため、ここには置かない
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import PhraseText from '@/components/PhraseText'
import styles from './works-section.module.css'

function WorksSection() {
  const { ui, works } = useContent()

  return (
    <section className={styles.works} aria-labelledby="works-heading">
      {/* ヘッダーバー(10段階)。索引文言のみ。下に全幅のヘアライン */}
      <header className={styles.header}>
        <h2 id="works-heading" className={styles.title}>
          <PhraseText text={ui.work.index} />
        </h2>
      </header>

      <div className={styles.grid}>
        {works.map((work, index) => (
          <WorkCard key={work.slug} work={work} index={index} />
        ))}
      </div>

      {/* 文言は content の「フッター専用」計測票(ui.quality.footer)だけを使う。ここで新しい文字列は作らない */}
      <footer className={styles.footer}>
        <p className={styles.footerLabel}>
          <PhraseText text={ui.quality.footer.label} />
        </p>
        <p className={styles.footerNote}>
          <PhraseText text={ui.quality.footer.environment} />
        </p>
        <p className={styles.footerNote}>
          <PhraseText text={ui.quality.footer.limitation} />
        </p>
      </footer>

      {/* 奥付。著作権と、デザイン探索に Variant を使った旨をさりげなく1行で */}
      <div className={styles.colophon}>
        <p className={styles.colophonItem}>
          <PhraseText text={ui.colophon.copyright} />
        </p>
        <p className={styles.colophonItem}>
          <PhraseText text={ui.colophon.credit} />
        </p>
      </div>
    </section>
  )
}

export default WorksSection
