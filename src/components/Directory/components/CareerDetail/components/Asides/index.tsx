// 余談(asides)の節を描く。見出しの下に題と本文の組を並べる
import type { CareerDetail as CareerDetailContent, Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import styles from '../../career-detail.module.css'

type AsidesProps = {
  // 描く余談の節。持たない経歴は親が描かない
  asides: NonNullable<CareerDetailContent['asides']>
  locale: Locale
}

function Asides({ asides, locale }: AsidesProps) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockHeading}>
        <PhraseText text={asides.heading} locale={locale} />
      </h3>
      <ul className={styles.asides}>
        {asides.items.map(aside => (
          <li key={aside.title} className={styles.aside}>
            <h4 className={styles.asideTitle}>
              <PhraseText text={aside.title} locale={locale} />
            </h4>
            <p className={styles.body}>
              <PhraseText text={aside.body} locale={locale} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Asides
