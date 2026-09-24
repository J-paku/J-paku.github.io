// rAFで移動を1フレームずつ進め、結果をDOMへ直接書く。タップされたマスは経路にして次のステップへ渡す。
// 入力も経路も無く描き終えたら次のフレームを頼まずに眠り、入力・ワールド移動・窓を閉じる・
// 釣りの段階の切り替わり・枠の大きさの変化で runtime.wake から起こされる。
// 読み書きする ref は village-runtime の束 2 つ(runtime と dom)で受け取る。
// このファイルは React との継ぎ目(ref・effect・依存配列)だけを持ち、1 フレームの中身は utils/ の部品へ任せる。
// 部品を平らな関数にしておくと、どの値がフレームをまたいで残るのか(WalkFrameState)が 1 か所で見える
import { useCallback, useEffect, useRef } from 'react'
import type { Cell } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import type { VillageDom, VillageRuntime } from '../village-runtime'
import { createAnimationLoop } from './utils/animation-loop'
import { paintCamera } from './utils/camera-renderer'
import { notifyFishingTarget } from './utils/fishing-target'
import { paintLampVeil } from './utils/lamp-veil-renderer'
import { tickFrame } from './utils/movement-controller'
import { placePlayer, writePose } from './utils/player-renderer'
import { queueTapRoute } from './utils/pointer-pathing'
import type { WalkFrameState } from './utils/types'
import { waitForWorldTiles } from './utils/world-transition-renderer'

export type WalkLoopOptions = {
  // runtime.wake はこのフックが今のループの手を入れる置き場。入力・復元・重ね表示はこのフックより先
  // (または外)で呼ばれるので、そこ越しに起こす
  runtime: VillageRuntime
  // 毎フレーム直接書く DOM。人物・目印・吹き出しの土台・灯りは同じ transform を受けて付いて回る
  dom: VillageDom
  onFishingTarget: (cell: Cell | null) => void
  sprites: SheetLayout
  // ワールドのスプライトシート。街灯の添字を引くのに使う(主人公の 16×24 シートとは別物)
  veilSprites: SheetLayout
  reduceMotion: boolean
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
  tapped: Cell | null
  consumeTap: () => void
}

export function useWalkLoop({
  runtime,
  dom,
  onFishingTarget,
  sprites,
  veilSprites,
  reduceMotion,
  arrive,
  bump,
  tapped,
  consumeTap,
}: WalkLoopOptions): void {
  // フレームをまたいで残す値。各項目の意味は WalkFrameState の型に書いてある
  const frameStateRef = useRef<WalkFrameState>({
    spriteKey: '',
    fishingTarget: null,
    waitSince: null,
    enteredWorld: null,
    ignoreHeld: false,
    plannedTarget: null,
    staleTarget: false,
    smoothedCam: null,
    paintedWorld: null,
    shift: '',
    lastTransform: '',
    frameWidth: null,
    veilCell: '',
    veilId: '',
  })

  // 人物のコマと反転を書き直す。まだコマが時間で変わる間は true(ループを眠らせない)
  const applyPose = useCallback(
    (): boolean =>
      writePose(frameStateRef.current, {
        playerRef: dom.player,
        stateRef: runtime.state,
        fishingPoseRef: runtime.fishingPose,
        reduceMotion,
        sprites,
      }),
    [sprites, reduceMotion, dom, runtime]
  )

  // 毎フレームの書き込みは DOM 直更新。React の state は到着時だけ動かす。
  // 描き終えて時間で変わるものが残っていなければ true を返す
  // (新しいワールドのタイルが載り、カメラが目標に追い付き、竿のコマもその段階の分を進み切った)
  const paint = useCallback(
    (dtMs: number): boolean => {
      const frame = dom.frame.current
      const player = dom.player.current
      if (frame === null || player === null) return false
      const frameState = frameStateRef.current
      const state = runtime.state.current
      const world = runtime.world.current
      notifyFishingTarget(frameState, world, state, onFishingTarget)
      const layer = dom.worldLayer.current
      if (!waitForWorldTiles(frameState, layer, dom.loading.current, world)) return false
      paintLampVeil(frameState, dom.lampVeil, world, state.cell, veilSprites)
      const camera = paintCamera(
        frameState,
        { frame, layer, camRef: dom.cam },
        world,
        state,
        reduceMotion,
        dtMs
      )
      const posing = placePlayer(
        frameState,
        { locatorRef: dom.locator, hintRef: dom.hint, playerLightRef: dom.playerLight },
        camera,
        applyPose
      )
      return !posing && camera.caughtUp
    },
    [applyPose, reduceMotion, dom, runtime, veilSprites, onFishingTarget]
  )

  useEffect(() => {
    const loop = createAnimationLoop(
      elapsed =>
        tickFrame(frameStateRef.current, runtime, { applyPose, paint, arrive, bump }, elapsed),
      dom.frame
    )
    const wake = loop.wake
    runtime.wake.current = wake
    loop.start()
    return () => {
      loop.stop()
      // 外したループを起こさない。後始末の後に届いた入力で、描く先の無いループが回り出すのを防ぐ
      if (runtime.wake.current === wake) runtime.wake.current = () => {}
    }
  }, [arrive, bump, paint, applyPose, runtime, dom])

  // 枠の幅を覚え、変わったらループを起こして新しいマス寸法で描き直させる。
  // 幅を読むのは大きさが変わった時だけで、描く側は毎フレーム覚えた値を使う
  useEffect(() => {
    const frame = dom.frame.current
    if (frame === null) return
    const observer = new ResizeObserver(() => {
      frameStateRef.current.frameWidth = frame.clientWidth
      runtime.wake.current()
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [dom, runtime])

  // タップ → 経路を作って次のステップへ渡す。通れない場所は無視
  useEffect(() => {
    if (tapped === null) return
    if (queueTapRoute(runtime, tapped)) runtime.wake.current()
    consumeTap()
  }, [tapped, consumeTap, runtime])
}
