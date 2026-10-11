// 村の描画。'use client'は村の入口であるこのファイル(と子の島)に置く。
// 状態と手は useVillage が組み立て、ここは受け取った値を枠・操作帯・重ね表示へ流し込むだけ
'use client'
import type { ReactNode } from 'react'
import type { CareerFeature, CareerRole, Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
// 子の CSS は、子を初めて読み込んだ順に出力される。WorldLayer が描く Lighting・TalkBubble も
// この並びの位置を保つためだけにここで読み込む(値は使わない。消すと CSS の出力順が変わる)
import ActionButtons from './components/ActionButtons'
import ClockModal from './components/ClockModal'
import Joystick from './components/Joystick'
import './components/Lighting'
import Minimap from './components/Minimap'
import SpeechBox from './components/SpeechBox'
import StopModal from './components/StopModal'
import './components/TalkBubble'
import Weather, { type WeatherSheets } from './components/Weather'
import WorldMap from './components/WorldMap'
// WorldLayer は scene.module.css を読む Ground・FishingFloat・LampVeil を抱えるので、
// CSS の出力順を変えないよう他の子より後に読み込む
import WorldLayer from './components/WorldLayer'
import { useDayPhase, type PhaseSheets } from './hooks/use-day-phase'
import { useVillage } from './hooks/use-village'
import { useWeather } from './hooks/use-weather'
import { initialView } from './utils/initial-view'
import { pickDialog } from './utils/pick-dialog'
import styles from './scene.module.css'

type VillageProps = {
  lang: Locale
  worldSet: WorldSet
  text: VillageText
  // 配置用の添字と寸法だけ。画像 URI は VillagePage の <style> が持つので重複して送らない
  sprites: SheetLayout
  // 主人公だけ32×32の画布の別シート(体の16×24の周りに傘を描く余白を持つ)の配置情報
  playerSprites: SheetLayout
  weatherSprites: WeatherSheets
  phaseSheets: PhaseSheets
  // 一覧への出口リンク。縦持ちタッチでは枠のすぐ下に横長で置くので Village の中で描く
  exit: ReactNode
  // spot.id → 解決済みリンク。null はリンク無し
  stopHrefs: Record<string, string | null>
  stopExternal: Record<string, boolean>
  listHref: string
  // 池で釣り上げる中身(現職の機能一覧)と、その工程の名前。文言は VillagePage が content から写す
  catches: readonly CareerFeature[]
  roleLabels: Record<CareerRole, string>
}

function Village({
  lang,
  worldSet,
  text,
  sprites,
  playerSprites,
  weatherSprites,
  phaseSheets,
  exit,
  stopHrefs,
  stopExternal,
  listHref,
  catches,
  roleLabels,
}: VillageProps) {
  const phase = useDayPhase(phaseSheets)
  const weather = useWeather()
  const {
    rootRef,
    frameRef,
    worldLayerRef,
    controlsRef,
    exitRef,
    playerRef,
    locatorRef,
    hintRef,
    playerLightRef,
    flightShadowRef,
    lampVeilRef,
    loadingRef,
    world,
    destination,
    playerCell,
    visited,
    activeSpot,
    speech,
    hintLabel,
    reduceMotion,
    locatorVisible,
    placeNames,
    doors,
    entries,
    talkAt,
    talkText,
    talkLabel,
    talkKind,
    talkAction,
    hintText,
    mode,
    fishing,
    setHeld,
    scrollHeldRef,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    openMap,
    closeOverlay,
    travel,
    travelTo,
    hasNext,
    onNext,
    pressA,
    pressB,
    announce,
  } = useVillage({
    worldSet,
    text,
    sprites,
    playerSprites,
    catches,
    roleLabels,
    // 傘を差すのは雨の時だけ(雪・晴れは差さない)
    raining: weather === 'rain',
  })

  const {
    outdoors,
    rootStyle,
    frameStyle,
    worldStyle,
    startPose,
    playerStyle,
    startShift,
    locatorStyle,
    locatorSpriteStyle,
  } = initialView(world, sprites, playerSprites, reduceMotion)

  // 会話窓に出す中身。地点の会話か釣りの窓かをここで 1 つに決め、StopModal は 1 か所だけで描く。
  // 「次へ」の有無と行き先(hasNext・onNext)は A ボタンと共用するので use-village が持つ。
  const dialog = pickDialog({
    mode,
    activeSpot,
    fishingStop: fishing.stop,
    text,
    stopHrefs,
    stopExternal,
  })

  return (
    // data-phase は VillagePage のインラインスクリプトが初回描画の前に書き換える。
    // hydration 時点の React 側はまだ既定の 'day' なので、この要素の属性差分は警告対象から外す
    <div
      ref={rootRef}
      className={styles.root}
      style={rootStyle}
      data-phase={phase}
      suppressHydrationWarning
    >
      {/* 枠と操作帯をまとめる。横持ちの操作帯はこの箱を基準に枠の上辺へ重ねる */}
      <div className={styles.screen}>
        <div
          ref={frameRef}
          className={styles.frame}
          style={frameStyle}
          tabIndex={0}
          role='application'
          aria-roledescription='map'
          aria-label={hintLabel}
          data-village
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* ワープ後の描画待ちが長引いた時だけ rAF 側が data-show を付ける。文言は持たず点滅の点だけ */}
          <div ref={loadingRef} className={styles.loading} aria-hidden='true'>
            <span />
            <span />
            <span />
          </div>
          <WorldLayer
            worldLayerRef={worldLayerRef}
            world={world}
            sprites={sprites}
            lang={lang}
            mode={mode}
            destination={destination}
            playerCell={playerCell}
            fishing={fishing}
            locatorVisible={locatorVisible}
            talkAt={talkAt}
            talkText={talkText}
            talkLabel={talkLabel}
            talkKind={talkKind}
            talkAction={talkAction}
            hintText={hintText}
            worldStyle={worldStyle}
            startShift={startShift}
            startPose={startPose}
            playerStyle={playerStyle}
            locatorStyle={locatorStyle}
            locatorSpriteStyle={locatorSpriteStyle}
            playerRef={playerRef}
            flightShadowRef={flightShadowRef}
            playerLightRef={playerLightRef}
            lampVeilRef={lampVeilRef}
            locatorRef={locatorRef}
            hintRef={hintRef}
          />
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
        </div>
        {/* 縦持ちタッチでは枠と帯の間に横長で並び、useStageScale がこの高さも差し引く。それ以外は箱を作らない */}
        <div ref={exitRef} className={styles.exitSlot} data-village-exit-slot>
          {exit}
        </div>
        <div ref={controlsRef} className={styles.controls} data-village-controls>
          <div className={styles.joystick}>
            <Joystick label={text.joystick} onHold={setHeld} />
          </div>
          <ActionButtons labels={{ a: text.buttonA, b: text.buttonB }} onA={pressA} onB={pressB} />
        </div>
      </div>
      {mode === 'map' && outdoors ? (
        <WorldMap
          world={world}
          visited={visited}
          player={playerCell}
          destination={destination}
          placeNames={placeNames}
          doors={doors}
          entries={entries}
          title={text.mapTitle}
          fastTravelLabel={text.fastTravel}
          closeLabel={text.closeMap}
          onTravel={travel}
          onTravelTo={travelTo}
          onClose={closeOverlay}
          returnTo={frameRef}
          scrollHeldRef={scrollHeldRef}
        />
      ) : null}
    </div>
  )
}

export default Village
