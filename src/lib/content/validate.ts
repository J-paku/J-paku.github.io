// content/の作品・経歴の整合性検査と作品の並び替え。純粋関数のみで、ファイル読み取りはread.ts側が担う。
// 村ワールドの検査はvalidate-world.tsが担う
// ここで返した問題は read.ts が build 時に throw して落とす — ko の欠けを ja で黙って埋めない
import type { Content, Work } from '@content/types/content'

// 1) published が先・wipが後 2) published同士はperiod降順 3) wip同士はslug昇順(v1 と同じ規則)
export const sortWorks = (works: Work[]): Work[] =>
  [...works].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'published' ? -1 : 1
    if (a.status === 'published') return (b.period ?? '').localeCompare(a.period ?? '')
    return a.slug.localeCompare(b.slug)
  })

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

export const validateContent = (ja: Content, koContent: Content, workFiles: string[]): string[] => {
  const issues: string[] = []
  const koBySlug = new Map(koContent.works.map(w => [w.slug, w] as const))
  const jaSlugs = new Set(ja.works.map(w => w.slug))

  for (const jaWork of ja.works) {
    const koWork = koBySlug.get(jaWork.slug)
    if (koWork === undefined) {
      issues.push(`ko に slug "${jaWork.slug}" が無い`)
      continue
    }
    if (jaWork.status !== koWork.status)
      issues.push(`slug "${jaWork.slug}" の status が ja/ko で一致しない`)
    if ((jaWork.story === undefined) !== (koWork.story === undefined)) {
      issues.push(`slug "${jaWork.slug}" の story の有無が ja/ko で一致しない`)
    }
    if (jaWork.story !== undefined && koWork.story !== undefined) {
      const jaIds = jaWork.story.scenes.map(s => s.id)
      const koIds = koWork.story.scenes.map(s => s.id)
      if (!sameSet(jaIds, koIds))
        issues.push(`slug "${jaWork.slug}" の scene id が ja/ko で一致しない`)
    }
    if ((jaWork.detail === undefined) !== (koWork.detail === undefined)) {
      issues.push(`slug "${jaWork.slug}" の detail の有無が ja/ko で一致しない`)
    }
  }
  for (const koWork of koContent.works) {
    if (!jaSlugs.has(koWork.slug)) issues.push(`ja に slug "${koWork.slug}" が無い`)
  }
  for (const file of workFiles) {
    if (!jaSlugs.has(file)) issues.push(`content/works/${file}.ts が登録表に無い`)
  }
  for (const slug of jaSlugs) {
    if (!workFiles.includes(slug)) issues.push(`登録表の slug "${slug}" に対応するファイルが無い`)
  }
  // 経歴 id は ko 側の差し替え対象を指すため両言語で同じ並びでなければならない
  const jaCareerIds = (ja.profile.careers ?? []).map(c => c.id)
  const koCareerIds = (koContent.profile.careers ?? []).map(c => c.id)
  if (jaCareerIds.join('|') !== koCareerIds.join('|'))
    issues.push('profile.careers の id 列が ja/ko で一致しない')
  return issues
}
