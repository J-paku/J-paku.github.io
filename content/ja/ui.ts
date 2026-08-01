import type { UiStrings } from '@/types/content'

// Header・LocaleSwitcher・ThemeToggle が消費するUI文字列(日本語)
export const ui: UiStrings = {
  skipToMain: 'メインコンテンツへスキップ',
  nav: {
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
}
