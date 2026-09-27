// 村ページの本文(サーバ)。画面いっぱいの黒い舞台に枠を置き、文字は名前だけ見せる。
// 紹介文・作品リンク・切替リンクは JS 無しでも HTML に入っている(視覚的には隠す)。
// スプライトシートと地点リンクはここで一度だけ作り、クライアントの Village へ渡す
import type { Locale } from '@content/types/content'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import { sheetOf } from '@/lib/pixel/sheet-file'
import { buildWeatherSprites } from '@/lib/pixel/sprites'
import { careerRoleLabels } from '@/utils/career-role-labels'
import { DAY_PHASES } from '@/utils/day-phase'
import { toHref } from '@/utils/locale-path'
import Logo from '@/components/ui/Logo'
import Boot from './components/Boot'
import Navigation from '@/components/ui/Navigation'
import ExitLink from './components/ExitLink'
import Village from './components/Village'
// Village の非公開スタイルだが、段階ごとの背景 URL 規則をここで組むのでクラス名だけ借りる。
// import は Village より後に置く — 先に置くと scene.module.css が Village の子より前に出て、
// CSS の出力順が変わる(Village 側が Ground を最後に読んでいるのと同じ理由)
import sceneStyles from './components/Village/scene.module.css'
import styles from './village-page.module.css'
import { PHASE_INIT } from './utils/phase-init'
import { sheetLayout, sheetUrl, spriteBackgroundCss } from './utils/sprite-css'
import { resolveStopLinks } from './utils/stop-links'

type VillagePageProps = { locale: Locale }

function VillagePage({ locale }: VillagePageProps) {
  const content = readContent(locale)
  const text = readVillageText(locale)
  const worldSet = readWorldSet()
  // Village が要るのは配置情報(index・count・tile・height)だけで、これは4段階とも共通。
  // 画像そのものは public/sprites の実ファイルなので、ここで要るのは昼の1組で足りる。
  // sheetOf は sheetUrl が指紋を取るのに焼いた 1 枚をそのまま返す(同じ実体を使い回す)
  const sprites = sheetOf('sprite', 'day')
  const playerSprites = sheetOf('player', 'day')
  const weatherSprites = buildWeatherSprites()
  const storySlugs = new Set(listStorySlugs(locale))
  const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, locale)
  // 池で釣り上げる中身は現職の機能一覧。工程の名前は経歴パネルと同じ ui の文言を写して渡す
  // (文字列は content の中だけで持ち、Village 側は受け取った物を並べるだけにする)
  const catches =
    content.profile.careers.find(c => c.id === 'current')?.detail?.features?.items ?? []
  const roleLabels = careerRoleLabels(content.ui)

  return (
    <main id='main' className={styles.stage}>
      <Boot name={content.profile.name} />
      <a className={styles.skip} href={toHref('/list', locale)}>
        {text.skipVillage}
      </a>
      <header className={styles.intro}>
        {/* 見出しはロゴ図形。読み上げ名は Logo の aria-label が持つ。ブート画面のロゴがここへ着地する */}
        <h1 className={styles.title}>
          <Logo name={content.profile.name} bootTarget />
        </h1>
        <p className={styles.hidden}>{text.intro}</p>
        <p className={styles.hidden}>{text.promise}</p>
      </header>
      <nav className={styles.shortcuts} aria-label={text.shortcuts}>
        <ul>
          {content.works
            .filter(w => storySlugs.has(w.slug))
            .map(w => (
              <li key={w.slug}>
                <a href={toHref(`/works/${w.slug}`, locale)}>{w.title}</a>
              </li>
            ))}
        </ul>
      </nav>
      <style>{spriteBackgroundCss(sceneStyles)}</style>
      <Village
        lang={locale}
        worldSet={worldSet}
        text={text}
        sprites={sheetLayout(sprites)}
        playerSprites={sheetLayout(playerSprites)}
        weatherSprites={weatherSprites}
        phaseSheets={DAY_PHASES.map(phase => ({
          phase,
          urls: [sheetUrl('sprite', phase), sheetUrl('player', phase)],
        }))}
        exit={<ExitLink href={toHref('/list', locale)} label={text.toList} />}
        stopHrefs={stopHrefs}
        stopExternal={stopExternal}
        listHref={toHref('/list', locale)}
        catches={catches}
        roleLabels={roleLabels}
      />
      {/* Village の根の data-phase を初回描画の前に実際の段階へ直す。直前に置くのが条件 */}
      <script dangerouslySetInnerHTML={{ __html: PHASE_INIT }} />
      {/* 一覧への出口は Village の中(ExitLink)。ここは設定メニューだけ */}
      <Navigation locale={locale} ui={content.ui} pathname='/' />
    </main>
  )
}

export default VillagePage
