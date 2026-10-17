// 枠の中の world 層(.world。カメラの transform が掛かる層)と、その中に重ねる物。
// 地面・灯り・釣りの浮き・飛ぶ間の影・主人公・街灯の重ね・目印・吹き出しをこの順で並べる。
// 同じ高さ(z)の間では後に置いた物が手前に出るので、並びを入れ替えない(理由は各要素の上の注釈)。
// 状態と手は Village の useVillage が組み立て、ここは受け取った値を置くだけ(フックを呼ばない)
'use client'
import type { RefObject } from 'react'
import type { Locale } from '@content/types/content'
import type { Cell, World } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import Lighting from '../Lighting/container'
import TalkBubble from '../TalkBubble/container'
// Ground・FishingFloat・LampVeilはscene.module.cssを読むので、CSSの出力順を変えないよう他の子より後に読み込む
import Ground from '../Ground/container'
import FishingFloat, { type FishingFloatProps } from '../FishingFloat'
import LampVeil from '../LampVeil'
import { cellShift, type InitialView } from '../../utils/initial-view'
import styles from '../../scene.module.css'

export type WorldLayerProps = {
  // world 層そのもの。カメラの transform と描画済みの印(data-world)の照合は use-walk-loop がこの層で行う
  worldLayerRef: RefObject<HTMLDivElement | null>
  world: World
  sprites: SheetLayout
  lang: Locale
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  destination: Cell | null
  // 主人公の今のマス。釣り糸の根元と、考え事の吹き出しの土台の最初の位置に使う
  playerCell: Cell
  // 釣りの進み具合と浮きを置く水のマス。釣っていない間は at が null
  fishing: { at: Cell | null; phase: FishingFloatProps['phase'] }
  locatorVisible: boolean
  // 話しかける物の上の吹き出し。位置か台詞が null の間と、会話(mode が 'talk')の間は出さない
  talkAt: { x: number; y: number } | null
  talkText: string | null
  talkLabel: string | undefined
  talkKind: 'speech' | 'thought'
  talkAction: () => void
  // 話せる相手がいない時の考え事。null の間は出さない
  hintText: string | null
  // rAF が回り出すまでの見た目(utils/initial-view)。以後は use-walk-loop が DOM へ直接書く
  worldStyle: InitialView['worldStyle']
  startShift: InitialView['startShift']
  startPose: InitialView['startPose']
  playerStyle: InitialView['playerStyle']
  locatorStyle: InitialView['locatorStyle']
  locatorSpriteStyle: InitialView['locatorSpriteStyle']
  // use-walk-loop が rAF の中で直接書く要素(VillagePage/AGENTS.md 守ること 5)
  playerRef: RefObject<HTMLDivElement | null>
  flightShadowRef: RefObject<HTMLDivElement | null>
  playerLightRef: RefObject<HTMLDivElement | null>
  lampVeilRef: RefObject<HTMLDivElement | null>
  locatorRef: RefObject<HTMLDivElement | null>
  hintRef: RefObject<HTMLDivElement | null>
}

export function WorldLayer({
  worldLayerRef,
  world,
  sprites,
  lang,
  mode,
  destination,
  playerCell,
  fishing,
  locatorVisible,
  talkAt,
  talkText,
  talkLabel,
  talkKind,
  talkAction,
  hintText,
  worldStyle,
  startShift,
  startPose,
  playerStyle,
  locatorStyle,
  locatorSpriteStyle,
  playerRef,
  flightShadowRef,
  playerLightRef,
  lampVeilRef,
  locatorRef,
  hintRef,
}: WorldLayerProps) {
  return (
    // data-world は描画済みワールドの印。rAF 側はこれが今のワールドと一致するまでカメラを動かさない
    <div ref={worldLayerRef} className={styles.world} style={worldStyle} data-world={world.id}>
      {/* Ground は添字計算にしか使わない(index・count は4段階とも共通)。
          背景URLは VillagePage が置いた<style>が担う */}
      <Ground world={world} sprites={sprites} destination={destination} />
      {/* 夜の灯り。地面の上・目印(z 1)と主人公(z 2)の下に敷く層で、
          主人公の持つ灯りだけは use-walk-loop が人物と同じ transform を毎フレーム書く
          (rAF が回るまでの土台として、人物・目印と同じ startShift を渡す)。
          昼夜の出し分けは Lighting 側の [data-phase='night'] が受け持つ */}
      <Lighting world={world} playerLightRef={playerLightRef} startShift={startShift} />
      {/* 水面の浮きと釣り上げた巻物。灯りの上・主人公(z 2)の下に置く。
          釣っていない間は置くマスが決まらない(at が null)ので何も描かない。
          糸は主人公の立つマス(from)から浮きまで渡す。
          釣っている間は歩けないので、立つマスは playerCell のままでよい */}
      {fishing.at !== null ? (
        <FishingFloat at={fishing.at} from={playerCell} phase={fishing.phase} sprites={sprites} />
      ) : null}
      {/* 自動の移動で飛んでいる間に地上の位置を示す影。主人公の手前の兄弟に置き、主人公(z 2)の下に描く。
          位置と縮み・data-flying は use-walk-loop が rAF の中で書く(影は浮かせない)。
          飛んでいない間は data-flying='false' で CSS が隠す */}
      <div
        ref={flightShadowRef}
        data-flight-shadow
        data-flying='false'
        className={styles.flightShadow}
        aria-hidden='true'
      />
      <div
        ref={playerRef}
        data-village-player
        data-sprite={startPose.key}
        className={styles.player}
        style={playerStyle}
        aria-hidden='true'
      />
      {/* 街灯は柱の立つ下のマスだけが通れず、灯のある上のマス(笠の裏)は通れる。
          そこに立つと主人公が街灯を塗り潰すので、重なった街灯1本ぶん(上下2マス)を
          主人公(z 2)の上へ薄く重ねて、街灯の向こうに主人公を透かす。
          どの街灯に重なるかは規則の層が決め、書き込みは use-walk-loop が rAF の中で行う。
          吹き出し(z 3)より先に置くので、会話の吹き出しはこの層より手前に出る */}
      <LampVeil veilRef={lampVeilRef} />
      {locatorVisible ? (
        <div ref={locatorRef} className={styles.locator} style={locatorStyle} aria-hidden='true'>
          <div className={`${styles.sprite} ${styles.locatorSprite}`} style={locatorSpriteStyle} />
        </div>
      ) : null}
      {talkAt !== null && talkText !== null && mode !== 'talk' ? (
        <TalkBubble
          text={talkText}
          lang={lang}
          at={talkAt}
          actionLabel={talkLabel}
          onAction={talkAction}
          kind={talkKind}
        />
      ) : null}
      {hintText !== null ? (
        <div
          ref={hintRef}
          className={styles.hintAnchor}
          aria-hidden='false'
          // rAF が回り出すまでの土台。プレイヤーの今のマスへ先に置き、以後は毎フレーム上書きされる
          style={{ transform: cellShift(playerCell) }}
        >
          {/* 頭はマスの上へ半マスはみ出すので、吹き出しはその分だけ上に付ける */}
          <TalkBubble text={hintText} lang={lang} at={{ x: 0.5, y: -0.5 }} kind='thought' />
        </div>
      ) : null}
    </div>
  )
}

export default WorldLayer
