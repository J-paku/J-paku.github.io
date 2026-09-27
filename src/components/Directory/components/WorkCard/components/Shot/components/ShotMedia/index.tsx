// 作品カードの画面キャプチャ枠の中身。動画・リール・静止画・プレースホルダーのいずれか1つを描く
import type { RefObject } from 'react'
import type { UiStrings, Work, WorkStoryScene } from '@content/types/content'
import DeviceFrame from '@/components/ui/DeviceFrame'
import ScenePlayer from '@/components/ui/ScenePlayer'

// 親の shot.module.css のクラス表。CSS の読み込み順を変えないよう、この部品は CSS を直接 import しない
type ShotStyles = { readonly [key: string]: string }

type ShotMediaProps = {
  work: Work
  ui: UiStrings
  styles: ShotStyles
  videoRef: RefObject<HTMLVideoElement | null>
  showVideo: boolean
  // 動画の src を付けてよいか。カードが画面に入った(リビールした)後だけ true
  shouldLoadVideo: boolean
  showReel: boolean
  storyScenes: WorkStoryScene[] | undefined
  activeReelIndex: number
  isMotionPaused: boolean
}

function ShotMedia(props: ShotMediaProps) {
  const { work, ui, styles, videoRef, showVideo, shouldLoadVideo } = props
  const { showReel, storyScenes, activeReelIndex, isMotionPaused } = props

  return showVideo ? (
    /* 実操作デモ動画。装飾専用(既存の img alt='' と同等の扱い)なので aria-hidden で読み上げから外す。
       停止手段は下の全面トグル(デスクトップ)/オーバーレイ内トグル(タッチ)が別途担う(WCAG 2.2.2)。
       src はカードが画面に入るまで付けない — src を HTML に書くと自動再生のため画面外でも読み込み開始
       直後に動画を取りに行く(モバイルでは1画面目の下にある)。付くまでは poster の静止画を出す。
       リビール前のカードは opacity: 0 なので、付ける時点より前の動画は元から見えていない。
       autoPlay を一時停止中だけ外すのは、src を付けると読み込み手順が自動再生の許可を戻すため —
       付く前に停止を押されていたら再生を始めず、停止ボタンの状態と食い違わせない */
    <video
      ref={videoRef}
      className={styles.video}
      src={shouldLoadVideo ? work.video : undefined}
      poster={work.thumbnail}
      autoPlay={!isMotionPaused}
      muted
      loop
      playsInline
      preload='none'
      aria-hidden='true'
    />
  ) : showReel && storyScenes !== undefined ? (
    /* ストーリー場面の循環リール。装飾専用(video と同等の扱い)なので aria-hidden で読み上げから外す。
       DeviceFrame は px固定の縁取りを持つため自然サイズで描画し、.reelScale の transform: scale()
       で丸ごと縮小する(詳細は shot.module.css 側のコメント参照) */
    <div className={styles.reel} aria-hidden='true'>
      <div className={styles.reelScale}>
        <DeviceFrame>
          <ScenePlayer
            scenes={storyScenes}
            activeIndex={activeReelIndex}
            placeholder={ui.work.shotPlaceholder}
            paused={isMotionPaused}
          />
        </DeviceFrame>
      </div>
    </div>
  ) : work.thumbnail !== undefined ? (
    <img src={work.thumbnail} alt='' className={styles.thumbnail} />
  ) : (
    <span className={styles.shotPlaceholder}>{ui.work.shotPlaceholder}</span>
  )
}

export default ShotMedia
