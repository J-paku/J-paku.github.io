// 村の描画。'use client'は村の入口であるこのファイル(と子の島)に置く。
// 状態と手は useVillage が組み立て、ここは受け取った値を枠・操作帯・重ね表示へ流し込むだけ
'use client'
import type { Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import type { Sheet } from '@/lib/pixel/art'
import { nextSpot } from '@/lib/village/spot'
import ActionButtons from './components/ActionButtons'
import Joystick from './components/Joystick'
import Minimap from './components/Minimap'
import SpeechBox from './components/SpeechBox'
import StopModal from './components/StopModal'
import TalkBubble from './components/TalkBubble'
import WorldMap from './components/WorldMap'
// Groundはscene.module.cssを読むので、CSSの出力順を変えないよう他の子より後に読み込む
import Ground from './components/Ground'
import { VIEW_COLS } from './hooks/use-stage-scale'
import { useVillage } from './hooks/use-village'
import { initialView } from './initial-view'
import styles from './scene.module.css'

type VillageProps = {
  lang: Locale
  worldSet: WorldSet
  text: VillageText
  sprites: Sheet
  // spot.id → 解決済みリンク。null はリンク無し
  stopHrefs: Record<string, string | null>
  stopExternal: Record<string, boolean>
  listHref: string
}

function Village({
  lang,
  worldSet,
  text,
  sprites,
  stopHrefs,
  stopExternal,
  listHref,
}: VillageProps) {
  const {
    rootRef,
    frameRef,
    worldLayerRef,
    controlsRef,
    playerRef,
    locatorRef,
    hintRef,
    loadingRef,
    camRef,
    world,
    destination,
    playerCell,
    visited,
    activeSpot,
    speech,
    reduceMotion,
    locatorVisible,
    placeNames,
    talkAt,
    talkText,
    talkLabel,
    hintText,
    mode,
    setHeld,
    scrollHeldRef,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
  } = useVillage({ worldSet, text, sprites })

  const {
    outdoors,
    rootStyle,
    frameStyle,
    worldStyle,
    startPose,
    playerStyle,
    locatorStyle,
    locatorSpriteStyle,
  } = initialView(world, sprites, reduceMotion)

  return (
    <div ref={rootRef} className={styles.root} style={rootStyle}>
      {/* シートの data URI はこの規則 1 本で解析させる(要素ごとの var() 展開を避ける) */}
      <style>{`.${styles.sprite}{background-image:url('${sprites.uri}')}`}</style>
      {/* 枠と操作帯をまとめる。横持ちの操作帯はこの箱を基準に枠の上辺へ重ねる */}
      <div className={styles.screen}>
        <div
          ref={frameRef}
          className={styles.frame}
          style={frameStyle}
          tabIndex={0}
          role='application'
          aria-roledescription='map'
          aria-label={text.hint}
          data-village
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          onPointerDown={event =>
            onPointerDown(event, event.currentTarget.clientWidth / VIEW_COLS, camRef.current)
          }
          onPointerMove={event =>
            onPointerMove(event, event.currentTarget.clientWidth / VIEW_COLS, camRef.current)
          }
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* data-world は描画済みワールドの印。rAF 側はこれが今のワールドと一致するまでカメラを動かさない */}
          {/* ワープ後の描画待ちが長引いた時だけ rAF 側が data-show を付ける。文言は持たず点滅の点だけ */}
          <div ref={loadingRef} className={styles.loading} aria-hidden='true'>
            <span />
            <span />
            <span />
          </div>
          <div
            ref={worldLayerRef}
            className={styles.world}
            style={worldStyle}
            data-world={world.id}
          >
            <Ground world={world} sprites={sprites} destination={destination} />
            <div
              ref={playerRef}
              data-village-player
              data-sprite={startPose.key}
              className={`${styles.sprite} ${styles.player}`}
              style={playerStyle}
              aria-hidden='true'
            />
            {locatorVisible ? (
              <div
                ref={locatorRef}
                className={styles.locator}
                style={locatorStyle}
                aria-hidden='true'
              >
                <div
                  className={`${styles.sprite} ${styles.locatorSprite}`}
                  style={locatorSpriteStyle}
                />
              </div>
            ) : null}
            {talkAt !== null && talkText !== null && mode !== 'talk' ? (
              <TalkBubble
                text={talkText}
                lang={lang}
                at={talkAt}
                actionLabel={talkLabel}
                onAction={openTalk}
              />
            ) : null}
            {hintText !== null ? (
              <div
                ref={hintRef}
                className={styles.hintAnchor}
                aria-hidden='false'
                // rAF が回り出すまでの土台。プレイヤーの今のマスへ先に置き、以後は毎フレーム上書きされる
                style={{
                  transform: `translate(calc(var(--cell) * ${playerCell.x}), calc(var(--cell) * ${playerCell.y}))`,
                }}
              >
                <TalkBubble text={hintText} lang={lang} at={{ x: 0.5, y: 0 }} kind='thought' />
              </div>
            ) : null}
          </div>
          <SpeechBox text={speech} lang={lang} />
          {mode === 'talk' && activeSpot !== null ? (
            <StopModal
              stop={text.stops[activeSpot.id]}
              href={stopHrefs[activeSpot.id] ?? null}
              external={stopExternal[activeSpot.id] ?? false}
              lang={lang}
              closeLabel={text.close}
              hasNext={nextSpot(worldSet, activeSpot) !== null}
              listHref={listHref}
              scrollHeldRef={scrollHeldRef}
              onNext={goNext}
              onClose={closeOverlay}
              returnTo={frameRef}
            />
          ) : null}
          {outdoors ? (
            <Minimap
              world={world}
              visited={visited}
              player={playerCell}
              destination={destination}
              placeNames={placeNames}
              label={text.openMap}
              onOpen={openMap}
            />
          ) : null}
        </div>
        <div ref={controlsRef} className={styles.controls} data-village-controls>
          <div className={styles.joystick}>
            <Joystick label={text.joystick} onHold={setHeld} />
          </div>
          <ActionButtons
            mode={mode}
            hasNext={activeSpot !== null && nextSpot(worldSet, activeSpot) !== null}
            labels={{ a: text.buttonA, b: text.buttonB }}
            onTalk={openTalk}
            onNext={goNext}
            onClose={closeOverlay}
          />
        </div>
      </div>
      {mode === 'map' && outdoors ? (
        <WorldMap
          world={world}
          visited={visited}
          player={playerCell}
          destination={destination}
          placeNames={placeNames}
          title={text.mapTitle}
          fastTravelLabel={text.fastTravel}
          closeLabel={text.closeMap}
          onTravel={travel}
          onClose={closeOverlay}
          returnTo={frameRef}
        />
      ) : null}
    </div>
  )
}

export default Village
