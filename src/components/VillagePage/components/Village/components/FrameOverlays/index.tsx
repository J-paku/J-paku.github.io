// 枠(data-village)の直下で world 層の上に重ねる物。雨・雪、下端の案内文、会話窓、卓上時計の窓、
// ミニマップをこの順で並べる。どれも枠に対して動かないので、カメラと一緒に動く world 層の外に置く。
// 状態と手は Village の useVillage が組み立て、ここは受け取った値を置くだけ(フックを呼ばない)
'use client'
import type { RefObject } from 'react'
import type { Locale } from '@content/types/content'
import type { Cell, Direction, VillageText, World } from '@content/types/world'
import type { DoorMarker } from '@/lib/village/door-marker'
import ClockModal, { type ClockModalProps } from '../ClockModal'
import Minimap from '../Minimap'
import SpeechBox from '../SpeechBox'
import StopModal from '../StopModal'
import Weather, { type WeatherProps, type WeatherSheets } from '../Weather'
import type { Dialog } from '../../utils/pick-dialog'

export type FrameOverlaysProps = {
  lang: Locale
  text: VillageText
  clock: ClockModalProps['clock']
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  // 屋外か。屋内(自室・建物の中)では雨・雪もミニマップも出さない
  outdoors: boolean
  weather: WeatherProps['kind']
  weatherSprites: WeatherSheets
  // 枠の下端の案内文(role='status')の一言
  speech: string
  // 会話窓に出す中身。null の間は出さない(地点の会話か釣りの窓かは Village が pickDialog で決める)
  dialog: Dialog | null
  hasNext: boolean
  listHref: string
  // ミニマップに描く地形・訪れた地点・主人公の位置・行き先・地点名・扉
  world: World
  visited: ReadonlySet<string>
  playerCell: Cell
  destination: Cell | null
  placeNames: Record<string, string>
  doors: readonly DoorMarker[]
  // 窓を閉じた時に焦点を戻す先(枠)
  frameRef: RefObject<HTMLDivElement | null>
  // スティックの押しっぱなしの向き。会話窓と時計の窓が同じ ref を読む
  scrollHeldRef: RefObject<Direction | null>
  onNext: () => void
  closeOverlay: () => void
  openMap: () => void
  announce: (message: string) => void
}

export function FrameOverlays({
  lang,
  text,
  clock,
  mode,
  outdoors,
  weather,
  weatherSprites,
  speech,
  dialog,
  hasNext,
  listHref,
  world,
  visited,
  playerCell,
  destination,
  placeNames,
  doors,
  frameRef,
  scrollHeldRef,
  onNext,
  closeOverlay,
  openMap,
  announce,
}: FrameOverlaysProps) {
  return (
    <>
      {/* 雨・雪は world 層ではなく枠の子。枠は表示領域(10×9)ぶんしかないので、町 30×20 を
          抱える world 層に敷くより描き替える面積が小さく、毎フレーム動く層の再描画にも巻き込まれない。
          屋内(自室・建物の中)は天井があるので降らせない */}
      {outdoors ? <Weather kind={weather} sheets={weatherSprites} /> : null}
      <SpeechBox text={speech} lang={lang} />
      {dialog !== null ? (
        <StopModal
          stop={dialog.stop}
          href={dialog.href}
          external={dialog.external}
          lang={lang}
          closeLabel={dialog.closeLabel}
          hasNext={hasNext}
          listHref={listHref}
          scrollHeldRef={scrollHeldRef}
          onNext={onNext}
          onClose={closeOverlay}
          returnTo={frameRef}
        />
      ) : null}
      {/* 卓上時計の設定窓。会話窓と同じく枠の中に重ね、結果は案内文の一言として伝える */}
      {mode === 'clock' ? (
        <ClockModal
          text={text.clock}
          clock={clock}
          lang={lang}
          announce={announce}
          onClose={closeOverlay}
          returnTo={frameRef}
          scrollHeldRef={scrollHeldRef}
        />
      ) : null}
      {outdoors ? (
        <Minimap
          world={world}
          visited={visited}
          player={playerCell}
          destination={destination}
          placeNames={placeNames}
          doors={doors}
          label={text.openMap}
          onOpen={openMap}
        />
      ) : null}
    </>
  )
}

export default FrameOverlays
