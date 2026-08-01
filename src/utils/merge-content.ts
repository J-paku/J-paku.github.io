// ko → ja フォールバックの合成ロジック(純粋関数のみ)。
// ko は既に全訳済みのため、これは常時通る主経路ではなく「今後の追記でkoが追いつかない区間」を埋める安全網。
import type { CaseSection, Content, Profile, SkillCategory, UiStrings, Work } from '@/types/content'
import { CASE_SECTION_ORDER } from '@/types/content'

// 空値判定は2種類のみ。if (!value) は 0 / false までフォールバックさせてしまうため使わない
export const isEmpty = <T,>(value: T): boolean =>
  value === '' || (Array.isArray(value) && value.length === 0)

const warnEmpty = (path: string): void => {
  if (import.meta.env.DEV) {
    console.warn(`merge-content: ko の "${path}" が空のため ja にフォールバックします`)
  }
}

// ko が空ならja、そうでなければko。文字列にも配列(丸ごと単位)にも使える汎用ピック
// ja側も空(=そもそも値を持たない項目)ならフォールバックとは呼べないため警告は出さない
const pick = <T,>(ja: T, ko: T, path: string): T => {
  if (isEmpty(ko)) {
    if (!isEmpty(ja)) warnEmpty(path)
    return ja
  }
  return ko
}

// period・role・scale・links.* のような optional な string フィールド用。
// isEmpty の判定基準(''のみ)に合わせるため undefined を一旦 '' に寄せてからpickし、結果を戻す
const pickOptionalString = (ja: string | undefined, ko: string | undefined, path: string): string | undefined => {
  const merged = pick(ja ?? '', ko ?? '', path)
  return merged === '' ? undefined : merged
}

const mergeStringRecord = <T extends Record<string, string>>(ja: T, ko: T, path: string): T => {
  const result = {} as T
  for (const key of Object.keys(ja) as Array<keyof T>) {
    result[key] = pick(ja[key], ko[key], `${path}.${String(key)}`)
  }
  return result
}

const mergeUi = (ja: UiStrings, ko: UiStrings): UiStrings => ({
  skipToMain: pick(ja.skipToMain, ko.skipToMain, 'ui.skipToMain'),
  nav: mergeStringRecord(ja.nav, ko.nav, 'ui.nav'),
  localeMenu: mergeStringRecord(ja.localeMenu, ko.localeMenu, 'ui.localeMenu'),
  theme: mergeStringRecord(ja.theme, ko.theme, 'ui.theme'),
  work: mergeStringRecord(ja.work, ko.work, 'ui.work'),
  quality: mergeStringRecord(ja.quality, ko.quality, 'ui.quality'),
  notFound: mergeStringRecord(ja.notFound, ko.notFound, 'ui.notFound'),
})

const mergeProfile = (ja: Profile, ko: Profile): Profile => ({
  name: pick(ja.name, ko.name, 'profile.name'),
  headline: pick(ja.headline, ko.headline, 'profile.headline'),
  location: pick(ja.location, ko.location, 'profile.location'),
  goal: pick(ja.goal, ko.goal, 'profile.goal'),
  // careers・strengths は要素単位のキーを持たないため配列丸ごと単位でのみ判定する(部分マージはしない)
  careers: pick(ja.careers, ko.careers, 'profile.careers'),
  strengths: pick(ja.strengths, ko.strengths, 'profile.strengths'),
})

const mergeSkills = (ja: SkillCategory[], ko: SkillCategory[]): SkillCategory[] =>
  pick(ja, ko, 'skills')

const mergeNow = (ja: Content['now'], ko: Content['now']): Content['now'] => pick(ja, ko, 'now')

// key基準で対応づける。indexで揃えると節が1つずれた瞬間に全体が崩れる
const mergeSections = (ja: CaseSection[], ko: CaseSection[], slug: string): CaseSection[] => {
  const jaByKey = new Map(ja.map((section) => [section.key, section] as const))
  const koByKey = new Map(ko.map((section) => [section.key, section] as const))
  const knownKeys = new Set([...jaByKey.keys(), ...koByKey.keys()])

  return CASE_SECTION_ORDER.filter((key) => knownKeys.has(key)).map((key) => {
    const jaSection = jaByKey.get(key)
    const koSection = koByKey.get(key)
    if (koSection === undefined) return jaSection as CaseSection
    if (jaSection === undefined) return koSection

    return {
      key,
      heading: pick(jaSection.heading, koSection.heading, `works.${slug}.sections.${key}.heading`),
      body: pick(jaSection.body, koSection.body, `works.${slug}.sections.${key}.body`),
    }
  })
}

const mergeWork = (ja: Work, ko: Work): Work => ({
  slug: ko.slug,
  status: ko.status,
  title: pick(ja.title, ko.title, `works.${ko.slug}.title`),
  tagline: pick(ja.tagline, ko.tagline, `works.${ko.slug}.tagline`),
  period: pickOptionalString(ja.period, ko.period, `works.${ko.slug}.period`),
  role: pickOptionalString(ja.role, ko.role, `works.${ko.slug}.role`),
  scale: pickOptionalString(ja.scale, ko.scale, `works.${ko.slug}.scale`),
  stack: pick(ja.stack, ko.stack, `works.${ko.slug}.stack`),
  links: {
    live: pickOptionalString(ja.links.live, ko.links.live, `works.${ko.slug}.links.live`),
    repo: pickOptionalString(ja.links.repo, ko.links.repo, `works.${ko.slug}.links.repo`),
  },
  sections: mergeSections(ja.sections, ko.sections, ko.slug),
  thumbnail: pickOptionalString(ja.thumbnail, ko.thumbnail, `works.${ko.slug}.thumbnail`),
})

// slug基準で対応づける。ja側に存在してko側に無いslugはjaの要素をそのまま採用する
export const mergeWorks = (ja: Work[], ko: Work[]): Work[] => {
  const koBySlug = new Map(ko.map((work) => [work.slug, work] as const))
  return ja.map((jaWork) => {
    const koWork = koBySlug.get(jaWork.slug)
    return koWork === undefined ? jaWork : mergeWork(jaWork, koWork)
  })
}

// ja を主フォールバック元、ko を優先値として Content 全体を合成する
export function mergeContent(ja: Content, ko: Content): Content {
  return {
    ui: mergeUi(ja.ui, ko.ui),
    profile: mergeProfile(ja.profile, ko.profile),
    skills: mergeSkills(ja.skills, ko.skills),
    now: mergeNow(ja.now, ko.now),
    works: mergeWorks(ja.works, ko.works),
  }
}
