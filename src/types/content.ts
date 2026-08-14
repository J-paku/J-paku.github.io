// ポートフォリオハブのコンテンツ型定義
// content/ja と content/ko は同一の型を満たす。キーの過不足は tsc --noEmit で検出する

export type Locale = 'ja' | 'ko'

// フッター専用(§2-8)。値を持たない計測票。ラベルは固定表記 MEASURED
export type FooterMeasurement = {
  label: string
  environment: string
  limitation: string
}

// ---------- UI文字列(01段階で新設・02段階で拡張) ----------

export type UiStrings = {
  skipToMain: string
  localeMenu: { label: string; ja: string; ko: string }
  settingsMenu: { label: string }
  theme: { label: string; light: string; dark: string }
  work: {
    // 右列ヘッダーバー左側の索引文言(10段階)
    index: string
    // サムネイルのリンクオーバーレイを開くボタンの読み上げ名(10段階)
    openLinks: string
    wipBadge: string
    period: string
    role: string
    scale: string
    stack: string
    live: string
    repo: string
    // thumbnail が無いカードの画面枠に出す代替文言(08段階)
    shotPlaceholder: string
    // カード折りたたみ詳細の開閉ボタン文言
    showDetail: string
    hideDetail: string
    // ケース(課題/設計/理由)の見出し
    caseChallenge: string
    caseDecision: string
    caseReason: string
    // 詳細セクションの見出し(課題と解決/構成図)
    detailCases: string
    detailDiagrams: string
  }
  // 作品ストーリーページ(/works/:slug)専用の文言
  workStory: { back: string }
  quality: {
    footer: FooterMeasurement
  }
  notFound: { title: string; body: string; backHome: string }
  // ページ最下部の奥付(10段階)。著作権表記とデザイン出自の1行
  colophon: { copyright: string; credit: string }
}

// ---------- 作品 ----------

export type WorkStatus = 'published' | 'wip'

export type WorkLinks = {
  live?: string
  repo?: string
}

// カードのタグが「実務由来か個人開発か」を色分けするための区分(08段階)
export type WorkContextKind = 'work' | 'personal'

// 作品カードの折りたたみ詳細で使う個別ケース(課題→設計→理由の1組)
export type WorkCase = {
  challenge: string
  decision: string
  reason: string
}

// 詳細内の図解1枚分。ラベルは図中の記号をキーにした注記文の対応表
export type WorkDiagram = {
  title: string
  caption: string
  labels: Record<string, string>
}

// 作品カードの折りたたみ詳細本体。図解は architecture・dataflow・sequence の3種を固定で持つ
export type WorkDetail = {
  cases: WorkCase[]
  diagrams: {
    architecture: WorkDiagram
    dataflow: WorkDiagram
    sequence: WorkDiagram
  }
}

// 作品ストーリーページの1場面で挙げる技術チップ。name をタップ・ホバーすると note が出る
export type WorkStoryChip = { name: string; note: string }

// 作品ストーリーページの1場面分。image はロケール共通(glyphと同じ前例に倣う)
export type WorkStoryScene = {
  id: string
  title: string
  body: string
  chips: WorkStoryChip[]
  image: string
}

// 作品専用ストーリーページ(/works/:slug)の本体。導入・場面群・まとめの3部構成
export type WorkStory = {
  intro: { title: string; lead: string }
  scenes: WorkStoryScene[]
  outro: { title: string; body: string; stackSummary: WorkStoryChip[] }
}

export type Work = {
  slug: string
  status: WorkStatus
  title: string
  tagline: string
  // カードの背景装飾グリフ(漢字2文字程度)。装飾専用のためロケール間で同一値でよい
  glyph?: string
  // 作品カードのタグ1行。どういう文脈で作ったものかを先に言う(08段階)。wipも持つ
  context: string
  contextKind: WorkContextKind
  // period・role・scale は status: 'wip' では持たない
  period?: string
  role?: string
  scale?: string
  stack: string[]
  links: WorkLinks
  // 画像資産はまだ無い。ある時だけカードが描画するための空き枠
  thumbnail?: string
  // カード折りたたみ詳細(課題ケース+構成図)。wip作品は持たない — 不変ルール5の延長
  detail?: WorkDetail
  // 専用ストーリーページ(/works/:slug)を持つ作品のみ。detailとは別物。imageはロケール共通 — glyphの前例に倣う
  story?: WorkStory
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
