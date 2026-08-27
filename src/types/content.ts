// ポートフォリオハブのコンテンツ型定義
// content/ja と content/ko は同一の型を満たす。キーの過不足は tsc --noEmit で検出する

export type Locale = 'ja' | 'ko'

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
    // links を持たず story だけ持つ作品のオーバーレイ用。story: ボタン文言 / openStory: トリガーの読み上げ名
    story: string
    openStory: string
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
    // 自動再生・ループするモーション(実操作デモ動画・story場面の循環リールの両方が対象)の
    // 一時停止/再開トグルの読み上げ名(WCAG 2.2.2)。動画専用ではないため video ではなく motion と呼ぶ
    pauseMotion: string
    resumeMotion: string
  }
  // 作品ストーリーページ(/works/:slug)専用の文言
  // viewScene: 場面プレビューを開く全画面モーダルのトリガー文言
  // close: モーダル右上の閉じるボタンの読み上げ名
  // prevScene/nextScene: モーダル内の場面切り替えボタンの読み上げ名
  // pauseScene/resumeScene: モーダル左上の自動送り一時停止/再開トグルの読み上げ名(WCAG 2.2.2)
  workStory: {
    back: string
    viewScene: string
    close: string
    prevScene: string
    nextScene: string
    pauseScene: string
    resumeScene: string
  }
  notFound: { title: string; body: string; backHome: string }
  // ページ最下部の奥付(10段階)。著作権表記とデザイン出自の1行
  colophon: { copyright: string; credit: string }
  // 左列の経歴トリガーと右列の担当業務パネル(11段階)
  // roleOwned/roleNotOwned は工程バッジの状態を色・濃度以外でも伝えるための読み上げ専用文言
  career: {
    openDetail: string
    tabDetail: string
    backToWorks: string
    roleDesign: string
    roleBuild: string
    roleRelease: string
    roleOwned: string
    roleNotOwned: string
  }
}

// ---------- 作品 ----------

export type WorkStatus = 'published' | 'wip'

export type WorkLinks = {
  live?: string
  repo?: string
}

// カードのタグが「実務由来か個人開発か」を色分けするための区分(08段階)
export type WorkContextKind = 'work' | 'personal'

// 作品カードの折りたたみ詳細の1セクション。見出し+本文段落の並び
export type WorkDetailSection = {
  id: string
  title: string
  paragraphs: string[]
}

// 作品カードの折りたたみ詳細本体。セクションの列だけを持つ
export type WorkDetail = {
  sections: WorkDetailSection[]
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
  // 実操作デモ動画(mp4)を持つ作品だけが持つ
  video?: string
  // カード折りたたみ詳細(見出し+本文段落のセクション列による叙事)。wip作品は持たない — 不変ルール5の延長
  detail?: WorkDetail
  // 専用ストーリーページ(/works/:slug)を持つ作品のみ。detailとは別物。imageはロケール共通 — glyphの前例に倣う
  story?: WorkStory
  // story.scenes をカードのサムネイル枠で循環再生する作品だけ true — 経路を重複保有せず story を単一ソースとして参照する趣旨
  storyReel?: boolean
}

// ---------- 経歴の詳細(11段階) ----------

// 担当した工程。roles に含まれない工程は「担当外」として淡く描く
export type CareerRole = 'design' | 'build' | 'release'

// 現場フローの1コマ。emphasis が true の要素だけ強調する
export type CareerFlowStep = { label: string; emphasis?: boolean }

// 事実表の1行。label が見出し列、value が本文列
export type CareerFact = { label: string; value: string }

// 技術スタック表の1層分(Web / Native など)。title は層見出し、rows は facts と同じ行構造
export type CareerStackGroup = { title: string; rows: CareerFact[] }

// 機能一覧の1行。roles は実際に担当した工程だけを並べる
export type CareerFeature = {
  date: string
  name: string
  tech: string[]
  roles: CareerRole[]
}

// 本体の外でやったことの1項目。title は太字の見出し
export type CareerAside = { title: string; body: string }

// 担当業務パネル内の派遣先1件分。在籍1社の中で現場が替わった経歴を1項目に畳むための枠。
// client が派遣先(題字)、title が案件の1行、meta が期間・役割の1行。
// core・facts の意味は CareerDetail 本体と同じ。節番号(ASSIGNMENT 01)はラテンのみの装飾なので
// コンポーネント側が index から作り、content には持たせない
export type CareerDetailAssignment = {
  client: string
  title: string
  meta: string
  lead?: string
  core?: { claim: string; body: string }
  facts: CareerFact[]
}

export type CareerDetail = {
  // 何を作っていたのかの総論。meta は期間・状態の1行
  overview: { title: string; body: string; meta: string }
  // 骨格を決めた最初の機能の現場フロー。持たない経歴もある
  origin?: { heading: string; lead?: string; flow: CareerFlowStep[]; note?: string }
  // 判断の核。1行の主張 + その理由
  core?: { claim: string; body: string }
  // 構成・担当範囲・数値などの事実の列。全ての経歴が持つ
  facts: CareerFact[]
  // 技術スタック表。groups は Web / Native などの層別、rows は facts と同じ label+value
  stacks?: { heading: string; groups: CareerStackGroup[] }
  // 機能一覧。持たない経歴もある
  features?: { heading: string; lead?: string; items: CareerFeature[] }
  // 本体の外でやったことの列。持たない経歴もある
  asides?: { heading: string; items: CareerAside[] }
  // 派遣先ごとの担当内容。在籍1社・派遣先複数の経歴だけが持つ
  assignments?: CareerDetailAssignment[]
}

// ---------- プロフィール ----------

// 左列の経歴ブロックに出す派遣先の1行。在籍1社の中の配属を期間付きで並べる
export type CareerAssignment = { period: string; label: string }

export type Career = {
  // 右列の差し替え対象を指す安定キー。表示しないので社名を含めない。ja/koで同じ値
  id: string
  company: string
  period: string
  // 在籍1社の中で派遣先が替わった経歴だけが持つ。表示は左列の経歴ブロック内の小さな行
  assignments?: CareerAssignment[]
  // その在籍期間で実際に触れた技術(08段階の左列 .cv .tech)
  stack: string[]
  role: string
  summary: string
  highlights: string[]
  // 右列に差し替えで出す担当業務の詳細。持たない経歴はトリガー自体を出さない
  detail?: CareerDetail
}

export type Strength = {
  title: string
  body: string
}

// 外部プロフィールへの導線(08段階の左列 .out)
// email は mailto: を組み立てる素のアドレス。スキームはコンポーネント側で付ける
export type ProfileLinks = {
  github?: string
  email?: string
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
