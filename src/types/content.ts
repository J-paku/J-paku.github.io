// ポートフォリオハブのコンテンツ型定義
// content/ja と content/ko は同一の型を満たす。キーの過不足は tsc --noEmit で検出する

export type Locale = 'ja' | 'ko'

// ---------- UI文字列(01段階で新設・02段階で拡張) ----------

export type UiStrings = {
  skipToMain: string
  // <nav> ランドマークのアクセシブルネーム。01段階では英語固定だった分をロケール化する
  nav: { label: string; works: string; now: string; skills: string; about: string }
  localeMenu: { label: string; ja: string; ko: string }
  theme: { label: string; system: string; light: string; dark: string }
  work: {
    wipBadge: string
    period: string
    role: string
    scale: string
    stack: string
    live: string
    repo: string
    backToList: string
  }
  quality: { title: string; measuredAt: string; violations: string; viewRun: string }
  notFound: { title: string; body: string; backHome: string }
  // 06段階: コマンドパレット用文字列。resultCountは'{count}'をJS側で件数へ置換して使う
  commandPalette: {
    openButtonLabel: string
    title: string
    searchLabel: string
    placeholder: string
    resultCount: string
    groupWorks: string
    groupLocale: string
    groupTheme: string
    groupExternal: string
  }
}

// ---------- 作品 ----------

export type WorkStatus = 'published' | 'wip'

// ケーススタディ固定8節のうち、本文を持つ7節
// 8節目「リンク」は本文を持たず links から描画するため、ここには含めない
export type CaseSectionKey =
  | 'overview'
  | 'challenge'
  | 'design'
  | 'techChoice'
  | 'struggle'
  | 'verification'
  | 'retrospect'

// 描画順はこの配列が正。content 側の並びには依存しない
export const CASE_SECTION_ORDER: CaseSectionKey[] = [
  'overview',
  'challenge',
  'design',
  'techChoice',
  'struggle',
  'verification',
  'retrospect',
]

export type CaseSection = {
  key: CaseSectionKey
  heading: string
  body: string[]
}

export type WorkLinks = {
  live?: string
  repo?: string
}

export type Work = {
  slug: string
  status: WorkStatus
  title: string
  tagline: string
  // period・role・scale・sections は status: 'wip' では持たない
  period?: string
  role?: string
  scale?: string
  stack: string[]
  links: WorkLinks
  sections: CaseSection[]
  // 画像資産はまだ無い。ある時だけカードが描画するための空き枠
  thumbnail?: string
}

// ---------- プロフィール ----------

export type Career = {
  company: string
  period: string
  role: string
  summary: string
  highlights: string[]
}

export type Strength = {
  title: string
  body: string
}

export type Profile = {
  name: string
  // 一行のニッチ・ポジショニング。抽象的な意気込みは書かない
  headline: string
  location: string
  goal: string
  careers: Career[]
  strengths: Strength[]
}

// ---------- スキル ----------

export type SkillItem = {
  name: string
  // 根拠となる作品の slug。空配列は「公開作品での根拠なし」を意味する
  evidence: string[]
  note?: string
}

export type SkillCategory = {
  category: string
  items: SkillItem[]
}

// ---------- 現在 ----------

export type NowEntry = {
  date: string
  body: string
}

// ---------- 集約 ----------

export type Content = {
  ui: UiStrings
  profile: Profile
  skills: SkillCategory[]
  now: NowEntry[]
  works: Work[]
}
