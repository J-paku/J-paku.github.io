// ストーリーリールの自動送り。場面ごとの周期で添字を進め、常に場面配列の範囲内に収めた添字を返す
import { useEffect, useState } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import {
  SCENE_ANIMATION_DURATIONS_MS,
  DEFAULT_SCENE_ANIMATION_DURATION_MS,
} from '@/utils/scene-durations'

type UseStoryReelParams = {
  showReel: boolean
  storyScenes: WorkStoryScene[] | undefined
  isMotionPaused: boolean
}

export function useStoryReel({ showReel, storyScenes, isMotionPaused }: UseStoryReelParams) {
  // リールの自動送り。SceneModal(hooks/use-scene-carousel.ts)の自動送りと同じ発想(場面ごとの周期・
  // (i+1)%length の無限循環・一時停止での停止)をカード用に簡略化したもの。カードには境界(先頭/末尾)が
  // 無く常に循環するため、SceneModal のフォーカス退避(境界での disabled 対策)は不要
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
    const duration =
      SCENE_ANIMATION_DURATIONS_MS[currentScene.id] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS
    const timerId = window.setTimeout(() => {
      setReelIndex(prev => (prev + 1) % storyScenes.length)
    }, duration)
    return () => window.clearTimeout(timerId)
  }, [showReel, storyScenes, reelIndex, isMotionPaused])

  return activeReelIndex
}
