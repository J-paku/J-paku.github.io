// コースの進み具合を持つ。会話した地点を visited へ記録し、全地点が揃った会話を閉じた時だけ完走の演出を出す
import { useCallback, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { VillageText, WorldSet } from '@content/types/world'
import { allSpots } from '@/lib/village/spot'
import { writeVisited } from '@/lib/preferences'
import type { VillageRuntime } from '../use-village-runtime'

export type CourseProgressOptions = {
  worldSet: WorldSet
  text: VillageText
  runtime: VillageRuntime
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  setSpeech: Dispatch<SetStateAction<string>>
}

type UseCourseProgress = {
  // 会話窓を開いた地点を visited へ入れて保存する。既に入っていれば何もしない
  markVisited: (spotId: string) => void
  // 会話窓を閉じた時に呼ぶ。コースの全地点が揃っていれば一度だけ完走の演出を出す
  celebrateIfComplete: () => void
}

export function useCourseProgress({
  worldSet,
  text,
  runtime,
  setVisited,
  setSpeech,
}: CourseProgressOptions): UseCourseProgress {
  // コース地点(order を持つ地点)の id 一覧。一度だけ作り、visited との突き合わせに使う
  const courseSpotIds = useMemo(() => allSpots(worldSet).map(spot => spot.id), [worldSet])
  // 全ワールド通しの会話地点数(コース分のみ)
  const totalSpots = courseSpotIds.length
  // 「コースの全地点で話した」の演出は一度だけ出す。再訪の度に一覧へ焦点を奪わない
  const celebratedRef = useRef(false)

  const markVisited = useCallback(
    (spotId: string) => {
      if (runtime.visited.current.has(spotId)) return
      const marked = new Set(runtime.visited.current)
      marked.add(spotId)
      runtime.visited.current = marked
      setVisited(marked)
      writeVisited(worldSet.id, [...marked])
    },
    [runtime, worldSet, setVisited]
  )

  const celebrateIfComplete = useCallback(() => {
    // コース外の地点を先に話しても size は増えるが完走にはならないため(時計・池はそもそも visited に入れない)、
    // visited に含まれるコース地点の数で判定する
    const visitedCourseCount = courseSpotIds.filter(id => runtime.visited.current.has(id)).length
    // コースの全地点が揃った会話を閉じた瞬間だけ、一覧への案内に差し替えて焦点を移す
    if (!celebratedRef.current && visitedCourseCount === totalSpots) {
      celebratedRef.current = true
      // {list}は全て置き換え、値は関数で渡して$記法として読まない(spot-textのfillPlaceと同じ)
      setSpeech(text.allSeen.replaceAll('{list}', () => text.toList))
      // StopModal のアンマウント処理(返却先フォーカス)の後に上書きするため、次フレームまで待つ
      window.requestAnimationFrame(() => {
        const exit = document.querySelector<HTMLElement>('[data-village-exit]')
        if (exit === null) return
        exit.dataset.bounce = ''
        exit.focus()
      })
    }
  }, [runtime, courseSpotIds, totalSpots, setSpeech, text])

  return { markVisited, celebrateIfComplete }
}
