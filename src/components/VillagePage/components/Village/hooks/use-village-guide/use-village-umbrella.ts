// 雨の日の傘の段階を runtime.umbrellaPose へ書く。書くのはこのフックだけで、歩行ループはそれを毎フレーム読んで
// コマを選び、開け閉めの間は新しい移動を始めない。
// 扉を歩いて通る時は開け閉めの動きを挟み(扉の判定は use-village-arrive、要るかどうかは lib の planUmbrellaWarp)、
// 扉を通らずに傘の有無が決まる時(復元でワールドが替わった・天気が届いた)は動きなしの姿へすぐ合わせる。
// 外へ出て開く動きは、ワープした時ではなく新しいワールドの描画が確定した時から数える
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { World } from '@content/types/world'
import { UMBRELLA_CLOSE_MS, umbrellaBusy } from '@/lib/village/player-pose'
import { planUmbrellaWarp, restingUmbrella } from '@/lib/village/umbrella'
import type { VillageRuntime } from '../use-village-runtime'

type VillageUmbrellaOptions = {
  runtime: VillageRuntime
  // 今いるワールド(描画の値)。扉を通らずに替わった時もこれの変化で傘を合わせ直す
  world: World
  // 雨が降っているか(雪・晴れは傘を差さない)
  raining: boolean
  reduceMotion: boolean
}

type UseVillageUmbrella = {
  // 到着の処理が扉のワープで呼ぶ。warp はその扉のワープ処理一式(ワールドの入れ替えから案内の立て直しまで)で、
  // 傘を畳んでから入る時だけ畳み終えるまで遅らせて呼ぶ
  passDoor: (from: World, to: World, warp: () => void) => void
}

export function useVillageUmbrella({
  runtime,
  world,
  raining,
  reduceMotion,
}: VillageUmbrellaOptions): UseVillageUmbrella {
  // 扉の処理が今の天気を読む写し。到着の処理は描画より先に(rAF の中で)呼ばれるので ref で持つ
  const rainingRef = useRef(raining)
  // 傘を畳み終えてから扉に入るまでのタイマー。null は待っていない
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 外へ出る扉で開き始めた後、開く動きの起点を新しいワールドの描画の確定へ付け直すまで true
  const restampOpeningRef = useRef(false)

  // 待っている扉の処理を捨てる
  const cancelClosing = useCallback(() => {
    if (closingTimerRef.current === null) return
    clearTimeout(closingTimerRef.current)
    closingTimerRef.current = null
  }, [])

  // 畳み終えるのを待つ間にワールドが替わった・村を離れたら、待っていた扉の処理を持ち越さない
  useEffect(() => cancelClosing, [world, cancelClosing])

  // 扉を通らずに傘の有無が変わる所(復元でワールドが替わった・天気が届いた)で、動きなしの姿へ合わせる。
  // 開け閉めの最中は扉の処理が書いた値を上書きしない
  useEffect(() => {
    rainingRef.current = raining
    const { umbrellaPose: umbrellaPoseRef, wake: wakeRef } = runtime
    const pose = umbrellaPoseRef.current
    if (umbrellaBusy(pose, performance.now(), reduceMotion)) return
    const next = restingUmbrella(world, raining)
    if (pose === null && next === null) return
    umbrellaPoseRef.current = next
    wakeRef.current()
  }, [world, raining, reduceMotion, runtime])

  // 外へ出る扉では、開く動きの起点を新しいワールドの描画が確定した(React が DOM へ反映した)時刻へ付け直す。
  // ワープから確定までは React が新しい場面を描く時間で、その間の歩行ループはタイルが載るのを待って主人公を描かない。
  // ワープした時から数えると、遅い端末ほど最初のコマが見えないまま過ぎる(CPU を 4 倍遅くすると取り出すコマが丸ごと、
  // 6 倍で 2 コマが抜けていた)。錠(umbrellaBusy)も起点に従うので、付け直した分だけ後ろへ延びる。
  // useEffect ではなく useLayoutEffect なのは、rAF の中から始まった描画(既定の優先度)の useEffect は React が
  // 確定とは別のタスクへ回し、その合間の rAF で歩行ループが新しい場面を古い起点のまま描いてしまうため。
  // 確定と同じタスクで付け直せば、新しいタイルを見るフレームは必ず付け直した起点で描く
  useLayoutEffect(() => {
    if (!restampOpeningRef.current) return
    restampOpeningRef.current = false
    const { umbrellaPose: umbrellaPoseRef, wake: wakeRef } = runtime
    if (umbrellaPoseRef.current?.phase !== 'opening') return
    umbrellaPoseRef.current = { phase: 'opening', since: performance.now() }
    wakeRef.current()
  }, [world, runtime])

  const passDoor = useCallback(
    (from: World, to: World, warp: () => void) => {
      // 畳み終えるのを待つ間に同じ扉へまたぶつかっても(押しっぱなしの足踏み)、扉の処理を二重に予約しない
      if (closingTimerRef.current !== null) return
      const { umbrellaPose: umbrellaPoseRef, locked: lockedRef, wake: wakeRef } = runtime
      const plan = planUmbrellaWarp(from, to, rainingRef.current)
      if (plan === 'close-before' && !reduceMotion) {
        // 扉の前で立ち止まって傘を畳み、畳み終えてから中へ入る。畳む間の足止めは歩行ループが umbrellaBusy で行う
        umbrellaPoseRef.current = { phase: 'closing', since: performance.now() }
        wakeRef.current()
        closingTimerRef.current = setTimeout(() => {
          closingTimerRef.current = null
          // 畳んでいる間に地図・窓を開いたら中へは入らず、傘を差した姿で扉の前に戻す。
          // 地図は屋外でしか描かないので、開いた地図の下で部屋へ入ると窓の無いまま移動だけ止まってしまう
          if (lockedRef.current) {
            umbrellaPoseRef.current = restingUmbrella(from, rainingRef.current)
          } else {
            warp()
            umbrellaPoseRef.current = restingUmbrella(to, rainingRef.current)
          }
          wakeRef.current()
        }, UMBRELLA_CLOSE_MS)
        return
      }
      warp()
      // 外へ出た直後は傘を取り出して開く。動きを控える設定では開け閉めのコマを飛ばし、着いた先の姿にする。
      // ここで書く起点は描画が確定するまでの仮の値で、ワープした時から錠を掛けておくためにある
      // (本当の起点は上の useLayoutEffect が付け直す)
      const opening = plan === 'open-after' && !reduceMotion
      restampOpeningRef.current = opening
      umbrellaPoseRef.current = opening
        ? { phase: 'opening', since: performance.now() }
        : restingUmbrella(to, rainingRef.current)
      wakeRef.current()
    },
    [runtime, reduceMotion]
  )

  return { passDoor }
}
