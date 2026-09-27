// 作品カードのモーション(動画・ストーリーリール)の出し分けと一時停止/再開の状態をまとめる
import { useEffect, useRef, useState } from 'react'
import type { Work } from '@content/types/content'
import { useStoryReel } from './use-story-reel'

export function useCardMotion(work: Work) {
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

  return {
    isFinePointer,
    showVideo,
    storyScenes,
    showReel,
    videoRef,
    isMotionPaused,
    pulseKey,
    handleToggleMotion,
    activeReelIndex,
    hasMotion,
  }
}
