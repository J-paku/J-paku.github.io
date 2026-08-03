// ポートフォリオハブのコンテンツ型定義
// content/ja と content/ko は同一の型を満たす。キーの過不足は tsc --noEmit で検出する

export type Locale = 'ja' | 'ko'

// ---------- 計測票 (DIRECTION-FINAL §2-1) ----------
// このサイトの唯一のシグネチャ。数値は必ず「ラベル→値→条件」の3層で現れ、
// 条件層が空ならその数値は画面に上げない。この規則を型レベルで強制するため
// Measurement.condition は必須(optionalにしない)

// ラベルの書体分岐: 10px ラテン大文字(latin)か、14px ロケール本文書体(local)か
export type MeasurementLabelScript = 'latin' | 'local'

export type MeasurementItem = {
  label: string
  labelScript: MeasurementLabelScript
  value: string
}

// 計測票の1ブロック。1つ以上のitemが並び、条件層を必ず共有する
export type Measurement = {
  items: MeasurementItem[]
  condition: string
}

// ヒーロー専用(§2-3)。axe・Lighthouseの値はCIの quality.json から実行時に来るため、
// 値をcontentに持たせない(実測値とズレた瞬間にサイトの論旨が壊れる)。ラベルと条件層2行のみ持つ
export type HeroMetricLabel = {
  label: string
  labelScript: MeasurementLabelScript
}

export type HeroMeasurement = {
  items: HeroMetricLabel[]
  // 条件層1行目: 指標の出典
  source: string
  // 条件層2行目の固定テキスト。計測日時・実行結果リンクは実行時に付加する
  gate: string
}

// フッター専用(§2-8)。値を持たない計測票。ラベルは固定表記 MEASURED
export type FooterMeasurement = {
  label: string
  environment: string
  limitation: string
}

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
    // thumbnail が無いカードの画面枠に出す代替文言(08段階)
    shotPlaceholder: string
  }
  quality: {
    title: string
    measuredAt: string
    violations: string
    viewRun: string
    hero: HeroMeasurement
    footer: FooterMeasurement
  }
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

// カードのタグが「実務由来か個人開発か」を色分けするための区分(08段階)
export type WorkContextKind = 'work' | 'personal'

export type Work = {
  slug: string
  status: WorkStatus
  title: string
  tagline: string
  // 作品カードのタグ1行。どういう文脈で作ったものかを先に言う(08段階)。wipも持つ
  context: string
  contextKind: WorkContextKind
  // period・role・scale・sections は status: 'wip' では持たない
  period?: string
  role?: string
  scale?: string
  stack: string[]
  links: WorkLinks
  sections: CaseSection[]
  // 画像資産はまだ無い。ある時だけカードが描画するための空き枠
  thumbnail?: string
  // 作品自身の計測票(DIRECTION-FINAL §2-4)。wipは計測すること自体がないため持たない
  measurements?: Measurement[]
}

// ---------- プロフィール ----------

export type Career = {
  company: string
  period: string
  // その在籍期間で実際に触れた技術(08段階の左列 .cv .tech)
  stack: string[]
  role: string
  summary: string
  highlights: string[]
}

export type Strength = {
  title: string
  body: string
}

// 外部プロフィールへの導線(08段階の左列 .out)
export type ProfileLinks = {
  github?: string
}

export type Profile = {
  name: string
  // 肩書き1語。名前の直下に置く(08段階の左列 .role)
  role: string
  // 守備範囲。区切り文字「·」はコンポーネント側が入れるため値には含めない
  scope: string[]
  // 一行のニッチ・ポジショニング。抽象的な意気込みは書かない
  headline: string
  location: string
  goal: string
  links: ProfileLinks
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
