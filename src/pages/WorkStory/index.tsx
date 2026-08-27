// 作品ストーリーページの組み立てのみを行う。場面テキストは1列で縦に流し、各場面の画面プレビューは
// SceneModal(全画面モーダル)で見せる。work か work.story を持たない slug は NotFound を描く
// (不変ルール5: wip 作品は詳細ページを持たない)
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import { useContent } from '@/hooks/use-content'
import { withLocale } from '@/utils/locale-path'
import PhraseText from '@/components/PhraseText'
import ScrollTopButton from '@/components/ScrollTopButton'
import NotFound from '@/pages/NotFound'
import { useActiveScene } from './hooks/use-active-scene'
import IntroPreview from './components/IntroPreview'
import SceneModal from './components/SceneModal'
import SceneSection from './components/SceneSection'
import TechChipPopover from './components/TechChipPopover'
import styles from './work-story.module.css'

function WorkStory() {
  const { slug } = useParams<{ slug: string }>()
  const { locale } = useLocale()
  const { ui, works } = useContent()
  const work = works.find((item) => item.slug === slug)

  // どの場面のモーダルが開いているか。閉じたトリガーへのフォーカス復帰は、開いた瞬間の
  // トリガー要素をここに保存しておき、下の useEffect で使う(state化はしない — 再描画不要)
  const [openSceneIndex, setOpenSceneIndex] = useState<number | null>(null)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  // 下部固定CTAを開いたトリガー(=CTA自身)。フォーカス復帰は returnFocusRef 経由で共通化する
  const ctaTriggerRef = useRef<HTMLButtonElement>(null)
  // 下部固定CTAが開くべき場面(=今読んでいる場面)を追う。work が無い(NotFound)場合は場面数0で
  // フックだけ呼んでおく — Hooks は下の早期 return より前に置く必要があるため
  const { activeIndex, setSectionRef } = useActiveScene(work?.story?.scenes.length ?? 0)

  // トリガーへのフォーカス復帰は、openSceneIndex が null に変わった後(= SceneModal が
  // 実際にアンマウントされた commit 後)に行う。handleCloseScene 内で setState 直後に
  // 同期的に focus() すると、native dialog がまだ open のままでフォーカストラップに
  // 阻まれ body に落ちる(実測: X クローズ後 document.activeElement = BODY)
  useEffect(() => {
    if (openSceneIndex !== null) return
    returnFocusRef.current?.focus()
    returnFocusRef.current = null
  }, [openSceneIndex])

  if (work === undefined || work.story === undefined) return <NotFound />

  const { story } = work

  const handleOpenScene = (index: number, trigger: HTMLButtonElement | null) => {
    returnFocusRef.current = trigger
    setOpenSceneIndex(index)
  }

  const handleCloseScene = () => {
    setOpenSceneIndex(null)
  }

  // 下部固定CTAは常に「今読んでいる場面」(activeIndex)を開く
  const handleOpenCurrentScene = () => {
    handleOpenScene(activeIndex, ctaTriggerRef.current)
  }

  return (
    <div className={styles.page}>
      {/* 一覧への戻り導線。接続名はテキストが無くなった分 aria-label で明示する
          (ロゴ画像自体は alt='' で装飾扱いにする) */}
      <Link className={styles.back} to={withLocale('/', locale)} aria-label={ui.workStory.back}>
        <img src='/logo.svg' alt='' className={styles.logoLight} />
        <img src='/logo-dark.svg' alt='' className={styles.logoDark} />
      </Link>

      <header className={styles.intro}>
        <div className={styles.introText}>
          <h1 className={styles.introTitle}>
            <PhraseText text={story.intro.title} />
          </h1>
          <p className={styles.introLead}>
            <PhraseText text={story.intro.lead} />
          </p>
        </div>

        {story.scenes.length > 0 ? (
          <IntroPreview
            scenes={story.scenes}
            placeholder={ui.work.shotPlaceholder}
            viewSceneLabel={ui.workStory.viewScene}
            onOpenScene={handleOpenScene}
          />
        ) : null}
      </header>

      <div className={styles.narrative}>
        {story.scenes.map((scene, index) => (
          <div key={scene.id} className={styles.scene}>
            <SceneSection scene={scene} ref={setSectionRef(index)} />
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

      {/* 場面プレビューを開く下部固定CTA(Toss式)。押すと「今読んでいる場面」(activeIndex)を開く */}
      {story.scenes.length > 0 ? (
        <button
          ref={ctaTriggerRef}
          type='button'
          className={styles.viewSceneCta}
          onClick={handleOpenCurrentScene}
        >
          <PhraseText text={ui.workStory.viewScene} />
        </button>
      ) : null}

      {/* ページ先頭へ戻る浮きボタン(モバイル)。下部CTAと重ならないよう --cta-height ぶん持ち上げる */}
      <ScrollTopButton raisedForCta />

      {openSceneIndex !== null ? (
        <SceneModal
          scenes={story.scenes}
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
    </div>
  )
}

export default WorkStory
