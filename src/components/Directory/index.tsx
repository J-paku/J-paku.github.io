// 一覧ページの画面(コンテナ)。v1 の Home(左列プロフィール + 右列作品カード)を継承し、
// タブで隠していた担当業務の詳細は展開して HTML に含める。
// content の読み出しはサーバ専用なので入口(src/app/directory-screen.tsx)が行い、ここは受け取った直列化できるデータで組み立てるだけ。
// 画面のフックを持たないので 'use client' を付けない。サーバでも統合テストのブラウザでも同じ props で描け、
// クライアントへ送る JS も増えない(状態を持つのは下位の WorkCard・Navigation の島だけ)
import type { Locale, Profile, UiStrings, Work } from '@content/types/content'
import Navigation from '@/components/ui/Navigation'
import WorkCard from './components/WorkCard'
import PhraseText from '@/components/ui/PhraseText'
import ProfileColumn from './components/ProfileColumn'
import CareerDetail from './components/CareerDetail'
import styles from './directory.module.css'

type DirectoryContainerProps = {
  locale: Locale
  profile: Profile
  works: Work[]
  ui: UiStrings
  // 右下「マップで見る」の文言(村の文言の toVillage)
  toVillage: string
}

function DirectoryContainer({ locale, profile, works, ui, toVillage }: DirectoryContainerProps) {
  const detailed = profile.careers.filter(career => career.detail !== undefined)

  return (
    <main id='main' className={styles.layout}>
      <ProfileColumn profile={profile} ui={ui} locale={locale} />
      <div className={styles.panels}>
        {/* 作品一覧。経歴詳細からの戻り先アンカー(#works)でもある */}
        <section id='works' aria-labelledby='works-heading' className={styles.works}>
          {/* ヘッダーバー(v1 WorksSection から継承)。索引文言のみ */}
          <header className={styles.worksHeader}>
            <h2 id='works-heading' className={styles.worksTitle}>
              <PhraseText text={ui.work.index} locale={locale} />
            </h2>
          </header>
          <div className={styles.worksGrid}>
            {works.map((work, index) => (
              <WorkCard key={work.slug} work={work} index={index} locale={locale} ui={ui} />
            ))}
          </div>
        </section>
        {detailed.map(career => (
          <CareerDetail key={career.id} career={career} ui={ui} locale={locale} />
        ))}
      </div>
      <Navigation locale={locale} switchLabel={toVillage} ui={ui} pathname='/list' />
    </main>
  )
}

export default DirectoryContainer
