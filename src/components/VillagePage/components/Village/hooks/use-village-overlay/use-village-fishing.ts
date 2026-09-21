// 釣りの進み具合(投げる → かかる → 釣り上げる)と、窓に出す文言・浮きを置くマスだけを持つ。
// この状態は村の画面の外から読まないので、store は立てずにこのフックの中の state・ref で閉じる。
// 釣った一覧は保存しない(タブを開いている間だけ覚える)。訪問記録と違って進行の鍵ではなく、
// 開き直す度に最初から釣り集められる方が何度でも遊べるため
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, StopText, VillageText, World } from '@content/types/world'
import {
  catchToStop,
  FISHING_BITE_MS,
  FISHING_CAST_MS,
  FISHING_LAND_MS,
  isCollectionComplete,
  pickCatch,
} from '@/lib/village/fishing'

export type FishingPhase = 'idle' | 'casting' | 'bite' | 'landing' | 'caught'

export type VillageFishingOptions = {
  text: VillageText
  // 釣れる中身(今の会社の経歴の機能一覧)。空なら釣り上げずに終わる
  catches: readonly CareerFeature[]
  roleLabels: Record<CareerRole, string>
  world: World
  setSpeech: Dispatch<SetStateAction<string>>
}

export type UseVillageFishing = {
  phase: FishingPhase
  // 結果窓に出す文言。それ以外の間は null
  stop: StopText | null
  // 浮きと巻物を置く水のマス。投げてから釣り上げまでの間だけ持ち、やめれば null
  at: Cell | null
  start: (at: Cell) => void
  reset: () => void
}

export function useVillageFishing({
  text,
  catches,
  roleLabels,
  world,
  setSpeech,
}: VillageFishingOptions): UseVillageFishing {
  const [phase, setPhase] = useState<FishingPhase>('idle')
  const [caught, setCaught] = useState<CareerFeature | null>(null)
  const [at, setAt] = useState<Cell | null>(null)
  // これまでに釣り上げた名前。まだ釣っていない物を先に出すため pickCatch へ渡す
  const caughtNamesRef = useRef(new Set<string>())
  // 全部を釣り上げた時の文言を出したか。初めての一度だけ差し替える
  const completedRef = useRef(false)
  // 投げてから「かかった」まで・かかってから釣り上げるまで・巻物が水面に浮いている間のタイマー
  const castTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // タイマーと釣果をまとめて捨てる。釣った一覧はこの回限りの物ではないので残す
  const reset = useCallback(() => {
    if (castTimerRef.current !== null) {
      clearTimeout(castTimerRef.current)
      castTimerRef.current = null
    }
    if (biteTimerRef.current !== null) {
      clearTimeout(biteTimerRef.current)
      biteTimerRef.current = null
    }
    if (landTimerRef.current !== null) {
      clearTimeout(landTimerRef.current)
      landTimerRef.current = null
    }
    setPhase('idle')
    setCaught(null)
    setAt(null)
  }, [])

  const start = useCallback(
    (cell: Cell) => {
      // 同じフレームの連打でもタイマーを二重に始めない
      if (phase !== 'idle' || castTimerRef.current !== null || catches.length === 0) return
      setAt(cell)
      setPhase('casting')
      setSpeech(text.fishing.cast)
      castTimerRef.current = setTimeout(() => {
        castTimerRef.current = null
        setPhase('bite')
        setSpeech(text.fishing.bite)
        biteTimerRef.current = setTimeout(() => {
          biteTimerRef.current = null
          // まだ釣っていない物を優先。全部釣り終えていれば全体から選ぶ
          const picked = pickCatch(catches, caughtNamesRef.current)
          // 釣れる中身が無い時は窓を出さず、静かに元へ戻す
          if (picked === null) {
            reset()
            return
          }
          caughtNamesRef.current.add(picked.name)
          setCaught(picked)
          setPhase('landing')
          // 全部揃った瞬間だけ専用の文言。二度目からは普段の釣り上げ文に戻す
          const completedNow =
            !completedRef.current && isCollectionComplete(catches, caughtNamesRef.current)
          if (completedNow) completedRef.current = true
          setSpeech(completedNow ? text.fishing.complete : text.fishing.landed)
          // 巻物が水面の上に浮いている間だけ待ってから結果窓へ渡す
          landTimerRef.current = setTimeout(() => {
            landTimerRef.current = null
            setPhase('caught')
          }, FISHING_LAND_MS)
        }, FISHING_BITE_MS)
      }, FISHING_CAST_MS)
    },
    [phase, catches, text, setSpeech, reset]
  )

  const stop = useMemo<StopText | null>(() => {
    if (phase === 'caught' && caught !== null) return catchToStop(caught, text.fishing, roleLabels)
    return null
  }, [phase, caught, text, roleLabels])

  // アンマウント時にタイマーを残さない
  useEffect(() => reset, [reset])

  // ワープ(ワールド変更)では釣りを持ち越さない
  useEffect(() => {
    reset()
  }, [world, reset])

  return { phase, stop, at, start, reset }
}
