// 場面SVGの原文を場面ごとに取ってきて、場面再生のコンテナ(../container.tsx)へ渡す。
// 取得そのものと URL ごとの覚えは @/lib/fetch-svg-source が持ち、ここは結果を場面の id に結び付けて状態に置く配線だけにする。
// 資産が未納の場面は取得失敗で検知し、以降はプレースホルダ文言へ切り替える(WorkCard shotPlaceholder 踏襲)
import { useEffect, useEffectEvent, useState } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import { fetchSvgSource } from '@/lib/fetch-svg-source'
import { markFailed } from '../utils/mark-failed'

export function useSceneSources(scenes: WorkStoryScene[]) {
  // 取れた原文(場面の id → 原文)。届く前の場面は持たない
  const [sources, setSources] = useState<ReadonlyMap<string, string>>(new Map())
  // 読み込みに失敗した場面の id を集める。一度失敗した画像は再試行させずプレースホルダのまま留める
  const [failedScenes, setFailedScenes] = useState<ReadonlySet<string>>(new Set())

  // 失敗の印を effect の依存に置くと、1場面の失敗のたびにほかの場面の取得まで組み直してしまう
  const hasFailed = useEffectEvent((id: string) => failedScenes.has(id))

  // 取りに行くのは場面の並びが変わった時だけ(見せる場面・一時停止の切り替えでは取り直さない)。
  // 並びが変わって組み直しても、取得中・取得済みの URL は fetchSvgSource の覚えが同じ Promise を返すので通信は増えない。
  // 組み直しで同じ原文・同じ失敗がもう一度届いたときは前の状態をそのまま返し、描き直しを起こさない
  useEffect(() => {
    let cancelled = false
    for (const scene of scenes) {
      if (hasFailed(scene.id)) continue
      fetchSvgSource(scene.image)
        .then(text => {
          if (cancelled) return
          setSources(prev =>
            prev.get(scene.id) === text ? prev : new Map(prev).set(scene.id, text)
          )
        })
        .catch(() => {
          if (cancelled) return
          setFailedScenes(prev => markFailed(prev, scene.id))
        })
    }
    return () => {
      cancelled = true
    }
  }, [scenes])

  return { sources, failedScenes }
}
