// UI文字列(ナビ・言語切替・テーマ切替)の型。作品・プロフィール・スキルの型は02段階で反入される

export type Locale = 'ja' | 'ko'

export type UiStrings = {
  skipToMain: string
  nav: { works: string; now: string; skills: string; about: string }
  localeMenu: { label: string; ja: string; ko: string }
  theme: { label: string; system: string; light: string; dark: string }
}
