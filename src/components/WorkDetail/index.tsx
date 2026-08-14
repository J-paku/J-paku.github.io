// 作品カードの折りたたみ式詳細。事例一覧(全作品共通)→ 図解3種(seatmap-demo専用)の順に並べるだけの組み立て役。
// work.detail を持たない作品ではカード側が開閉トリガー自体を出さない想定だが、念のためここでも null を返す。
// 図解本体(SVG)は各コンポーネントの担当。キャプションの出力だけこちらが持つ
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import PhraseText from '@/components/PhraseText'
import CaseList from './components/CaseList'
import SeatmapArchitectureDiagram from './components/SeatmapArchitectureDiagram'
import SeatmapDataflowDiagram from './components/SeatmapDataflowDiagram'
import SeatmapSequenceDiagram from './components/SeatmapSequenceDiagram'
import styles from './work-detail.module.css'

type WorkDetailProps = {
  work: Work
  detailId: string
}

function WorkDetail({ work, detailId }: WorkDetailProps) {
  const { ui } = useContent()

  if (work.detail === undefined) return null

  const { detail } = work

  return (
    <div id={detailId} className={styles.detail}>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <PhraseText text={ui.work.detailCases} />
        </h4>
        <CaseList cases={detail.cases} />
      </section>

      {work.slug === 'seatmap-demo' ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <PhraseText text={ui.work.detailDiagrams} />
          </h4>
          <div className={styles.diagrams}>
            <div className={styles.diagram}>
              <SeatmapArchitectureDiagram diagram={detail.diagrams.architecture} />
              <p className={styles.caption}>
                <PhraseText text={detail.diagrams.architecture.caption} />
              </p>
            </div>
            <div className={styles.diagram}>
              <SeatmapDataflowDiagram diagram={detail.diagrams.dataflow} />
              <p className={styles.caption}>
                <PhraseText text={detail.diagrams.dataflow.caption} />
              </p>
            </div>
            <div className={styles.diagram}>
              <SeatmapSequenceDiagram diagram={detail.diagrams.sequence} />
              <p className={styles.caption}>
                <PhraseText text={detail.diagrams.sequence.caption} />
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default WorkDetail
