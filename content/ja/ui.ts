import type { UiStrings } from '@/types/content'

// Header・SettingsMenu などが消費するUI文字列(日本語)
export const ui: UiStrings = {
  skipToMain: 'メインコンテンツへスキップ',
  localeMenu: {
    label: '言語を選択',
    ja: '日本語',
    ko: '한국어',
  },
  settingsMenu: {
    label: '設定',
  },
  theme: {
    label: 'テーマを切り替え',
    light: 'ライト',
    dark: 'ダーク',
  },
  work: {
    index: '作品一覧',
    openLinks: 'リンクを開く',
    story: 'ストーリー',
    openStory: 'ストーリーを開く',
    wipBadge: '準備中',
    period: '期間',
    role: '役割',
    scale: '規模',
    stack: '技術',
    live: '公開ページ',
    repo: 'GitHub',
    shotPlaceholder: '画面キャプチャは準備中',
    showDetail: '詳しく見る',
    hideDetail: '閉じる',
  },
  workStory: {
    back: '一覧へ戻る',
    viewScene: '画面を見る',
    close: '閉じる',
    prevScene: '前の場面',
    nextScene: '次の場面',
  },
  quality: {
    // フッターの計測票。値を持たず、計測環境と既知の弱点だけを先に言う
    footer: {
      label: 'MEASURED',
      environment:
        'Lighthouseは「/」を1回のみ計測。axe-coreは「/」「/ko」の2URLを検査',
      limitation:
        'コマンドパレット展開時やwip作品ページの内部状態は対象外 — 実測が届く範囲だけを担保している',
    },
  },
  colophon: {
    copyright: '© 2026 朴',
    credit: 'Design explored with Variant',
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'お探しのページは存在しないか、移動または削除された可能性があります。',
    backHome: 'ホームへ戻る',
  },
}
