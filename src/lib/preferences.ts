// localStorage へのアクセスはこのファイルに集約する(アプリ内で唯一の外部境界)。
// 保存対象はテーマのみ。言語は URL が正本なのでここには持たない
//
// テーマは light / dark の2値。OS設定に追従する 'system' は廃止した。
// 旧バージョンが保存した 'system' は下の検証で弾かれ、既定の light になる
export type ThemePreference = 'light' | 'dark'

// このキー文字列は index.html の先行反映script(ブートローダー前のテーマ適用)も直接読む。
// あちらは React 起動前に走るため import できない。キーを変える時は index.html 側も同時に更新する
const THEME_STORAGE_KEY = 'theme-preference'

// 保存値が無い・壊れている・廃止済みの 'system' だった場合に落ちる先
const DEFAULT_THEME: ThemePreference = 'light'

const isThemePreference = (value: string): value is ThemePreference =>
  value === 'light' || value === 'dark'

// localStorage はプライベートモード等で例外を投げうるので必ず握る
export const readTheme = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored !== null && isThemePreference(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export const writeTheme = (value: ThemePreference): void => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // 書き込み失敗時は何もしない。次回起動時も既定へフォールバックするだけで済む
  }
}
