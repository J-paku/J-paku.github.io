// 一覧ページの本文(サーバ)。v1 の Home(左列プロフィール + 右列作品カード)を継承し、
// タブで隠していた担当業務の詳細は展開して HTML に含める
import type { Locale } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import Navigation from '@/components/ui/Navigation'
import WorkCard from './components/WorkCard'
import PhraseText from '@/components/ui/PhraseText'
import ProfileColumn from './components/ProfileColumn'
import CareerDetail from './components/CareerDetail'
import styles from './directory.module.css'

type DirectoryProps = { locale: Locale }

function Directory({ locale }: DirectoryProps) {
  const content = readContent(locale)
  const text = readVillageText(locale)
  const detailed = content.profile.careers.filter(career => career.detail !== undefined)

  return (
    <main id='main' className={styles.layout}>
      <ProfileColumn profile={content.profile} ui={content.ui} locale={locale} />
      <div className={styles.panels}>
        {/* 作品一覧。経歴詳細からの戻り先アンカー(#works)でもある */}
        <section id='works' aria-labelledby='works-heading' className={styles.works}>
          {/* ヘッダーバー(v1 WorksSection から継承)。索引文言のみ */}
          <header className={styles.worksHeader}>
            <h2 id='works-heading' className={styles.worksTitle}>
              <PhraseText text={content.ui.work.index} locale={locale} />
            </h2>
          </header>
          <div className={styles.worksGrid}>
            {content.works.map((work, index) => (
              <WorkCard key={work.slug} work={work} index={index} locale={locale} ui={content.ui} />
            ))}
          </div>
        </section>
        {detailed.map(career => (
          <CareerDetail key={career.id} career={career} ui={content.ui} locale={locale} />
        ))}
      </div>
      <Navigation locale={locale} switchLabel={text.toVillage} ui={content.ui} pathname='/list' />
    </main>
  )
}

export default Directory
