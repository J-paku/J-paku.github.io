import type { UiStrings } from '@/types/content'

// Header・LocaleSwitcher・ThemeToggle が消費するUI文字列(日本語)
export const ui: UiStrings = {
  skipToMain: 'メインコンテンツへスキップ',
  nav: {
    label: 'サイト内ナビゲーション',
    works: '作品',
    now: '現在',
    skills: 'スキル',
    about: '私について',
  },
  localeMenu: {
    label: '言語を選択',
    ja: '日本語',
    ko: '한국어',
  },
  theme: {
    label: 'テーマを切り替え',
    system: 'システム',
    light: 'ライト',
    dark: 'ダーク',
  },
  work: {
    wipBadge: '準備中',
    period: '期間',
    role: '役割',
    scale: '規模',
    stack: '技術',
    live: '公開ページ',
    repo: 'リポジトリ',
    backToList: '作品一覧へ戻る',
  },
  quality: {
    title: '品質指標',
    measuredAt: '計測日時',
    violations: '違反件数',
    viewRun: '実行結果を見る',
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'お探しのページは存在しないか、移動または削除された可能性があります。',
    backHome: 'ホームへ戻る',
  },
}
