// 村ページの本文(サーバ)。画面いっぱいの黒い舞台に枠を置き、文字は名前だけ見せる。
// 紹介文・作品リンク・切替リンクは JS 無しでも HTML に入っている(視覚的には隠す)。
// スプライトシートと地点リンクはここで一度だけ作り、クライアントの Village へ渡す
import type { Locale } from '@content/types/content'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import { buildSprites } from '@/lib/pixel/sprites'
import { allSpots } from '@/lib/village/spot'
import { toHref } from '@/utils/locale-path'
import Logo from '@/components/ui/Logo'
import Boot from './components/Boot'
import Navigation from '@/components/ui/Navigation'
import Village from './components/Village'
import styles from './village-page.module.css'

type VillagePageProps = { locale: Locale }

function VillagePage({ locale }: VillagePageProps) {
  const content = readContent(locale)
  const text = readVillageText(locale)
  const worldSet = readWorldSet()
  const sprites = buildSprites()
  const storySlugs = new Set(listStorySlugs(locale))
  // 地点ごとのリンク先。story は言語付きの作品ルート、external はそのまま。地点は全ワールド分
  const stopHrefs: Record<string, string | null> = {}
  const stopExternal: Record<string, boolean> = {}
  for (const spot of allSpots(worldSet)) {
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
      <Village
        lang={locale}
        worldSet={worldSet}
        text={text}
        sprites={sprites}
        stopHrefs={stopHrefs}
        stopExternal={stopExternal}
        listHref={toHref('/list', locale)}
      />
      <Navigation
        locale={locale}
        current='village'
        switchLabel={text.toList}
        ui={content.ui}
        pathname='/'
      />
    </main>
  )
}

export default VillagePage
