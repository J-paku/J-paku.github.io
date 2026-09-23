// 村の描画。'use client'は村の入口であるこのファイル(と子の島)に置く。
// 状態と手は useVillage が組み立て、ここは受け取った値を枠・操作帯・重ね表示へ流し込むだけ
'use client'
import type { ReactNode } from 'react'
import type { CareerFeature, CareerRole, Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import ActionButtons from './components/ActionButtons'
import ClockModal from './components/ClockModal'
import Joystick from './components/Joystick'
import Lighting from './components/Lighting'
import Minimap from './components/Minimap'
import SpeechBox from './components/SpeechBox'
import StopModal from './components/StopModal'
import TalkBubble from './components/TalkBubble'
import Weather, { type WeatherSheets } from './components/Weather'
import WorldMap from './components/WorldMap'
// Ground・FishingFloat・LampVeilはscene.module.cssを読むので、CSSの出力順を変えないよう他の子より後に読み込む
import Ground from './components/Ground'
import FishingFloat from './components/FishingFloat'
import LampVeil from './components/LampVeil'
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
  exit,
  stopHrefs,
  stopExternal,
  listHref,
  catches,
  roleLabels,
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
    lampVeilRef,
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
    talkKind,
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
    openTalk,
    openMap,
    closeOverlay,
    travel,
    hasNext,
    onNext,
    pressA,
    pressB,
    announce,
  } = useVillage({ worldSet, text, sprites, playerSprites, catches, roleLabels })

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
  const dialog =
    mode === 'talk' && activeSpot !== null
      ? {
          stop: text.stops[activeSpot.id],
          href: stopHrefs[activeSpot.id] ?? null,
          external: stopExternal[activeSpot.id] ?? false,
          closeLabel: text.close,
        }
      : mode === 'fishing' && fishing.stop !== null
        ? {
            stop: fishing.stop,
            href: null,
            external: false,
            closeLabel: text.close,
          }
        : null

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
            {/* 水面の浮きと釣り上げた巻物。灯りの上・主人公(z 2)の下に置く。
                釣っていない間は置くマスが決まらない(at が null)ので何も描かない。
                糸は主人公の立つマス(from)から浮きまで渡す。
                釣っている間は歩けないので、立つマスは playerCell のままでよい */}
            {fishing.at !== null ? (
              <FishingFloat
                at={fishing.at}
                from={playerCell}
                phase={fishing.phase}
                sprites={sprites}
              />
            ) : null}
            <div
              ref={playerRef}
              data-village-player
              data-sprite={startPose.key}
              className={`${styles.sprite} ${styles.player}`}
              style={playerStyle}
              aria-hidden='true'
            />
            {/* 街灯の下のマス(柱の根元)は通れるので、そこに立つと主人公が街灯を塗り潰す。
                重なった街灯 1 本ぶんを主人公(z 2)の上へ薄く重ねて、柱の向こうに主人公を透かす。
                どの街灯に重なるかは規則の層が決め、書き込みは use-walk-loop が rAF の中で行う。
                吹き出し(z 3)より先に置くので、会話の吹き出しはこの層より手前に出る */}
            <LampVeil veilRef={lampVeilRef} />
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
                onAction={() => {
                  frameRef.current?.focus()
                  openTalk()
                }}
                kind={talkKind}
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
          {/* 卓上時計の設定窓。会話窓と同じく枠の中に重ね、結果は会話窓の一言として伝える */}
          {mode === 'clock' ? (
            <ClockModal
              text={text.clock}
              lang={lang}
              announce={announce}
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
