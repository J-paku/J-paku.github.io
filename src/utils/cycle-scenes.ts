// 場面の自動送りの間合いと巡り方。作品カードのリール(WorkCard/hooks/use-story-reel.ts)と
// 場面モーダル(SceneModal/hooks/use-scene-carousel.ts)が同じ式で送るため、式はここ1か所だけに置く
// (片方だけ直すと、カードとモーダルで送る間合いや末尾からの戻り方が食い違う)
import {
  DEFAULT_SCENE_ANIMATION_DURATION_MS,
  SCENE_ANIMATION_DURATIONS_MS,
} from './scene-durations'

// 場面の絵の1周期(ms)。絵が1周したら次の場面へ送る。表に無い場面idは既定値
export const sceneCycleMs = (sceneId: string): number =>
  SCENE_ANIMATION_DURATIONS_MS[sceneId] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS

// 添字を場面の数の範囲へ巡らせて収める。count は1以上を渡す(場面が0個なら呼び出し側が送りを始めない)
export const loopSceneIndex = (index: number, count: number): number => index % count

// 自動送りで次に見せる場面の添字。末尾の次は先頭へ戻る
export const nextSceneIndex = (index: number, count: number): number =>
  loopSceneIndex(index + 1, count)
