// 作品ストーリーページの組み立てのみを行う。左に場面テキストのスクロール、右に iPhone 型の
// プレビューを sticky で固定する。work か work.story を持たない slug は NotFound を描く
// (不変ルール5: wip 作品は詳細ページを持たない)
import { Link, useParams } from 'react-router'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import { useContent } from '@/hooks/use-content'
import { withLocale } from '@/utils/locale-path'
import PhraseText from '@/components/PhraseText'
import NotFound from '@/pages/NotFound'
import { useActiveScene } from './hooks/use-active-scene'
import DeviceFrame from './components/DeviceFrame'
import ScenePlayer from './components/ScenePlayer'
import SceneSection from './components/SceneSection'
import TechChipPopover from './components/TechChipPopover'
import styles from './work-story.module.css'

function WorkStory() {
  const { slug } = useParams<{ slug: string }>()
  const { locale } = useLocale()
  const { ui, works } = useContent()
  const work = works.find((item) => item.slug === slug)
  const scenes = work?.story?.scenes ?? []

  // フックは早期returnより前で呼ぶ必要があるため、story が無い間は場面数0で束ねておく
  const { activeIndex, setSectionRef } = useActiveScene(scenes.length)

  if (work === undefined || work.story === undefined) return <NotFound />

  const { story } = work

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={withLocale('/', locale)}>
        <PhraseText text={ui.workStory.back} />
      </Link>

      <header className={styles.intro}>
        <h1 className={styles.introTitle}>
          <PhraseText text={story.intro.title} />
        </h1>
        <p className={styles.introLead}>
          <PhraseText text={story.intro.lead} />
        </p>
      </header>

      <div className={styles.body}>
        <div className={styles.narrative}>
          {story.scenes.map((scene, index) => (
            <div key={scene.id} className={styles.scene}>
              <SceneSection scene={scene} serial={String(index + 1).padStart(2, '0')} ref={setSectionRef(index)} />
            </div>
          ))}

          <section className={styles.outro}>
            <h2 className={styles.outroTitle}>
              <PhraseText text={story.outro.title} />
            </h2>
            <p className={styles.outroBody}>
              <PhraseText text={story.outro.body} />
            </p>
            <ul className={styles.stackSummary}>
              {story.outro.stackSummary.map((chip) => (
                <li key={chip.name}>
                  <TechChipPopover chip={chip} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.device}>
          <DeviceFrame>
            <ScenePlayer scenes={story.scenes} activeIndex={activeIndex} placeholder={ui.work.shotPlaceholder} />
          </DeviceFrame>
        </div>
      </div>
    </div>
  )
}

export default WorkStory
