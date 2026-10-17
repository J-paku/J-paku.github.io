// サーバで読み出したデータを受け取り、導入・場面・まとめ・導線を組み立てる
import Link from 'next/link'
import type { Locale, UiStrings, WorkStory } from '@content/types/content'
import { toHref } from '@/utils/locale-path'
import PhraseText from '@/components/ui/PhraseText'
import Navigation from '@/components/ui/Navigation'
import StoryBody from './components/StoryBody/container'
import TechChipPopover from './components/TechChipPopover'
import styles from './story.module.css'

type StoryContainerProps = {
  locale: Locale
  slug: string
  story: WorkStory
  ui: UiStrings
  switchLabel: string
}

function StoryContainer({ locale, slug, story, ui, switchLabel }: StoryContainerProps) {
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
      <Navigation locale={locale} switchLabel={switchLabel} ui={ui} pathname={`/works/${slug}`} />
    </main>
  )
}

export default StoryContainer
