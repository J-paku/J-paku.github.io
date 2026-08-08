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
    light: 'ライト',
    dark: 'ダーク',
  },
  work: {
    index: '作品一覧',
    openLinks: 'リンクを開く',
    wipBadge: '準備中',
    period: '期間',
    role: '役割',
    scale: '規模',
    stack: '技術',
    live: '公開ページ',
    repo: 'リポジトリ',
    backToList: '作品一覧へ戻る',
    shotPlaceholder: '画面キャプチャは準備中',
  },
  quality: {
    title: '品質指標',
    measuredAt: '計測日時',
    violations: '違反件数',
    viewRun: '実行結果を見る',
    // フッターの計測票。値を持たず、計測環境と既知の弱点だけを先に言う
    footer: {
      label: 'MEASURED',
      environment:
        'Lighthouseは「/」を1回のみ計測。axe-coreは「/」「/ko」の2URLを検査',
      limitation:
        'コマンドパレット展開時やwip作品ページの内部状態は対象外 — 実測が届く範囲だけを担保している',
    },
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'お探しのページは存在しないか、移動または削除された可能性があります。',
    backHome: 'ホームへ戻る',
  },
  commandPalette: {
    openButtonLabel: 'コマンドパレットを開く',
    title: 'コマンドパレット',
    searchLabel: 'コマンドを検索',
    placeholder: '作品・言語・テーマを検索',
    resultCount: '{count}件のコマンドが見つかりました',
    groupWorks: '作品',
    groupLocale: '言語',
    groupTheme: 'テーマ',
    groupExternal: '外部リンク',
  },
}
