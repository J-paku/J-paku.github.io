// 村ページの本文(サーバ)。画面いっぱいの黒い舞台に枠を置き、文字は名前だけ見せる。
// 紹介文・作品リンク・切替リンクは JS 無しでも HTML に入っている(視覚的には隠す)。
// スプライトシートと地点リンクはここで一度だけ作り、クライアントの Village へ渡す
import type { Locale } from '@content/types/content'
import type { Sheet, SheetLayout } from '@/lib/pixel/art'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import { buildPlayerSprites, buildSprites, buildWeatherSprites } from '@/lib/pixel/sprites'
import { dayPhaseAt, DAY_PHASES, type DayPhase } from '@/utils/day-phase'
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

type VillagePageProps = { locale: Locale }

// 既定(属性なし)を昼にするので、規則を足すのは昼以外の段階だけ。手書きの一覧にすると
// 段階が増えたとき規則の無いまま配信されてしまうため、必ず DAY_PHASES から導く
const NON_DEFAULT_PHASES: readonly DayPhase[] = DAY_PHASES.filter(phase => phase !== 'day')

// シートの data URI はこの規則 1 本で解析させる(要素ごとの var() 展開は避ける)。
// 町の684要素にカスタムプロパティ経由でURIを配ると再解析で約1秒止まる(実測)ため、
// 段階の切替もこの<style>1本で済ませる。既定は昼、他の段階は data-phase の分だけ詳細度を上げて上書きする。
// サーバで組み立てて <style> もサーバで出す — クライアントへ渡すと同じ data URI が
// props と <style> に二重で載り、HTML の 4 割が base64 になる(実測)
const spriteBackgroundCss = (
  sprites: Record<DayPhase, Sheet>,
  playerSprites: Record<DayPhase, Sheet>
): string => {
  const base = `.${sceneStyles.sprite}{background-image:url('${sprites.day.uri}')}.${sceneStyles.player}{background-image:url('${playerSprites.day.uri}')}`
  const overrides = NON_DEFAULT_PHASES.map(phase => {
    const scope = `.${sceneStyles.root}[data-phase='${phase}']`
    return `${scope} .${sceneStyles.sprite}{background-image:url('${sprites[phase].uri}')}${scope} .${sceneStyles.player}{background-image:url('${playerSprites[phase].uri}')}`
  }).join('')
  return base + overrides
}

// 静的 HTML は昼で焼かれるので、hydration を待つと昼の村を見せてから夜へ飛ぶ。
// ブートの覆いは時間で外れるだけ(動きを控える設定では 300ms)なので隠し切れない。
// テーマと同じく、描画の前にインラインスクリプトで属性を書き換えて飛びを消す。
// 判定式の正本は dayPhaseAt。入力が UTC の「時」だけであることを使って 24 時間ぶんの答えを
// ここで焼き込み、スクリプト側は表を引くだけにする(判定を二重に書かない)
const PHASE_BY_UTC_HOUR = Array.from({ length: 24 }, (_, hour) =>
  dayPhaseAt(new Date(Date.UTC(2026, 0, 1, hour)))
).join(',')

// 直前の要素(= Village の根)に data-phase があるときだけ書き換える。
// この <script> は必ず <Village> の直後に置くこと
const PHASE_INIT = `;(function(){try{var p='${PHASE_BY_UTC_HOUR}'.split(',');var s=document.currentScript;var el=s===null?null:s.previousElementSibling;if(el!==null&&el.hasAttribute('data-phase')){el.setAttribute('data-phase',p[new Date().getUTCHours()])}}catch(e){}})()`

const sheetLayout = ({ index, count, tile, height }: Sheet): SheetLayout => ({
  index,
  count,
  tile,
  height,
})

function VillagePage({ locale }: VillagePageProps) {
  const content = readContent(locale)
  const text = readVillageText(locale)
  const worldSet = readWorldSet()
  // 昼夜4段階ぶんのシートをサーバで焼く。文字→色の対応(パレット)だけが違い、index・count は
  // 4段階とも共通。画像は下の<style>だけで使い、Village へ渡すのは配置情報に絞る
  const sprites: Record<DayPhase, Sheet> = {
    dawn: buildSprites('dawn'),
    day: buildSprites('day'),
    dusk: buildSprites('dusk'),
    night: buildSprites('night'),
  }
  const playerSprites: Record<DayPhase, Sheet> = {
    dawn: buildPlayerSprites('dawn'),
    day: buildPlayerSprites('day'),
    dusk: buildPlayerSprites('dusk'),
    night: buildPlayerSprites('night'),
  }
  const weatherSprites = buildWeatherSprites()
  const storySlugs = new Set(listStorySlugs(locale))
  // 地点ごとのリンク先。story は言語付きの作品ルート、external はそのまま。地点は全ワールド分
  // (コース外の地点にも将来リンクが付く可能性があるため、allSpots ではなく全地点を対象にする)
  const stopHrefs: Record<string, string | null> = {}
  const stopExternal: Record<string, boolean> = {}
  const spots = Object.values(worldSet.worlds).flatMap(world => world.spots)
  for (const spot of spots) {
    const link = text.stops[spot.id]?.link
    if (link === undefined) {
      stopHrefs[spot.id] = null
      stopExternal[spot.id] = false
    } else if (link.target.kind === 'story') {
      stopHrefs[spot.id] = toHref(`/works/${link.target.slug}`, locale)
      stopExternal[spot.id] = false
    } else {
      stopHrefs[spot.id] = link.target.url
      stopExternal[spot.id] = true
    }
  }

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
      <style>{spriteBackgroundCss(sprites, playerSprites)}</style>
      <Village
        lang={locale}
        worldSet={worldSet}
        text={text}
        sprites={sheetLayout(sprites.day)}
        playerSprites={sheetLayout(playerSprites.day)}
        weatherSprites={weatherSprites}
        exit={<ExitLink href={toHref('/list', locale)} label={text.toList} />}
        stopHrefs={stopHrefs}
        stopExternal={stopExternal}
        listHref={toHref('/list', locale)}
      />
      {/* Village の根の data-phase を初回描画の前に実際の段階へ直す。直前に置くのが条件 */}
      <script dangerouslySetInnerHTML={{ __html: PHASE_INIT }} />
      {/* 一覧への出口は Village の中(ExitLink)。ここは設定メニューだけ */}
      <Navigation locale={locale} ui={content.ui} pathname='/' />
    </main>
  )
}

export default VillagePage
