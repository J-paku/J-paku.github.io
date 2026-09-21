'use client'

// 作品カード。10段階で左右交互(ジグザグ)を廃し、全帯(全画面幅)で
// 見出し(intro) → 画面キャプチャ(shot) → 事実パネル(panel)の1列縦積みにする。
// 仕様表・技術タグ・リンクは下部の枠線パネルへ集約し、カードの終端を明示する。
// wip は不変ルール5どおりリンクを持たない — links も story も持たないため WorkLinks が何も描かない
import { useEffect, useRef, useState } from 'react'
import type { Locale, UiStrings, Work } from '@content/types/content'
import { useReveal } from '@/hooks/use-reveal'
import { useFullyVisible } from './hooks/use-fully-visible'
import { useStoryReel } from './hooks/use-story-reel'
import { useLinksOverlay } from './hooks/use-links-overlay'
import WorkSpec from './components/WorkSpec'
import WorkStack from './components/WorkStack'
import WorkLinks from './components/WorkLinks'
import WorkDetail from './components/WorkDetail'
import Shot from './components/Shot'
import DetailToggle from './components/DetailToggle'
import PhraseText from '@/components/ui/PhraseText'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  // 一覧の配列インデックス(0始まり)。表示は 01 始まりの2桁ゼロ埋めに整える
  index: number
  locale: Locale
  ui: UiStrings
}

function WorkCard({ work, index, locale, ui }: WorkCardProps) {
  // isRevealed はカードのフェードインの合図で、動画の src を付けてよい合図も兼ねる
  const { ref, isRevealed } = useReveal()
  // 画面に丸ごと収まっている間だけ写真の色を戻す。縁に掛かっている間は灰色のまま
  const { ref: shotRef, isFullyVisible } = useFullyVisible<HTMLDivElement>()

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isFinePointer, setIsFinePointer] = useState(false)
  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setIsFinePointer(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  const showVideo = work.video !== undefined && !prefersReducedMotion

  // ストーリー場面(story.scenes)をカードのサムネイル枠で循環再生してよいか。
  // storyReel を持つ作品だけが対象 — 経路を重複保有せず story を単一ソースとして参照する。
  // scenes.length > 0 も確認しておく(0除算で剰余が NaN になる添字事故を後段で起こさないため)
  const storyScenes = work.story?.scenes
  const showReel =
    work.storyReel === true &&
    storyScenes !== undefined &&
    storyScenes.length > 0 &&
    !prefersReducedMotion

  // 動画/リールの一時停止/再開(WCAG 2.2.2)。自動再生・ループするモーション(動画またはストーリー
  // リール)に停止手段を持たせる。SceneModal の isAutoAdvancePaused と同じ判断で aria-pressed は使わず、
  // ラベル(aria-label)の差し替えだけで状態を伝える(SceneModal の sceneToggle ボタンの注記参照 —
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
    setPulseKey(prev => prev + 1)
    if (!showVideo) return
    const videoElement = videoRef.current
    if (videoElement === null) return
    if (nextPaused) videoElement.pause()
    else videoElement.play().catch(() => {})
  }

  // リールの自動送り。場面ごとの周期で循環させ、常に範囲内の添字を受け取る(詳細はhooks/use-story-reel.ts)
  const activeReelIndex = useStoryReel({ showReel, storyScenes, isMotionPaused })

  // 動画・リールいずれかのモーションを持つか。全面トグル・オーバーレイ内ボタン・中央パルス/
  // 停止印の3箇所を両方の種別で共用するための束ね判定
  const hasMotion = showVideo || showReel

  // 折りたたみ式の詳細。work.detail が無いカードはトグル自体を出さない
  const hasDetail = work.detail !== undefined
  const detailId = `${work.slug}-detail`
  // #slug 付きで到着した時だけ最初から開く。アンカーへのスクロールはブラウザ標準に任せ、
  // ここでは開閉の初期値だけを決める(追加のスクロール操作はしない)
  // 初期状態は SSR と一致させるため false。ハッシュは mount 後に読む(hydration 不一致を避ける)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  useEffect(() => {
    if (window.location.hash === `#${work.slug}`) setIsDetailOpen(true)
  }, [work.slug])

  // リンクの覆いの開閉(タップ用)。Escと枠外クリックで閉じる購読もこのフックが張る
  const { isLinksOpen, setIsLinksOpen } = useLinksOverlay(shotRef)

  // .hasDetail は詳細を持つカードだけに全幅行を足す修飾子。全カード一律に足すと、
  // 詳細を持たないカード(大半)のモバイル1列表示に row-gap 分の空行が余白として残るため分ける
  let cardClassName = isRevealed ? `${styles.card} ${styles.cardRevealed}` : styles.card
  if (hasDetail) cardClassName += ` ${styles.hasDetail}`

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
          <span className={styles.leader} aria-hidden='true' />
          <span className={styles.context}>
            <PhraseText text={work.context} locale={locale} />
          </span>
        </div>

        <h3 className={styles.title}>
          <PhraseText text={work.title} locale={locale} />
          {work.status === 'wip' ? (
            <span className={styles.wipBadge}>{ui.work.wipBadge}</span>
          ) : null}
        </h3>
        <p className={styles.tagline}>
          <PhraseText text={work.tagline} locale={locale} />
        </p>
      </div>

      <Shot
        work={work}
        locale={locale}
        ui={ui}
        shotRef={shotRef}
        slotClassName={styles.shotSlot}
        isFullyVisible={isFullyVisible}
        videoRef={videoRef}
        showVideo={showVideo}
        shouldLoadVideo={isRevealed}
        showReel={showReel}
        storyScenes={storyScenes}
        activeReelIndex={activeReelIndex}
        isMotionPaused={isMotionPaused}
        pulseKey={pulseKey}
        hasMotion={hasMotion}
        isFinePointer={isFinePointer}
        handleToggleMotion={handleToggleMotion}
        isLinksOpen={isLinksOpen}
        setIsLinksOpen={setIsLinksOpen}
      />

      {/* 事実のパネル。仕様表・タグ・リンクを積み、カードの終端を枠で明示する */}
      <div className={styles.panel}>
        <WorkSpec work={work} ui={ui.work} locale={locale} />
        <WorkStack stack={work.stack} label={ui.work.stack} />
        <WorkLinks
          live={work.links.live}
          repo={work.links.repo}
          storySlug={work.story !== undefined ? work.slug : undefined}
          locale={locale}
          ui={ui.work}
        />
      </div>

      {hasDetail ? (
        <DetailToggle
          isDetailOpen={isDetailOpen}
          setIsDetailOpen={setIsDetailOpen}
          detailId={detailId}
          slotClassName={styles.toggleSlot}
          ui={ui}
        />
      ) : null}

      {/* 全幅の詳細行。閉じている間も WorkDetail 自体はマウントしたまま高さアコーディオンで畳む
          (アンマウント/リマウントせず、toggle の度に再フェッチ等が走らない構成にする)。
          内側の detailInner が min-height: 0 / overflow: hidden を持ち、grid-template-rows の
          0fr↔1fr 遷移中も中身を切り詰める。閉じ切った後は inert で操作・読み上げ両方から外す */}
      {hasDetail ? (
        <div className={isDetailOpen ? `${styles.detail} ${styles.detailOpen}` : styles.detail}>
          <div className={styles.detailInner} inert={!isDetailOpen}>
            <WorkDetail work={work} detailId={detailId} locale={locale} />
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default WorkCard
