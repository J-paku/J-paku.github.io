import { describe, expect, it } from 'vitest'
import type { Locale } from '@/types/content'
import { DEFAULT_LOCALE, parseLocale, stripLocale, withLocale } from './locale-path'

// 仕様書 01-shell.md の表 6行 + 追加境界値
// タプル: [入力, parseLocale期待値, stripLocale期待値, withLocale(・,'ko')期待値]
const cases: Array<[string, Locale, string, string]> = [
  ['/', 'ja', '/', '/ko'],
  ['/ko', 'ko', '/', '/ko'],
  ['/ko/', 'ko', '/', '/ko'],
  ['/works/x', 'ja', '/works/x', '/ko/works/x'],
  ['/ko/works/x', 'ko', '/works/x', '/ko/works/x'],
  // 罠行: startsWith('/ko') だけで判定すると /korea が ko に誤判定される
  ['/korea', 'ja', '/korea', '/ko/korea'],
]

describe('locale-path', () => {
  it('DEFAULT_LOCALE は ja', () => {
    expect(DEFAULT_LOCALE).toBe('ja')
  })

  it.each(cases)('%s', (pathname, expectedLocale, expectedStripped, expectedWithKo) => {
    expect(parseLocale(pathname)).toBe(expectedLocale)
    expect(stripLocale(pathname)).toBe(expectedStripped)
    expect(withLocale(pathname, 'ko')).toBe(expectedWithKo)
  })

  it('/korea は ko と誤判定されない(startsWith だけの実装への回帰防止)', () => {
    expect(parseLocale('/korea')).toBe('ja')
  })

  // 決定: 空文字列は本来 react-router から来ない(pathname は必ず / 始まり)が、
  // 例外を投げず決定的に動くことだけを保証する。'/' 始まりの不変条件は保証対象外とする
  it('空文字列は例外を投げず ja 扱い・無変換で通過する', () => {
    expect(parseLocale('')).toBe('ja')
    expect(stripLocale('')).toBe('')
    expect(withLocale('', 'ko')).toBe('/ko')
    expect(withLocale('', 'ja')).toBe('')
  })

  // 決定: 末尾スラッシュは正規化しない。locale 接頭辞の除去・付与のみ行い、
  // 末尾スラッシュの有無は入力の形をそのまま保持する
  it('末尾スラッシュは正規化されずそのまま保持される', () => {
    expect(parseLocale('/ko/works/x/')).toBe('ko')
    expect(stripLocale('/ko/works/x/')).toBe('/works/x/')
    expect(withLocale('/works/x/', 'ko')).toBe('/ko/works/x/')
  })

  // 決定: locale 接頭辞の一致は大文字小文字を区別する。実際のルートは常に小文字 /ko であり、
  // /KO を ko とみなす正規化は行わない(/korea を ja 扱いする保守的な方針と一貫させる)
  it('大文字の /KO は ja 扱い(大小無視の正規化はしない)', () => {
    expect(parseLocale('/KO')).toBe('ja')
    expect(stripLocale('/KO')).toBe('/KO')
    expect(withLocale('/KO', 'ko')).toBe('/ko/KO')
  })
})
