// 作品ストーリーのうち状態を持つ部分だけを切り出したクライアント島。見出し・導入・まとめは親がサーバで描く
'use client'
import { useEffect, useRef, useState } from 'react'
import type { Locale, UiStrings, WorkStoryScene } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import { useActiveScene } from '../../hooks/use-active-scene'
import IntroPreview from '../IntroPreview'
import SceneModal from '../SceneModal'
import SceneSection from '../SceneSection'
import styles from '../../story.module.css'

type StoryBodyProps = {
  scenes: WorkStoryScene[]
  ui: UiStrings
  locale: Locale
}

function StoryBody({ scenes, ui, locale }: StoryBodyProps) {
  const [openSceneIndex, setOpenSceneIndex] = useState<number | null>(null)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  const ctaTriggerRef = useRef<HTMLButtonElement>(null)
  const { activeIndex, setSectionRef } = useActiveScene(scenes.length)

  useEffect(() => {
    if (openSceneIndex !== null) return
    returnFocusRef.current?.focus()
    returnFocusRef.current = null
  }, [openSceneIndex])

  const handleOpenScene = (index: number, trigger: HTMLButtonElement | null) => {
    returnFocusRef.current = trigger
    setOpenSceneIndex(index)
  }
  const handleCloseScene = () => setOpenSceneIndex(null)
  const handleOpenCurrentScene = () => handleOpenScene(activeIndex, ctaTriggerRef.current)

  return (
    <>
      {scenes.length > 0 ? (
        <IntroPreview
          scenes={scenes}
          placeholder={ui.work.shotPlaceholder}
          viewSceneLabel={ui.workStory.viewScene}
          onOpenScene={handleOpenScene}
        />
      ) : null}
      <div className={styles.narrative}>
        {scenes.map((scene, index) => (
          <div key={scene.id} className={styles.scene}>
            <SceneSection scene={scene} locale={locale} ref={setSectionRef(index)} />
          </div>
        ))}
      </div>
      {scenes.length > 0 ? (
        <button
          ref={ctaTriggerRef}
          type='button'
          className={styles.viewSceneCta}
          onClick={handleOpenCurrentScene}
        >
          <PhraseText text={ui.workStory.viewScene} locale={locale} />
        </button>
      ) : null}
      {openSceneIndex !== null ? (
        <SceneModal
          scenes={scenes}
          initialIndex={openSceneIndex}
          placeholder={ui.work.shotPlaceholder}
          closeLabel={ui.workStory.close}
          prevLabel={ui.workStory.prevScene}
          nextLabel={ui.workStory.nextScene}
          pauseLabel={ui.workStory.pauseScene}
          resumeLabel={ui.workStory.resumeScene}
          onClose={handleCloseScene}
        />
      ) : null}
    </>
  )
}

export default StoryBody
