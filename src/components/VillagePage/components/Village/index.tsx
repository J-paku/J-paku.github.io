// 村の描画。'use client'は村の入口であるこのファイル(と子の島)に置く。
// 状態と手は useVillage が組み立て、ここは受け取った値を枠・操作帯・重ね表示へ流し込むだけ
'use client'
import type { ReactNode } from 'react'
import type { Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { nextSpot } from '@/lib/village/spot'
import ActionButtons from './components/ActionButtons'
import Joystick from './components/Joystick'
import Lighting from './components/Lighting'
import Minimap from './components/Minimap'
import SpeechBox from './components/SpeechBox'
import StopModal from './components/StopModal'
import TalkBubble from './components/TalkBubble'
import Weather, { type WeatherSheets } from './components/Weather'
import WorldMap from './components/WorldMap'
// Groundはscene.module.cssを読むので、CSSの出力順を変えないよう他の子より後に読み込む
import Ground from './components/Ground'
import { useDayPhase } from './hooks/use-day-phase'
import { VIEW_COLS } from './hooks/use-stage-scale'
import { useVillage } from './hooks/use-village'
import { useWeather } from './hooks/use-weather'
import { initialView } from './initial-view'
import styles from './scene.module.css'

type VillageProps = {
  lang: Locale
  worldSet: WorldSet
  text: VillageText
  // 配置用の添字と寸法だけ。画像 URI は VillagePage の <style> が持つので重複して送らない
  sprites: SheetLayout
  // 主人公だけ 16×24 の別シート(頭がマスの上へ半マスはみ出す)の配置情報
  playerSprites: SheetLayout
  weatherSprites: WeatherSheets
  // 一覧への出口リンク。縦持ちタッチでは枠のすぐ下に横長で置くので Village の中で描く
  exit: ReactNode
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
  playerSprites,
  weatherSprites,
  exit,
  stopHrefs,
  stopExternal,
  listHref,
}: VillageProps) {
  const phase = useDayPhase()
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
    loadingRef,
    camRef,
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
  } = useVillage({ worldSet, text, playerSprites })

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
            {/* Ground は添字計算にしか使わない(index・count は4段階とも共通)。
                背景URLは VillagePage が置いた<style>が担う */}
            <Ground world={world} sprites={sprites} destination={destination} />
            {/* 夜の灯り。地面の上・目印(z 1)と主人公(z 2)の下に敷く層で、
                主人公の持つ灯りだけは use-walk-loop が人物と同じ transform を毎フレーム書く
                (rAF が回るまでの土台として、人物・目印と同じ startShift を渡す)。
                昼夜の出し分けは Lighting 側の [data-phase='night'] が受け持つ */}
            <Lighting world={world} playerLightRef={playerLightRef} startShift={startShift} />
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
                {/* 頭はマスの上へ半マスはみ出すので、吹き出しはその分だけ上に付ける */}
                <TalkBubble text={hintText} lang={lang} at={{ x: 0.5, y: -0.5 }} kind='thought' />
              </div>
            ) : null}
          </div>
          {/* 雨・雪は world 層ではなく枠の子。枠は表示領域(10×9)ぶんしかないので、町 30×20 を
              抱える world 層に敷くより描き替える面積が小さく、毎フレーム動く層の再描画にも巻き込まれない。
              屋内(自室・建物の中)は天井があるので降らせない */}
          {outdoors ? <Weather kind={weather} sheets={weatherSprites} /> : null}
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
        {/* 縦持ちタッチでは枠と帯の間に横長で並び、useStageScale がこの高さも差し引く。それ以外は箱を作らない */}
        <div ref={exitRef} className={styles.exitSlot} data-village-exit-slot>
          {exit}
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
