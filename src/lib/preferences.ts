// localStorage へのアクセスはこのファイルに集約する(アプリ内で唯一の外部境界)。
// 保存対象はテーマのみ。言語は URL が正本なのでここには持たない
export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme-preference'

const isThemePreference = (value: string): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark'

// localStorage はプライベートモード等で例外を投げうるので必ず握る。
// 旧バージョン・破損値が保存されていた場合も検証して弾き、system にフォールバックする
export const readTheme = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored !== null && isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export const writeTheme = (value: ThemePreference): void => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // 書き込み失敗時は何もしない。次回起動時も system にフォールバックするだけで済む
  }
}
