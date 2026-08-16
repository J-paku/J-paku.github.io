// 作品ストーリーの1場面。外側の <section> は親(スクロール連動の目次等)が使う ref をそのまま受け取り、
// 登場演出(use-reveal)は内側の div にだけ掛ける — 外部 ref と useReveal 自身の ref が衝突しないようにする。
// 場面プレビューは全画面モーダル(SceneModal)側で見せるため、ここには開くだけのトリガーボタンを持つ
import { useId, useRef, type Ref } from 'react'
import type { WorkStoryScene } from '@/types/content'
import { useReveal } from '@/hooks/use-reveal'
import PhraseText from '@/components/PhraseText'
import TechChipPopover from '../TechChipPopover'
import styles from './scene-section.module.css'

type SceneSectionProps = {
  scene: WorkStoryScene
  index: number
  viewSceneLabel: string
  // モーダルを閉じた時にフォーカスを戻す先を渡すため、トリガー自身の要素も一緒に渡す
  onOpenScene: (index: number, trigger: HTMLButtonElement | null) => void
  ref?: Ref<HTMLElement>
}

function SceneSection({ scene, index, viewSceneLabel, onOpenScene, ref }: SceneSectionProps) {
  const headingId = useId()
  const { ref: revealRef, isRevealed } = useReveal<HTMLDivElement>()
  const triggerRef = useRef<HTMLButtonElement>(null)
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

        {/* 画面プレビューを開くトリガー。体裁は WorkCard の detailToggle(点線下線+accent)を踏襲する */}
        <button
          ref={triggerRef}
          type='button'
          className={styles.viewSceneToggle}
          onClick={() => onOpenScene(index, triggerRef.current)}
        >
          <span className={styles.viewSceneLabel}>
            <PhraseText text={viewSceneLabel} />
          </span>
        </button>

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
