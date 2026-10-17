// 村の表示部品。状態・計算済みの見た目・操作の手はコンテナから受け取り、同じ DOM へ並べる。
import type { ComponentProps, HTMLAttributes, ReactNode, RefObject } from 'react'
import type { DayPhase } from '@/utils/day-phase'
// 子の CSS は、子を初めて読み込んだ順に出力される。WorldLayer・FrameOverlays が描く部品も
// この並びの位置を保つためだけにここで読み込む(値は使わない。消すと CSS の出力順が変わる)
import ActionButtons from './components/ActionButtons'
import './components/ClockModal/container'
import Joystick from './components/Joystick/container'
import './components/Lighting/container'
import './components/Minimap'
import './components/SpeechBox'
import './components/StopModal/container'
import './components/TalkBubble'
import './components/Weather'
import WorldMap, { type WorldMapProps } from './components/WorldMap'
import FrameOverlays, { type FrameOverlaysProps } from './components/FrameOverlays'
// WorldLayer は scene.module.css を読む Ground・FishingFloat・LampVeil を抱えるので、
// CSS の出力順を変えないよう他の子より後に読み込む
import WorldLayer, { type WorldLayerProps } from './components/WorldLayer'
import type { InitialView } from './utils/initial-view'
import styles from './scene.module.css'

type VillageProps = WorldLayerProps &
  FrameOverlaysProps &
  InitialView &
  Pick<
    HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'onKeyUp' | 'onBlur' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp'
  > & {
    phase: DayPhase
    rootRef: RefObject<HTMLDivElement | null>
    controlsRef: RefObject<HTMLDivElement | null>
    exitRef: RefObject<HTMLDivElement | null>
    loadingRef: RefObject<HTMLDivElement | null>
    hintLabel: string
    exit: ReactNode
    entries: WorldMapProps['entries']
    travel: WorldMapProps['onTravel']
    travelTo: WorldMapProps['onTravelTo']
    setHeld: ComponentProps<typeof Joystick>['onHold']
    pressA: () => void
    pressB: () => void
  }

function Village({
  lang,
  text,
  sprites,
  weatherSprites,
  exit,
  listHref,
  phase,
  weather,
  dialog,
  clock,
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
  speech,
  hintLabel,
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
  outdoors,
  rootStyle,
  frameStyle,
  worldStyle,
  startPose,
  playerStyle,
  startShift,
  locatorStyle,
  locatorSpriteStyle,
}: VillageProps) {
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
          <FrameOverlays
            lang={lang}
            text={text}
            clock={clock}
            mode={mode}
            outdoors={outdoors}
            weather={weather}
            weatherSprites={weatherSprites}
            speech={speech}
            dialog={dialog}
            hasNext={hasNext}
            listHref={listHref}
            world={world}
            visited={visited}
            playerCell={playerCell}
            destination={destination}
            placeNames={placeNames}
            doors={doors}
            frameRef={frameRef}
            scrollHeldRef={scrollHeldRef}
            onNext={onNext}
            closeOverlay={closeOverlay}
            openMap={openMap}
            announce={announce}
          />
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
