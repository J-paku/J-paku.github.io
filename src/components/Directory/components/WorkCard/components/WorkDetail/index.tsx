// 作品カードの折りたたみ式詳細。work.detail.sections を順に並べるだけの組み立て役。
// work.detail を持たない作品ではカード側が開閉トリガーも詳細の行も出さない(カードが detail の有無で絞り、型がそれを守る)
import type { DetailedWork, Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import styles from './work-detail.module.css'

type WorkDetailProps = {
  work: DetailedWork
  detailId: string
  locale: Locale
}

function WorkDetail({ work, detailId, locale }: WorkDetailProps) {
  const { detail } = work

  return (
    <div id={detailId} className={styles.detail}>
      {detail.sections.map(section => (
        <section key={section.id} className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <PhraseText text={section.title} locale={locale} />
          </h4>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className={styles.paragraph}>
              <PhraseText text={paragraph} locale={locale} />
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

export default WorkDetail
