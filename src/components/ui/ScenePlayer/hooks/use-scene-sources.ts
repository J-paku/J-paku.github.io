// 場面SVGの原文を場面ごとに取ってきて、場面再生のコンテナ(../index.tsx)へ渡す。
// 取得そのものと取得中・取得済みの URL の覚えは @/lib/fetch-svg-source が持ち、ここは取れた原文を場面の id に、
// 失敗を画像の URL に結び付けて状態に置き、表示の部品へ渡す id の形に直す配線だけにする。
// 資産が未納の場面は取得失敗で検知し、その URL のままの間はプレースホルダ文言へ切り替える(WorkCard shotPlaceholder 踏襲)
import { useEffect, useEffectEvent, useState } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import { fetchSvgSource } from '@/lib/fetch-svg-source'
import { markFailed } from '../utils/mark-failed'
import { pickFailedScenes } from '../utils/pick-failed-scenes'

export function useSceneSources(scenes: WorkStoryScene[]) {
  // 取れた原文(場面の id → 原文)。届く前の場面は持たない
  const [sources, setSources] = useState<ReadonlyMap<string, string>>(new Map())
  // 読み込みに失敗した画像の URL を集める。一度失敗した URL は再試行させず、その URL の場面はプレースホルダのまま留める。
  // 失敗した URL を取り直さないのはこの覚えだけ(fetchSvgSource は失敗した取得を覚えから捨てる)。
  // 同じ id の場面でも URL が替われば、新しい URL を取りに行く
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set())

  // 失敗の印を effect の依存に置くと、1場面の失敗のたびにほかの場面の取得まで組み直してしまう
  const hasFailed = useEffectEvent((url: string) => failedImages.has(url))

  // 取りに行くのは場面の並びが変わった時だけ(見せる場面・一時停止の切り替えでは取り直さない)。
  // 並びが変わって組み直しても、取得中・取得済みの URL は fetchSvgSource の覚えが同じ Promise を返すので通信は増えない。
  // 組み直しで同じ原文・同じ失敗がもう一度届いたときは前の状態をそのまま返し、描き直しを起こさない
  useEffect(() => {
    let cancelled = false
    for (const scene of scenes) {
      if (hasFailed(scene.image)) continue
      fetchSvgSource(scene.image)
        .then(text => {
          if (cancelled) return
          setSources(prev =>
            prev.get(scene.id) === text ? prev : new Map(prev).set(scene.id, text)
          )
        })
        .catch(() => {
          if (cancelled) return
          setFailedImages(prev => markFailed(prev, scene.image))
        })
    }
    return () => {
      cancelled = true
    }
  }, [scenes])

  // 表示の部品は場面の id で失敗を引くので、今の並びの中で失敗した URL を持つ場面の id へ直して渡す
  return { sources, failedScenes: pickFailedScenes(scenes, failedImages) }
}
