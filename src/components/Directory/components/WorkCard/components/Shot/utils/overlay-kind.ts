// 作品カードのリンクの覆いの種別。live/repo を持つか、それが無く story だけを持つかを判定する
import type { Work } from '@content/types/content'

export function resolveOverlayKind(work: Work) {
  // リンクの覆い。ポインタ環境ではホバー(と focus-within)で出し、タッチ環境ではタップで開閉する。
  // links(live/repo)を持たないが story を持つ作品も、同じ覆いにストーリーページへの
  // ボタンを1つ出す — 覆いの存在に他カードと差を付けない
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined
  const hasStoryOverlay = !hasLinks && work.story !== undefined
  const hasOverlay = hasLinks || hasStoryOverlay

  return { hasLinks, hasStoryOverlay, hasOverlay }
}
