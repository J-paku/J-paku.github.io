// 読み出し済みの内容から、作品ストーリーのコンテナへ渡すデータだけを組む。ローダーと node の fixture で共用する。
// content の読み出し(サーバ専用)は呼び出し側が行い、ここは受け取った値を並べるだけ
import type { Content, Locale, Work } from '@content/types/content'
import type { VillageText } from '@content/types/world'

// ストーリーを持たない作品では null を返す。型ではストーリーが任意なので、ローダーはこれを notFound() にする
// (空の 200 を返さない)。notFound() はサーバ専用なので、ここでは呼ばずに「無い」を値で返す
export function storyProps(locale: Locale, content: Content, text: VillageText, work: Work) {
  if (work.story === undefined) return null
  return {
    locale,
    slug: work.slug,
    story: work.story,
    ui: content.ui,
    switchLabel: text.toVillage,
  }
}
