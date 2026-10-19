// 今の場面の並びから、取得に失敗した画像の URL を持つ場面の id を選ぶ(hooks/use-scene-sources.ts が表示の部品へ渡す形に直す)。
// 失敗は URL ごとに覚えるので、同じ id でも URL が替われば選ばない。並びに無い URL の失敗は数えない
import type { WorkStoryScene } from '@content/types/content'

export const pickFailedScenes = (
  scenes: readonly Pick<WorkStoryScene, 'id' | 'image'>[],
  failedImages: ReadonlySet<string>
): ReadonlySet<string> =>
  new Set(scenes.filter(scene => failedImages.has(scene.image)).map(scene => scene.id))
