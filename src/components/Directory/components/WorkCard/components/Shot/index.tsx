// 作品カードの画面キャプチャ枠。動画・リール・静止画の出し分け、モーション操作、リンクの覆いを描くだけの部品(状態は親が持つ)
import Link from 'next/link'
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from 'react'
import type { Locale, UiStrings, Work, WorkStoryScene } from '@content/types/content'
import { getTechIconPath } from '@/utils/tech-icons'
import { toHref } from '@/utils/locale-path'
import DeviceFrame from '@/components/ui/DeviceFrame'
import ScenePlayer from '@/components/ui/ScenePlayer'
import PlaybackIcon from '@/components/ui/PlaybackIcon'
import PlaybackPulse from '@/components/ui/PlaybackPulse'
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

  // リンクの覆い。ポインタ環境ではホバー(と focus-within)で出し、タッチ環境ではタップで開閉する。
  // links(live/repo)を持たないが story を持つ作品も、同じ覆いにストーリーページへの
  // ボタンを1つ出す — 覆いの存在に他カードと差を付けない
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined
  const hasStoryOverlay = !hasLinks && work.story !== undefined
  const hasOverlay = hasLinks || hasStoryOverlay

  // 修飾子は枠自身の状態なのでここで組む。.shotInView は画面に丸ごと収まっている間だけ写真の色を
  // 戻す印。.shotHasVideo はモーション(動画・リール)を持つカードの識別用で、覆いの背景の
  // pointer-events 分岐だけに効く — 持たないカードのCSSは1px も変わらない
  let shotClassName = isFullyVisible ? `${styles.shot} ${styles.shotInView}` : styles.shot
  if (hasMotion) shotClassName += ` ${styles.shotHasVideo}`

  // グリフは背景装飾。要素として置くと支援技術から隠しても色コントラスト検査に掛かるため、
  // data 属性で渡して CSS の疑似要素として描く
  return (
    <div ref={shotRef} className={`${slotClassName} ${shotClassName}`} data-glyph={work.glyph}>
      {showVideo ? (
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
      )}
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
      {hasOverlay && !(hasMotion && isFinePointer) ? (
        <button
          type='button'
          className={styles.shotTrigger}
          aria-expanded={isLinksOpen}
          onClick={() => setIsLinksOpen(open => !open)}
        >
          <span className='sr-only'>{hasLinks ? ui.work.openLinks : ui.work.openStory}</span>
        </button>
      ) : null}
      {hasOverlay ? (
        /* 常に描画し、表示は CSS が切り替える(隠れている間も pointer-events: none でクリックを透過)。
           タブ移動でリンクへ入れば focus-within で現れるため、キーボードでも到達できる。
           覆いのどこを押しても閉じる。リンク自身のクリックは遷移した上で覆いも閉じるので分岐不要。
           このdivの onClick はポインタ・タッチ専用の便宜(空白部分タップでの寄せ閉じ)であり、
           同じ機能(setIsLinksOpen(false))は shotTrigger の再押下(aria-expanded トグル)と
           上のEscapeハンドラで既にキーボードから到達できる — WCAG 2.1.1 は満たしている。
           ここに role='button'+tabIndex を足さないのは意図的: 中に実体の <a>/<Link> を
           抱えているため、外側まで操作可能ロールにすると axe の nested-interactive
           (WCAG 4.1.2・配信ゲート対象)に抵触する */
        <div
          className={
            isLinksOpen ? `${styles.shotOverlay} ${styles.shotOverlayOpen}` : styles.shotOverlay
          }
          onClick={() => setIsLinksOpen(false)}
        >
          {hasMotion && !isFinePointer ? (
            /* 動画・リールの一時停止/再開ボタン(WCAG 2.2.2)。タッチ環境の操作口はこれ1つ
               (デスクトップは全面トグルが既に同じ役割を持つため、同名ボタンの重複を避けて
               ここでは出さない)。覆いの onClick(背景タップ=閉じる)へ伝播すると
               覆いごと閉じてしまうため stopPropagation で止める */
            <button
              type='button'
              className={styles.videoToggle}
              aria-label={isMotionPaused ? ui.work.resumeMotion : ui.work.pauseMotion}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                handleToggleMotion()
              }}
            >
              {isMotionPaused ? (
                <PlaybackIcon kind='play' className={styles.videoToggleIcon} />
              ) : (
                <PlaybackIcon kind='pause' className={styles.videoToggleIcon} />
              )}
            </button>
          ) : null}
          {work.links.live !== undefined ? (
            <a href={work.links.live} rel='noreferrer' className={styles.overlayPrimary}>
              {ui.work.live}
            </a>
          ) : null}
          {work.links.repo !== undefined ? (
            <a href={work.links.repo} rel='noreferrer' className={styles.overlaySecondary}>
              {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
              <svg className={styles.overlayIcon} viewBox='0 0 24 24' aria-hidden='true'>
                <path d={getTechIconPath(ui.work.repo)} />
              </svg>
              {ui.work.repo}
            </a>
          ) : null}
          {hasStoryOverlay ? (
            /* 外部リンクを持たない作品はストーリーページが唯一の行き先。主ボタンの見た目で1つだけ置く */
            <Link href={toHref(`/works/${work.slug}`, locale)} className={styles.overlayPrimary}>
              {ui.work.story}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default Shot
