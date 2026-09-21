// 釣りの進み具合(投げる → かかる → 釣り上げる)と、窓に出す文言・浮きを置くマスだけを持つ。
// この状態は村の画面の外から読まないので、store は立てずにこのフックの中の state・ref で閉じる。
// 釣った一覧は保存しない(タブを開いている間だけ覚える)。訪問記録と違って進行の鍵ではなく、
// 開き直す度に最初から釣り集められる方が何度でも遊べるため。全部を釣り上げた後(exhausted)も
// 同じ間だけ投げさせず、開き直せばまた一から釣れる
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
  // 全部を釣り上げたか。最後の 1 つを釣り上げて結果窓に出した瞬間に立ち、釣った一覧と同じく
  // タブを開いている間は下ろさない。立っている間は start が何もしない
  exhausted: boolean
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
  const [exhausted, setExhausted] = useState(false)
  // これまでに釣り上げた名前。まだ釣っていない物を先に出すため pickCatch へ渡す
  const caughtNamesRef = useRef(new Set<string>())
  // 全部を釣り上げて結果窓に出したか。出した後は揃った時の文言へ差し替えない。
  // タイマーの中は投げた時の描画の値しか見えないので、state の exhausted ではなくこちらで判定する
  const completedRef = useRef(false)
  // 投げてから「かかった」まで・かかってから釣り上げるまで・巻物が水面に浮いている間のタイマー
  const castTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // タイマーと釣果をまとめて捨てる。釣った一覧と exhausted はこの回限りの物ではないので残す
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
      // 全部を釣り上げた後は投げない。openTalk が先に止めるので通常は来ない。来ても投げはしない
      if (exhausted) return
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
          // まだ釣っていない物から選ぶ。全部を釣り上げた後は start が投げないので、
          // ここへ来る時は必ず釣り残しがある
          const picked = pickCatch(catches, caughtNamesRef.current)
          // 釣れる中身が無い時は窓を出さず、静かに元へ戻す
          if (picked === null) {
            reset()
            return
          }
          setCaught(picked)
          setPhase('landing')
          // 釣った物として数えるのは結果窓に出した物だけ。巻物が浮いている間に閉じた物は釣っていない
          // 扱いで、また釣れる。ここではまだ数えず、これで全部が揃うかどうかだけを見て会話窓の文言を選ぶ
          const completesNow =
            !completedRef.current &&
            isCollectionComplete(catches, new Set([...caughtNamesRef.current, picked.name]))
          setSpeech(completesNow ? text.fishing.complete : text.fishing.landed)
          // 巻物が水面の上に浮いている間だけ待ってから結果窓へ渡し、ここで初めて数える。
          // 揃ったなら exhausted も立てる。結果窓と同じ描画で立つので最後の 1 つの窓は「もう一度」を
          // 言わず、以後は start が投げないので、閉じて歩きに戻った後の水辺は考え事の吹き出しに替わる
          landTimerRef.current = setTimeout(() => {
            landTimerRef.current = null
            caughtNamesRef.current.add(picked.name)
            if (completesNow) {
              completedRef.current = true
              setExhausted(true)
            }
            setPhase('caught')
          }, FISHING_LAND_MS)
        }, FISHING_BITE_MS)
      }, FISHING_CAST_MS)
    },
    [exhausted, phase, catches, text, setSpeech, reset]
  )

  const stop = useMemo<StopText | null>(() => {
    if (phase === 'caught' && caught !== null)
      return catchToStop(caught, text.fishing, roleLabels, exhausted)
    return null
  }, [phase, caught, text, roleLabels, exhausted])

  // アンマウント時にタイマーを残さない
  useEffect(() => reset, [reset])

  // ワープ(ワールド変更)では釣りを持ち越さない
  useEffect(() => {
    reset()
  }, [world, reset])

  return { phase, stop, at, exhausted, start, reset }
}
