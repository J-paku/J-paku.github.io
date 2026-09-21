// 釣りの進み具合(確認 → 投げる → かかる)と、窓に出す文言だけを持つ。
// この状態は村の画面の外から読まないので、store は立てずにこのフックの中の state・ref で閉じる
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { StopText, VillageText, World } from '@content/types/world'
import {
  catchToStop,
  confirmStop,
  FISHING_BITE_MS,
  FISHING_CAST_MS,
  pickCatch,
} from '@/lib/village/fishing'

export type FishingPhase = 'idle' | 'confirm' | 'casting' | 'caught'

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
  // 確認窓・結果窓に出す文言。それ以外の間は null
  stop: StopText | null
  start: () => void
  cast: () => void
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
  // 直前に釣り上げた名前。同じ物が続けて出ないように pickCatch へ渡す
  const lastNameRef = useRef<string | null>(null)
  // 投げてから「かかった」までと、その後に釣り上げるまでのタイマー
  const castTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // タイマーと釣果をまとめて捨てる
  const reset = useCallback(() => {
    if (castTimerRef.current !== null) {
      clearTimeout(castTimerRef.current)
      castTimerRef.current = null
    }
    if (biteTimerRef.current !== null) {
      clearTimeout(biteTimerRef.current)
      biteTimerRef.current = null
    }
    setPhase('idle')
    setCaught(null)
  }, [])

  // 確認窓を開く。前の回のタイマーが残っていれば先に捨てる
  const start = useCallback(() => {
    reset()
    setPhase('confirm')
  }, [reset])

  const cast = useCallback(() => {
    // 「釣る」は確認窓からだけ。投げている最中の連打は捨てる
    if (phase !== 'confirm') return
    setPhase('casting')
    setSpeech(text.fishing.cast)
    castTimerRef.current = setTimeout(() => {
      castTimerRef.current = null
      setSpeech(text.fishing.bite)
      biteTimerRef.current = setTimeout(() => {
        biteTimerRef.current = null
        const picked = pickCatch(catches, lastNameRef.current)
        // 釣れる中身が無い時は窓を出さず、静かに元へ戻す
        if (picked === null) {
          reset()
          return
        }
        lastNameRef.current = picked.name
        setCaught(picked)
        setPhase('caught')
      }, FISHING_BITE_MS)
    }, FISHING_CAST_MS)
  }, [phase, catches, text, setSpeech, reset])

  const stop = useMemo<StopText | null>(() => {
    if (phase === 'confirm') return confirmStop(text.fishing)
    if (phase === 'caught' && caught !== null) return catchToStop(caught, text.fishing, roleLabels)
    return null
  }, [phase, caught, text, roleLabels])

  // アンマウント時にタイマーを残さない
  useEffect(() => reset, [reset])

  // ワープ(ワールド変更)では釣りを持ち越さない
  useEffect(() => {
    reset()
  }, [world, reset])

  return { phase, stop, start, cast, reset }
}
