// 村ページの組み立て。画面の状態と時刻の読み書きを持ち、Village には描画に要る値と手だけを渡す。
'use client'
import type { ReactNode } from 'react'
import Logo from '@/components/ui/Logo'
import Boot from './components/Boot/container'
import Navigation from '@/components/ui/Navigation'
import ExitLink from './components/ExitLink'
import Village from './components/Village'
import { useDayPhase } from './hooks/use-day-phase'
import { useVillage } from './hooks/use-village'
import { useWeather } from './hooks/use-weather'
import { useVillageTime } from './hooks/use-village-time'
import { initialView } from './components/Village/utils/initial-view'
import { pickDialog } from './components/Village/utils/pick-dialog'
import type { villageProps } from './utils/village-props'
// Village の子より後に読み、元の CSS の出力順を保つ。
import styles from './village-page.module.css'

type VillagePageContainerProps = ReturnType<typeof villageProps> & {
  // サーバが作る初回描画用の要素。前後のマークアップを移しても HTML の順序を変えない。
  spriteStyle?: ReactNode
  phaseInit?: ReactNode
}

function VillagePageContainer({
  lang,
  name,
  ui,
  shortcuts,
  worldSet,
  text,
  sprites,
  playerSprites,
  weatherSprites,
  phaseSheets,
  stopHrefs,
  stopExternal,
  listHref,
  catches,
  roleLabels,
  spriteStyle,
  phaseInit,
}: VillagePageContainerProps) {
  // この順が effect の順になる。旧 Village の呼び出し順と引数を保つ。
  const phase = useDayPhase(phaseSheets)
  const weather = useWeather()
  const village = useVillage({
    worldSet,
    text,
    sprites,
    playerSprites,
    catches,
    roleLabels,
    // 傘を差すのは雨の時だけ(雪・晴れは差さない)
    raining: weather === 'rain',
  })
  const view = initialView(village.world, sprites, playerSprites, village.reduceMotion)
  // 地点の会話と釣りの結果を 1 つに決め、StopModal は 1 か所だけで描く。
  const dialog = pickDialog({
    mode: village.mode,
    activeSpot: village.activeSpot,
    fishingStop: village.fishing.stop,
    text,
    stopHrefs,
    stopExternal,
  })

  const setRealtime = useVillageTime(state => state.setRealtime)
  const setCustomTime = useVillageTime(state => state.setCustomTime)
  const savedHour = useVillageTime(state => state.customHour)
  const savedMinute = useVillageTime(state => state.customMinute)

  return (
    <main id='main' className={styles.stage}>
      <Boot name={name} />
      <a className={styles.skip} href={listHref}>
        {text.skipVillage}
      </a>
      <header className={styles.intro}>
        {/* 見出しはロゴ図形。読み上げ名は Logo の aria-label が持つ。ブート画面のロゴがここへ着地する */}
        <h1 className={styles.title}>
          <Logo name={name} bootTarget />
        </h1>
        <p className={styles.hidden}>{text.intro}</p>
        <p className={styles.hidden}>{text.promise}</p>
      </header>
      <nav className={styles.shortcuts} aria-label={text.shortcuts}>
        <ul>
          {shortcuts.map(shortcut => (
            <li key={shortcut.href}>
              <a href={shortcut.href}>{shortcut.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      {spriteStyle}
      <Village
        {...village}
        {...view}
        lang={lang}
        text={text}
        sprites={sprites}
        phase={phase}
        weather={weather}
        weatherSprites={weatherSprites}
        dialog={dialog}
        clock={{ savedHour, savedMinute, setRealtime, setCustomTime }}
        exit={<ExitLink href={listHref} label={text.toList} />}
        listHref={listHref}
      />
      {phaseInit}
      {/* 一覧への出口は Village の中(ExitLink)。ここは設定メニューだけ */}
      <Navigation locale={lang} ui={ui} pathname='/' />
    </main>
  )
}

export default VillagePageContainer
