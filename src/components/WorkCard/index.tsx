// 作品カード。10段階で左右交互(ジグザグ)を廃し、全帯(全画面幅)で
// 見出し(intro) → 画面キャプチャ(shot) → 事実パネル(panel)の1列縦積みにする。
// 仕様表・技術タグ・リンクは下部の枠線パネルへ集約し、カードの終端を明示する。
// wip は不変ルール5どおりリンクを持たない — links も story も持たないため WorkLinks が何も描かない
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useReveal } from '@/hooks/use-reveal'
import { useFullyVisible } from '@/hooks/use-fully-visible'
import { getTechIconPath } from '@/utils/tech-icons'
import { withLocale } from '@/utils/locale-path'
import { SCENE_ANIMATION_DURATIONS_MS, DEFAULT_SCENE_ANIMATION_DURATION_MS } from '@/utils/scene-durations'
import WorkSpec from '@/components/WorkSpec'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import WorkDetail from '@/components/WorkDetail'
import PhraseText from '@/components/PhraseText'
import DeviceFrame from '@/components/DeviceFrame'
import ScenePlayer from '@/components/ScenePlayer'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  // 一覧の配列インデックス(0始まり)。表示は 01 始まりの2桁ゼロ埋めに整える
  index: number
}

// 装飾専用の再生アイコン(三角)。読み上げはボタンの aria-label が担うため aria-hidden。
// SceneModal の PlayIcon と同じ形(中央パルス・停止中の常時印・オーバーレイ内トグルの3箇所で再利用)
function PlayIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={className}>
      <path
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M7 5l12 7-12 7z'
      />
    </svg>
  )
}

// 装飾専用の一時停止アイコン(縦棒2本)。読み上げはボタンの aria-label が担うため aria-hidden
function PauseIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={className}>
      <path fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' d='M8 5v14M16 5v14' />
    </svg>
  )
}

function WorkCard({ work, index }: WorkCardProps) {
  const { ui } = useContent()
  const { locale } = useLocale()
  const { ref, isRevealed } = useReveal()
  // 画面に丸ごと収まっている間だけ写真の色を戻す。縁に掛かっている間は灰色のまま
  const { ref: shotRef, isFullyVisible } = useFullyVisible<HTMLDivElement>()

  // 実操作デモの動画を静止画の代わりに描画してよいか。use-reveal と同じ判定パターン
  // (window.matchMedia の prefers-reduced-motion)を、マウント時1回だけ評価する
  // (SSR無しのVite SPAのため initializer での確定で足り、変化の監視は不要)
  const [prefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const showVideo = work.video !== undefined && !prefersReducedMotion

  // ストーリー場面(story.scenes)をカードのサムネイル枠で循環再生してよいか。
  // storyReel を持つ作品だけが対象 — 経路を重複保有せず story を単一ソースとして参照する。
  // scenes.length > 0 も確認しておく(0除算で剰余が NaN になる添字事故を後段で起こさないため)
  const storyScenes = work.story?.scenes
  const showReel = work.storyReel === true && storyScenes !== undefined && storyScenes.length > 0 && !prefersReducedMotion

  // ホバー可能・高精度ポインタ(マウス等)を持つ環境かどうか。同じ initializer パターンで
  // マウント時1回だけ評価する(変化の監視はしない)。動画カードの操作面を
  // 「shot 全面トグル(デスクトップ)」と「オーバーレイ内の小ボタン(タッチ)」で出し分ける判定に使う
  const [isFinePointer] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)

  // 動画/リールの一時停止/再開(WCAG 2.2.2)。自動再生・ループするモーション(動画またはストーリー
  // リール)に停止手段を持たせる。SceneModal の isAutoAdvancePaused と同じ判断で aria-pressed は使わず、
  // ラベル(aria-label)の差し替えだけで状態を伝える(SceneModal 264〜267行の注記参照 —
  // APGのカルーセル停止コントロールに倣い、押下状態の読み上げ矛盾を避けるため)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMotionPaused, setIsMotionPaused] = useState(false)

  // タップ/クリックのたびに「今の操作」を中央に短く出すための鍵。key を変えて要素を作り直すことで
  // 同じアニメーションを毎回頭から再生させる(SceneModal の pulseKey と同じ手法)
  const [pulseKey, setPulseKey] = useState(0)

  // 動画・リール共通のトグル操作(ユーチューブ式)。動画を持つカードだけ実際の再生要素を操作し、
  // リールは isMotionPaused の状態変化だけで ScenePlayer の paused を切り替える
  function handleToggleMotion() {
    const nextPaused = !isMotionPaused
    setIsMotionPaused(nextPaused)
    setPulseKey((prev) => prev + 1)
    if (!showVideo) return
    const videoElement = videoRef.current
    if (videoElement === null) return
    if (nextPaused) videoElement.pause()
    else videoElement.play().catch(() => {})
  }

  // リールの自動送り。SceneModal 209〜224行と同じ発想(場面ごとの周期・(i+1)%length の無限循環・
  // 一時停止での停止)をカード用に簡略化したもの。カードには境界(先頭/末尾)が無く常に循環するため、
  // SceneModal のフォーカス退避(境界での disabled 対策)は不要
  const [reelIndex, setReelIndex] = useState(0)
  // storyScenes.length で剰余を取り、常に配列の範囲内に収める(activeReelIndex はレンダー側でも使う)。
  // ロケール切替では WorkCard 自体が再マウントされず reelIndex だけが引き継がれるため、
  // ja/ko で場面数が食い違うコンテンツができると storyScenes[reelIndex] が undefined になり得る —
  // 「参照が変わったら0へ戻す」別 effect 方式は、同一コミット内でこの自動送り effect と実行順が
  // 絡み合い安全を保証しきれないため、剰余で常に有効な添字にする方式を採る
  const activeReelIndex = showReel && storyScenes !== undefined ? reelIndex % storyScenes.length : 0
  useEffect(() => {
    if (!showReel || storyScenes === undefined) return
    if (isMotionPaused) return
    const currentScene = storyScenes[reelIndex % storyScenes.length]
    const duration = SCENE_ANIMATION_DURATIONS_MS[currentScene.id] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS
    const timerId = window.setTimeout(() => {
      setReelIndex((prev) => (prev + 1) % storyScenes.length)
    }, duration)
    return () => window.clearTimeout(timerId)
  }, [showReel, storyScenes, reelIndex, isMotionPaused])

  // リンクの覆い。ポインタ環境ではホバー(と focus-within)で出し、タッチ環境ではタップで開閉する。
  // この state はタップ用 — ホバー表示は CSS 側の @media (hover: hover) が担う。
  // links(live/repo)を持たないが story を持つ作品も、同じ覆いにストーリーページへの
  // ボタンを1つ出す — 覆いの存在に他カードと差を付けない
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined
  const hasStoryOverlay = !hasLinks && work.story !== undefined
  const hasOverlay = hasLinks || hasStoryOverlay
  const [isLinksOpen, setIsLinksOpen] = useState(false)

  // 動画・リールいずれかのモーションを持つか。全面トグル・オーバーレイ内ボタン・中央パルス/
  // 停止印の3箇所を両方の種別で共用するための束ね判定
  const hasMotion = showVideo || showReel

  // 折りたたみ式の詳細。work.detail が無いカードはトグル自体を出さない
  const hasDetail = work.detail !== undefined
  const detailId = `${work.slug}-detail`
  const { hash } = useLocation()
  // #slug 付きで到着した時だけ最初から開く。スクロール位置自体は App の useScrollRestoration が
  // 既に保持しているため、ここでは開閉の初期値だけを決める(追加のスクロール操作はしない)
  const [isDetailOpen, setIsDetailOpen] = useState(() => hash === `#${work.slug}`)

  // Esc と「キャプチャ枠の外側クリック」で閉じる。開いている間だけ購読する。
  // 外側判定は shotRef(枠そのもの)基準 — 枠内のトリガー・リンクは各自の onClick が処理する
  useEffect(() => {
    if (!isLinksOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLinksOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const shot = shotRef.current
      if (shot !== null && event.target instanceof Node && !shot.contains(event.target)) {
        setIsLinksOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isLinksOpen, shotRef])

  // .hasDetail は詳細を持つカードだけに全幅行を足す修飾子。全カード一律に足すと、
  // 詳細を持たないカード(大半)のモバイル1列表示に row-gap 分の空行が余白として残るため分ける
  let cardClassName = isRevealed ? `${styles.card} ${styles.cardRevealed}` : styles.card
  if (hasDetail) cardClassName += ` ${styles.hasDetail}`
  let shotClassName = isFullyVisible ? `${styles.shot} ${styles.shotInView}` : styles.shot
  // モーション(動画・リール)を持つカードの識別用修飾子。持たないカードのCSSは1px も変えず、
  // この修飾子が付いた shot だけに分岐する(オーバーレイ背景の pointer-events 分岐で使う)
  if (hasMotion) shotClassName += ` ${styles.shotHasVideo}`

  // 通し番号。接頭辞などの文言は付けない(表示文字列は content/ の外に置かない)
  const serial = String(index + 1).padStart(2, '0')

  return (
    <article id={work.slug} ref={ref} className={cardClassName}>
      {/* 読み順は「見出し → キャプチャ → 事実」。全帯(全画面幅)でこのDOM順がそのまま縦に並ぶ
          (grid-template-areas は並べ替えではなく行間の骨格として使うだけ)。
          キャプチャを先頭に置くと、何の作品かを判別する前に画面の3割を使う(390px幅で実測233px)。
          並べ替えが必要になっても CSS の order は使わない — タブ順・読み上げ順がDOMのまま残って
          視覚順とずれるため、視覚順そのものをDOM順に合わせている */}
      <div className={styles.intro}>
        {/* NO. 行。番号(赤)と文脈をドットリーダーで結び、行として1本に見せる */}
        <div className={styles.head}>
          <span className={styles.serial}>NO.{serial}</span>
          <span className={styles.leader} aria-hidden="true" />
          <span className={styles.context}>
            <PhraseText text={work.context} />
          </span>
        </div>

        <h3 className={styles.title}>
          <PhraseText text={work.title} />
          {work.status === 'wip' ? <span className={styles.wipBadge}>{ui.work.wipBadge}</span> : null}
        </h3>
        <p className={styles.tagline}>
          <PhraseText text={work.tagline} />
        </p>
      </div>

      {/* グリフは背景装飾。要素として置くと支援技術から隠しても色コントラスト検査に掛かるため、
          data 属性で渡して CSS の疑似要素として描く */}
      <div ref={shotRef} className={shotClassName} data-glyph={work.glyph}>
        {showVideo ? (
          /* 実操作デモ動画。装飾専用(既存の img alt="" と同等の扱い)なので aria-hidden で読み上げから外す。
             停止手段は下の全面トグル(デスクトップ)/オーバーレイ内トグル(タッチ)が別途担う(WCAG 2.2.2) */
          <video
            ref={videoRef}
            className={styles.video}
            src={work.video}
            poster={work.thumbnail}
            autoPlay
            muted
            loop
            playsInline
            preload='metadata'
            aria-hidden='true'
          />
        ) : showReel && storyScenes !== undefined ? (
          /* ストーリー場面の循環リール。装飾専用(video と同等の扱い)なので aria-hidden で読み上げから外す。
             DeviceFrame は px固定の縁取りを持つため自然サイズで描画し、.reelScale の transform: scale()
             で丸ごと縮小する(詳細は work-card.module.css 側のコメント参照) */
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
          <img src={work.thumbnail} alt="" className={styles.thumbnail} />
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
          <>
            {/* 中央のパルス合図(ユーチューブ式)。key を変えて要素を作り直し、押すたびに同じ
                アニメーションを頭から再生させる。アイコンは新しい状態を示す(停止直後は▶、
                再生直後は⏸) — SceneModal の pulse と同じ手法・同じ判断 */}
            <span key={pulseKey} className={styles.videoPulse} aria-hidden='true'>
              {isMotionPaused ? (
                <PlayIcon className={styles.videoPulseIcon} />
              ) : (
                <PauseIcon className={styles.videoPulseIcon} />
              )}
            </span>
            {isMotionPaused ? (
              /* 停止中はその状態が続いていることを示し続ける常時表示の印。パルスが消えたあとも
                 「止まっている」と分かるようにする */
              <span className={styles.videoPausedMark} aria-hidden='true'>
                <PlayIcon className={styles.videoPulseIcon} />
              </span>
            ) : null}
          </>
        ) : null}
        {hasOverlay && !(hasMotion && isFinePointer) ? (
          <button
            type="button"
            className={styles.shotTrigger}
            aria-expanded={isLinksOpen}
            onClick={() => setIsLinksOpen((open) => !open)}
          >
            <span className={styles.srOnly}>{hasLinks ? ui.work.openLinks : ui.work.openStory}</span>
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
            className={isLinksOpen ? `${styles.shotOverlay} ${styles.shotOverlayOpen}` : styles.shotOverlay}
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
                  <PlayIcon className={styles.videoToggleIcon} />
                ) : (
                  <PauseIcon className={styles.videoToggleIcon} />
                )}
              </button>
            ) : null}
            {work.links.live !== undefined ? (
              <a href={work.links.live} rel="noreferrer" className={styles.overlayPrimary}>
                {ui.work.live}
              </a>
            ) : null}
            {work.links.repo !== undefined ? (
              <a href={work.links.repo} rel="noreferrer" className={styles.overlaySecondary}>
                {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
                <svg className={styles.overlayIcon} viewBox='0 0 24 24' aria-hidden='true'>
                  <path d={getTechIconPath(ui.work.repo)} />
                </svg>
                {ui.work.repo}
              </a>
            ) : null}
            {hasStoryOverlay ? (
              /* 外部リンクを持たない作品はストーリーページが唯一の行き先。主ボタンの見た目で1つだけ置く */
              <Link to={withLocale(`/works/${work.slug}`, locale)} className={styles.overlayPrimary}>
                {ui.work.story}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 事実のパネル。仕様表・タグ・リンクを積み、カードの終端を枠で明示する */}
      <div className={styles.panel}>
        <WorkSpec work={work} />
        <WorkStack stack={work.stack} />
        <WorkLinks
          live={work.links.live}
          repo={work.links.repo}
          storySlug={work.story !== undefined ? work.slug : undefined}
        />
      </div>

      {/* 詳細トグル。全幅バーではなく中央寄せの小さなテキストリンク然としたボタン。
          下線・シェブロンは常時表示し、カードを開く場所としての存在感を持たせる */}
      {hasDetail ? (
        <button
          type='button'
          className={styles.detailToggle}
          aria-expanded={isDetailOpen}
          aria-controls={detailId}
          onClick={() => setIsDetailOpen((open) => !open)}
        >
          <span className={styles.detailToggleLabel}>{isDetailOpen ? ui.work.hideDetail : ui.work.showDetail}</span>
          <svg className={styles.detailChevron} viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M4 6l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        </button>
      ) : null}

      {/* 全幅の詳細行。閉じている間も WorkDetail 自体はマウントしたまま高さアコーディオンで畳む
          (アンマウント/リマウントせず、toggle の度に再フェッチ等が走らない構成にする)。
          内側の detailInner が min-height: 0 / overflow: hidden を持ち、grid-template-rows の
          0fr↔1fr 遷移中も中身を切り詰める。閉じ切った後は inert で操作・読み上げ両方から外す */}
      {hasDetail ? (
        <div className={isDetailOpen ? `${styles.detail} ${styles.detailOpen}` : styles.detail}>
          <div className={styles.detailInner} inert={!isDetailOpen}>
            <WorkDetail work={work} detailId={detailId} />
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default WorkCard
