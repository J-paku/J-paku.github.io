// 作品ストーリーの1場面。外側の <section> は親(スクロール連動のアクティブ場面追跡 use-active-scene)が
// 使う ref をそのまま受け取り、登場演出(use-reveal)は内側の div にだけ掛ける
// — 外部 ref と useReveal 自身の ref が衝突しないようにする。
// 場面プレビューを開く導線はページ下部の固定CTA(WorkStory側)に一本化したため、ここにはトリガーを持たない
import { useId, type Ref } from 'react'
import type { WorkStoryScene } from '@/types/content'
import { useReveal } from '@/hooks/use-reveal'
import PhraseText from '@/components/PhraseText'
import TechChipPopover from '../TechChipPopover'
import styles from './scene-section.module.css'

type SceneSectionProps = {
  scene: WorkStoryScene
  ref?: Ref<HTMLElement>
}

function SceneSection({ scene, ref }: SceneSectionProps) {
  const headingId = useId()
  const { ref: revealRef, isRevealed } = useReveal<HTMLDivElement>()
  const wrapperClassName = isRevealed ? `${styles.wrapper} ${styles.wrapperRevealed}` : styles.wrapper

  return (
    <section ref={ref} aria-labelledby={headingId} className={styles.section}>
      <div ref={revealRef} className={wrapperClassName}>
        <h2 id={headingId} className={styles.title}>
          <PhraseText text={scene.title} />
        </h2>
        <p className={styles.body}>
          <PhraseText text={scene.body} />
        </p>

        {scene.chips.length > 0 ? (
          <ul className={styles.chips}>
            {scene.chips.map((chip) => (
              <li key={chip.name}>
                <TechChipPopover chip={chip} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export default SceneSection
