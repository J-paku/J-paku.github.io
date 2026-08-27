// 右列の作品ストリーム。並び順はローダーが確定済みのものをそのまま使い、ここで再ソートしない。
// 10段階でジグザグを廃したためカードは単純に縦へ積む。index は NO. 表示のためカードへ渡す。
// 言語・テーマは右上固定の SettingsMenu へ統合したため、ここには置かない
// 右列は作品一覧⇄担当業務詳細の差し替えで、表示切替は親が持つ。ここは hidden を受け取るだけ
// (タブ廃止により tabpanel の役割は失った)
import { useContent } from '@/hooks/use-content'
import WorkCard from '@/components/WorkCard'
import ScrollTopButton from '@/components/ScrollTopButton'
import PhraseText from '@/components/PhraseText'
import styles from './works-section.module.css'

type WorksSectionProps = {
  // 担当業務の詳細を表示中は true。アンマウントせず hidden で隠す
  isHidden: boolean
}

function WorksSection({ isHidden }: WorksSectionProps) {
  const { ui, works } = useContent()

  return (
    // タブ廃止により tabpanel/panel-works の参照先は消滅した。見出し自身に id を持たせ、
    // section は普通の索引セクションとして自分の見出しをラベルにする
    <section aria-labelledby='works-section-heading' hidden={isHidden} className={styles.works}>
      {/* ヘッダーバー(10段階)。索引文言のみ。下に全幅のヘアライン */}
      <header className={styles.header}>
        <h2 id='works-section-heading' className={styles.title}>
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

      {/* ページ先頭へ戻る浮きボタン(モバイル)。このセクションごと hidden になる構造なので、
          担当業務パネル表示中(戻るCTAが下部を使う間)は自動で消える — 追加の出し分けは持たない */}
      <ScrollTopButton />
    </section>
  )
}

export default WorksSection
