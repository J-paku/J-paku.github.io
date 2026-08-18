// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 10段階でジグザグを廃したためカードは単純に縦へ積む。index は NO. 表示のためカードへ渡す。
// 言語・テーマは右上固定の SettingsMenu へ統合したため、ここには置かない
// 11段階で右列はタブパネルの1枚になった。表示切替は親が持ち、ここは hidden を受け取るだけ
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import PhraseText from '@/components/PhraseText'
import styles from './works-section.module.css'

type WorksSectionProps = {
  // 担当業務の詳細を表示中は true。アンマウントせず hidden で隠す
  isHidden: boolean
}

function WorksSection({ isHidden }: WorksSectionProps) {
  const { ui, works } = useContent()

  return (
    // tabpanel の名前はタブ側の見出しが持つ。二重ラベルになるため索引見出しは紐づけない
    <section
      id='panel-works'
      role='tabpanel'
      aria-labelledby='tab-works'
      hidden={isHidden}
      className={styles.works}
    >
      {/* ヘッダーバー(10段階)。索引文言のみ。下に全幅のヘアライン */}
      <header className={styles.header}>
        <h2 className={styles.title}>
          <PhraseText text={ui.work.index} />
        </h2>
      </header>

      <div className={styles.grid}>
        {works.map((work, index) => (
          <WorkCard key={work.slug} work={work} index={index} />
        ))}
      </div>

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
