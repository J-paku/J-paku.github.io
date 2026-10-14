// 読み出し済みの内容から、村のコンテナへ渡すデータだけを組む。ローダーと node の fixture で共用する。
// シートの合成は node:crypto・node:zlib を使うので、呼び出すのはサーバ側だけにする。
import type { Content, Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import { sheetOf } from '@/lib/pixel/sheet-file'
import { buildWeatherSprites } from '@/lib/pixel/sprites'
import { careerRoleLabels } from '@/utils/career-role-labels'
import { DAY_PHASES } from '@/utils/day-phase'
import { toHref } from '@/utils/locale-path'
import { sheetLayout, sheetUrl } from './sprite-css'
import { resolveStopLinks } from './stop-links'

export function villageProps(
  locale: Locale,
  content: Content,
  text: VillageText,
  worldSet: WorldSet,
  storySlugs: readonly string[]
) {
  const stories = new Set(storySlugs)
  const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, locale)
  return {
    lang: locale,
    name: content.profile.name,
    ui: content.ui,
    shortcuts: content.works
      .filter(work => stories.has(work.slug))
      .map(work => ({ href: toHref(`/works/${work.slug}`, locale), title: work.title })),
    worldSet,
    text,
    // 配置情報は全時間帯で共通。画像本体はローダーの <style> が参照する。
    sprites: sheetLayout(sheetOf('sprite', 'day')),
    playerSprites: sheetLayout(sheetOf('player', 'day')),
    weatherSprites: buildWeatherSprites(),
    phaseSheets: DAY_PHASES.map(phase => ({
      phase,
      urls: [sheetUrl('sprite', phase), sheetUrl('player', phase)],
    })),
    stopHrefs,
    stopExternal,
    listHref: toHref('/list', locale),
    // 池で釣る現職の機能と工程名は、経歴と同じ content の値を使う。
    catches: content.profile.careers.find(c => c.id === 'current')?.detail?.features?.items ?? [],
    roleLabels: careerRoleLabels(content.ui),
  }
}
