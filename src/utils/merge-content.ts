// ko → ja フォールバックの合成ロジック(純粋関数のみ)。
// ko は既に全訳済みのため、これは常時通る主経路ではなく「今後の追記でkoが追いつかない区間」を埋める安全網。
import type {
  Content,
  Profile,
  SkillCategory,
  UiStrings,
  Work,
  WorkDetail,
  WorkStory,
} from '@/types/content'

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
  localeMenu: mergeStringRecord(ja.localeMenu, ko.localeMenu, 'ui.localeMenu'),
  settingsMenu: mergeStringRecord(ja.settingsMenu, ko.settingsMenu, 'ui.settingsMenu'),
  theme: mergeStringRecord(ja.theme, ko.theme, 'ui.theme'),
  work: mergeStringRecord(ja.work, ko.work, 'ui.work'),
  workStory: mergeStringRecord(ja.workStory, ko.workStory, 'ui.workStory'),
  notFound: mergeStringRecord(ja.notFound, ko.notFound, 'ui.notFound'),
  colophon: mergeStringRecord(ja.colophon, ko.colophon, 'ui.colophon'),
  career: mergeStringRecord(ja.career, ko.career, 'ui.career'),
})

const mergeProfile = (ja: Profile, ko: Profile): Profile => ({
  name: pick(ja.name, ko.name, 'profile.name'),
  role: pick(ja.role, ko.role, 'profile.role'),
  scope: pick(ja.scope, ko.scope, 'profile.scope'),
  headline: pick(ja.headline, ko.headline, 'profile.headline'),
  location: pick(ja.location, ko.location, 'profile.location'),
  goal: pick(ja.goal, ko.goal, 'profile.goal'),
  links: {
    github: pickOptionalString(ja.links.github, ko.links.github, 'profile.links.github'),
  },
  // careers・strengths は要素単位のキーを持たないため配列丸ごと単位でのみ判定する(部分マージはしない)
  careers: pick(ja.careers, ko.careers, 'profile.careers'),
  strengths: pick(ja.strengths, ko.strengths, 'profile.strengths'),
})

const mergeSkills = (ja: SkillCategory[], ko: SkillCategory[]): SkillCategory[] =>
  pick(ja, ko, 'skills')

const mergeNow = (ja: Content['now'], ko: Content['now']): Content['now'] => pick(ja, ko, 'now')

// detail は叙事セクション列を持つ複合オブジェクトのためフィールド単位では割らず、ko があれば丸ごと採用する
const pickDetail = (ja: WorkDetail | undefined, ko: WorkDetail | undefined): WorkDetail | undefined =>
  ko === undefined ? ja : ko

// story はシーン群を持つ複合オブジェクトのためフィールド単位では割らず、ko があれば丸ごと採用する
const pickStory = (ja: WorkStory | undefined, ko: WorkStory | undefined): WorkStory | undefined =>
  ko === undefined ? ja : ko

const mergeWork = (ja: Work, ko: Work): Work => ({
  slug: ko.slug,
  status: ko.status,
  title: pick(ja.title, ko.title, `works.${ko.slug}.title`),
  tagline: pick(ja.tagline, ko.tagline, `works.${ko.slug}.tagline`),
  context: pick(ja.context, ko.context, `works.${ko.slug}.context`),
  // contextKind は表示文字列ではなく区分値なので status と同様ko側をそのまま使う
  contextKind: ko.contextKind,
  period: pickOptionalString(ja.period, ko.period, `works.${ko.slug}.period`),
  role: pickOptionalString(ja.role, ko.role, `works.${ko.slug}.role`),
  scale: pickOptionalString(ja.scale, ko.scale, `works.${ko.slug}.scale`),
  stack: pick(ja.stack, ko.stack, `works.${ko.slug}.stack`),
  links: {
    live: pickOptionalString(ja.links.live, ko.links.live, `works.${ko.slug}.links.live`),
    repo: pickOptionalString(ja.links.repo, ko.links.repo, `works.${ko.slug}.links.repo`),
  },
  thumbnail: pickOptionalString(ja.thumbnail, ko.thumbnail, `works.${ko.slug}.thumbnail`),
  glyph: pickOptionalString(ja.glyph, ko.glyph, `works.${ko.slug}.glyph`),
  detail: pickDetail(ja.detail, ko.detail),
  story: pickStory(ja.story, ko.story),
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
