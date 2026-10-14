// 読み出し済みの内容から、一覧のコンテナへ渡すデータだけを組む。ローダーと node の fixture で共用する。
// content の読み出し(サーバ専用)は呼び出し側が行い、ここは受け取った値を並べるだけ
import type { Content, Locale } from '@content/types/content'
import type { VillageText } from '@content/types/world'

export function directoryProps(locale: Locale, content: Content, text: VillageText) {
  return {
    locale,
    profile: content.profile,
    works: content.works,
    ui: content.ui,
    // 右下「マップで見る」の文言(村の文言の toVillage)
    toVillage: text.toVillage,
  }
}
