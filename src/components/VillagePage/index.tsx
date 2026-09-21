// 村ページの本文(サーバ)。画面いっぱいの黒い舞台に枠を置き、文字は名前だけ見せる。
// 紹介文・作品リンク・切替リンクは JS 無しでも HTML に入っている(視覚的には隠す)。
// スプライトシートと地点リンクはここで一度だけ作り、クライアントの Village へ渡す
import type { Locale } from '@content/types/content'
import type { Sheet, SheetLayout } from '@/lib/pixel/art'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import { buildWeatherSprites, sheetFileName, sheetOf, SHEET_DIR } from '@/lib/pixel/sprites'
import type { SheetKind } from '@/lib/pixel/sprites'
import { careerRoleLabels } from '@/utils/career-role-labels'
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

// シートの置き場は public/sprites/<種類>-<段階>-<指紋>.png(焼くのは scripts/build-sprites.mjs)。
// data URI をやめたのは、同じ base64 が <style> と hydration の払い出しへ二重に載り、
// index.html の 73% が base64 になっていたため(実測 37,424 / 93,822 バイト)。
// 実ファイルなら HTML から消えて画像としてキャッシュされる。
// 名前の作り方は sprites.ts の sheetFileName が唯一の正本。ここと build-sprites.mjs が
// 同じ関数を呼ぶので、URL と焼き出し先がすれ違うことが無い。
// 指紋を名前へ入れるのは、HTML(index・count を載せている)と PNG が別々にキャッシュされる
// ためで、名前が固定だと「新しい HTML × 古い PNG」で町中の絵がずれる(詳細は sprites.ts)。
// 名前が実体とずれたら out/ に参照先が無くなるので verify-export が落とす
const sheetUrl = (kind: SheetKind, phase: DayPhase): string =>
  `/${SHEET_DIR}/${sheetFileName(kind, phase)}`

// preload は入れない。実測で割に合わなかった(Slow 3G / 300ms 往復の2条件・各3回):
// (1) 段階を決めるインラインスクリプトから preload を挿す案 — 要求の開始が 788〜826ms で、
//     入れない場合の 800〜839ms と変わらない。body のスクリプトも背景画像の解決も、
//     同じ「head の CSS が届くまで待つ」に引っかかるので前倒しにならない。HTML は +254 バイト(gzip)
// (2) head に昼の2枚だけ preload を置く案 — 昼の帯(24時間中10時間)では効く(Slow 3G で
//     シート到着が 8,702ms → 3,973ms)が、残り14時間は時間が変わらないまま 3.4KB を捨て、
//     「preloaded but not used」の警告が出る。得をするのは
//     「動きを控える設定 × 400kbps 級 × 昼の帯」だけで、損は全訪問の58%が払う
// (3) 昼の1枚だけ data URI で残す案 — 計測した内訳では昼の2枚ぶんで約 7.3KB(gzip)を
//     毎ページ・毎訪問で配ることになる。1回で済む 3,419 バイトの取得と引き換えにはできない
// 入れない場合の実測: 既定(動きを控えない)は覆いが外れる 554〜619ms 前にシートが届く。
// 動きを控える設定(覆いが 300ms)かつ Slow 3G のときだけ 69〜95ms 遅れる

// 背景はこの規則 1 本で解析させる(要素ごとの var() 展開は避ける)。
// 町の684要素にカスタムプロパティ経由でURIを配ると再解析で約1秒止まる(実測)ため、
// 段階の切替もこの<style>1本で済ませる。既定は昼、他の段階は data-phase の分だけ詳細度を上げて上書きする
const spriteBackgroundCss = (): string => {
  const base = `.${sceneStyles.sprite}{background-image:url('${sheetUrl('sprite', 'day')}')}.${sceneStyles.player}{background-image:url('${sheetUrl('player', 'day')}')}`
  const overrides = NON_DEFAULT_PHASES.map(phase => {
    const scope = `.${sceneStyles.root}[data-phase='${phase}']`
    return `${scope} .${sceneStyles.sprite}{background-image:url('${sheetUrl('sprite', phase)}')}${scope} .${sceneStyles.player}{background-image:url('${sheetUrl('player', phase)}')}`
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
  // Village が要るのは配置情報(index・count・tile・height)だけで、これは4段階とも共通。
  // 画像そのものは public/sprites の実ファイルなので、ここで要るのは昼の1組で足りる。
  // sheetOf は sheetUrl が指紋を取るのに焼いた 1 枚をそのまま返す(同じ実体を使い回す)
  const sprites = sheetOf('sprite', 'day')
  const playerSprites = sheetOf('player', 'day')
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
      <style>{spriteBackgroundCss()}</style>
      <Village
        lang={locale}
        worldSet={worldSet}
        text={text}
        sprites={sheetLayout(sprites)}
        playerSprites={sheetLayout(playerSprites)}
        weatherSprites={weatherSprites}
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
