// 作品ストーリー。導入・まとめはサーバで描き、場面の操作はクライアント島に委ねる
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Locale, Work } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import { toHref } from '@/utils/locale-path'
import PhraseText from '@/components/ui/PhraseText'
import Navigation from '@/components/ui/Navigation'
import StoryBody from './components/StoryBody'
import TechChipPopover from './components/TechChipPopover'
import styles from './story.module.css'

type StoryProps = {
  locale: Locale
  work: Work
}

function Story({ locale, work }: StoryProps) {
  const { ui } = readContent(locale)
  const text = readVillageText(locale)
  // 呼び出し側がストーリー付きの作品だけを渡す。型では任意なので notFound() で絞る(空の 200 を返さない)
  if (work.story === undefined) notFound()
  const { story } = work

  return (
    <main id='main' className={styles.page}>
      <Link className={styles.back} href={toHref('/list', locale)} aria-label={ui.workStory.back}>
        <img src='/logo.svg' alt='' className={styles.logoLight} />
        <img src='/logo-dark.svg' alt='' className={styles.logoDark} />
      </Link>
      <header className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.introTitle}>
            <PhraseText text={story.intro.title} locale={locale} />
          </h1>
          <p className={styles.introLead}>
            <PhraseText text={story.intro.lead} locale={locale} />
          </p>
        </div>
      </header>
      <StoryBody scenes={story.scenes} ui={ui} locale={locale} />
      <section className={styles.outro}>
        <h2 className={styles.outroTitle}>
          <PhraseText text={story.outro.title} locale={locale} />
        </h2>
        <p className={styles.outroBody}>
          <PhraseText text={story.outro.body} locale={locale} />
        </p>
        <ul className={styles.stackSummary}>
          {story.outro.stackSummary.map(chip => (
            <li key={chip.name}>
              <TechChipPopover chip={chip} locale={locale} />
            </li>
          ))}
        </ul>
      </section>
      <Navigation
        locale={locale}
        current='story'
        switchLabel={text.toVillage}
        ui={ui}
        pathname={`/works/${work.slug}`}
      />
    </main>
  )
}

export default Story
