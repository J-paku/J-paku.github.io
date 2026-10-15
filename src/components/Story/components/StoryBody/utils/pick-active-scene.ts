// 交差の通知から、今の場面にする場面の番号を選ぶ(hooks/use-active-scene.ts の観察者が受けた通知を渡す)。
// 中央の帯に入った(isIntersecting)場面のうち、通知の並びで最後のものを選ぶ。入った場面が無い通知(帯から出ただけ)では null を返し、
// 今の場面を変えない。場面の番号は、フックが観察する section に付けた data-scene-index から読む。
// HTMLElement でないものと、番号が数でないものは数えない(フックが観察するのは番号を付けた section だけなので、どちらも起きない場合の防御)
type SceneEntry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>

export const pickActiveScene = (entries: readonly SceneEntry[]): number | null => {
  let picked: number | null = null
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    if (!(entry.target instanceof HTMLElement)) continue
    const index = Number(entry.target.dataset.sceneIndex)
    if (Number.isNaN(index)) continue
    picked = index
  }
  return picked
}
