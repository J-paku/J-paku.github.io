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
    pauseScene: '自動送りを一時停止',
    resumeScene: '自動送りを再開',
  },
  // 左列の経歴から右列に差し替える担当業務詳細パネルの文言(11段階)。作品一覧タブのラベルは work.index を再利用する
  career: {
    openDetail: '担当業務の詳細',
    tabDetail: '担当業務',
    backToWorks: '作品一覧へ戻る',
    roleDesign: '設計',
    roleBuild: '実装',
    roleRelease: 'リリース',
    roleOwned: '担当',
    roleNotOwned: '担当外',
  },
  colophon: {
    copyright: '© 2026 朴 裁弘',
    credit: 'Design explored with Variant',
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'お探しのページは存在しないか、移動または削除された可能性があります。',
    backHome: 'ホームへ戻る',
  },
}
