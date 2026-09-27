// 作品カードの画面キャプチャ枠。動画・リール・静止画の出し分け、モーション操作、リンクの覆いを描くだけの部品(状態は親が持つ)
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Locale, UiStrings, Work, WorkStoryScene } from '@content/types/content'
import ShotMedia from './components/ShotMedia'
import PlaybackPulse from '@/components/ui/PlaybackPulse'
import LinksOverlay from './components/LinksOverlay'
import { resolveOverlayKind } from './utils/overlay-kind'
import styles from './shot.module.css'

type ShotProps = {
  work: Work
  locale: Locale
  ui: UiStrings
  // 枠そのもの。親のuseLinksOverlayが外側クリックの判定にも使う
  shotRef: RefObject<HTMLDivElement | null>
  // カードのグリッドのどの行に置くかだけを親から受け取る(work-card.module.css の .shotSlot)
  slotClassName: string
  // 画面に丸ごと収まっているか。写真の色を戻す修飾子の出し分けに使う
  isFullyVisible: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  showVideo: boolean
  // 動画の src を付けてよいか。カードが画面に入った(リビールした)後だけ true
  shouldLoadVideo: boolean
  showReel: boolean
  storyScenes: WorkStoryScene[] | undefined
  activeReelIndex: number
  isMotionPaused: boolean
  pulseKey: number
  hasMotion: boolean
  isFinePointer: boolean
  handleToggleMotion: () => void
  isLinksOpen: boolean
  setIsLinksOpen: Dispatch<SetStateAction<boolean>>
}

function Shot(props: ShotProps) {
  const { work, locale, ui, shotRef, slotClassName, isFullyVisible } = props
  const { videoRef, showVideo, shouldLoadVideo, showReel, storyScenes, activeReelIndex } = props
  const { isMotionPaused, pulseKey, hasMotion, isFinePointer, handleToggleMotion } = props
  const { isLinksOpen, setIsLinksOpen } = props

  // リンクの覆いの種別(詳細はutils/overlay-kind.ts)
  const { hasLinks, hasStoryOverlay, hasOverlay } = resolveOverlayKind(work)

  // 修飾子は枠自身の状態なのでここで組む。.shotInView は画面に丸ごと収まっている間だけ写真の色を
  // 戻す印。.shotHasVideo はモーション(動画・リール)を持つカードの識別用で、覆いの背景の
  // pointer-events 分岐だけに効く — 持たないカードのCSSは1px も変わらない
  let shotClassName = isFullyVisible ? `${styles.shot} ${styles.shotInView}` : styles.shot
  if (hasMotion) shotClassName += ` ${styles.shotHasVideo}`

  // グリフは背景装飾。要素として置くと支援技術から隠しても色コントラスト検査に掛かるため、
  // data 属性で渡して CSS の疑似要素として描く
  return (
    <div ref={shotRef} className={`${slotClassName} ${shotClassName}`} data-glyph={work.glyph}>
      <ShotMedia
        work={work}
        ui={ui}
        styles={styles}
        videoRef={videoRef}
        showVideo={showVideo}
        shouldLoadVideo={shouldLoadVideo}
        showReel={showReel}
        storyScenes={storyScenes}
        activeReelIndex={activeReelIndex}
        isMotionPaused={isMotionPaused}
      />
      {hasMotion && isFinePointer ? (
        /* デスクトップ: shot 全面が透明なトグルボタンになる(SceneModal の sceneToggle と同じ
           「画面そのものを押させる」設計 — 角の小さなボタンより誤操作が少ない)。見た目は持たず、
           状態合図は下の中央パルス/停止印が担う。.shotOverlay より前に置いて覆いの下に沈める —
           覆いの背景は動画カードだけホバー中も pointer-events: none にしてあるため(CSS側の
           .shotHasVideo 分岐)、覆いの空きスペースのクリックはここまで落ちてくる */
        <button
          type='button'
          className={styles.videoToggleFull}
          aria-label={isMotionPaused ? ui.work.resumeMotion : ui.work.pauseMotion}
          onClick={handleToggleMotion}
        />
      ) : null}
      {hasMotion ? (
        /* 中央のパルス合図(ユーチューブ式)と停止中の常時表示の印。SceneModal と同じ部品。
           包む要素を持たないので、.shotOverlay との重なりは従来どおり DOM 順のまま */
        <PlaybackPulse variant='card' paused={isMotionPaused} pulseKey={pulseKey} />
      ) : null}
      <LinksOverlay
        work={work}
        locale={locale}
        ui={ui}
        styles={styles}
        hasLinks={hasLinks}
        hasStoryOverlay={hasStoryOverlay}
        hasOverlay={hasOverlay}
        hasMotion={hasMotion}
        isFinePointer={isFinePointer}
        isMotionPaused={isMotionPaused}
        handleToggleMotion={handleToggleMotion}
        isLinksOpen={isLinksOpen}
        setIsLinksOpen={setIsLinksOpen}
      />
    </div>
  )
}

export default Shot
