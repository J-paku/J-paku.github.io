// 場面モーダルの場面送りの判定(端かどうか・前へ/次へで移る先・自動送りを掛けるか)。
// 表示中の添字・一時停止・タイマーはフック(hooks/use-scene-carousel.ts)が持ち、ここは値を受けて答えるだけにする
// (React なしで先頭・末尾・場面が1つ・一時停止中を網羅的に確かめるため)
import { sceneCycleMs } from '@/utils/cycle-scenes'

export type SceneEdges = {
  isFirst: boolean
  isLast: boolean
}

// 添字が先頭・末尾に当たるか。場面が1つならどちらにも当たる(前へ・次へが両方無効になる)
export const sceneEdges = (index: number, count: number): SceneEdges => ({
  isFirst: index === 0,
  isLast: index === count - 1,
})

// 前へで移る先。先頭ではどこへも移らない(null)
export const prevSceneTarget = (index: number): number | null => (index === 0 ? null : index - 1)

// 次へで移る先。末尾ではどこへも移らない(null)。手で送る時は末尾から先頭へ巡らない(巡るのは自動送りだけ)
export const nextSceneTarget = (index: number, count: number): number | null =>
  index === count - 1 ? null : index + 1

// 自動送りまでの待ち(ms)。送らないなら null。
// 動きを控える設定では場面の絵の動き自体が止まっているので、時間で送る意味が無い。
// 一時停止中(WCAG 2.2.2 の停止手段)も送らない
export const autoAdvanceDelayMs = (
  sceneId: string,
  reducedMotion: boolean,
  paused: boolean
): number | null => (reducedMotion || paused ? null : sceneCycleMs(sceneId))
