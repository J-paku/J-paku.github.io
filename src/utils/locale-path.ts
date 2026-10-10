// パスと locale の相互変換のみを行う純粋関数群。
// locale の判定はここ一箇所に集約する(各所で pathname.startsWith('/ko') を書かせない)
import type { Locale } from '@content/types/content'

export const DEFAULT_LOCALE: Locale = 'ja'

// pathname から locale を取り出す。/ko 配下だけが ko('/korea' のような前方一致もどきは ja のまま)
export const parseLocale = (pathname: string): Locale =>
  pathname === '/ko' || pathname.startsWith('/ko/') ? 'ko' : 'ja'

// locale 接頭辞を取り除いた「素の」パスを返す。常に / 始まり(有効な絶対パス入力の場合)
export const stripLocale = (pathname: string): string => {
  if (pathname === '/ko') return '/'
  // '/ko/' 始まりなら残りは必ず '/' から始まるので、空になることは無い
  if (pathname.startsWith('/ko/')) return pathname.slice('/ko'.length)
  return pathname
}

// 'ja' 以外を一律に '/ko' とせず locale ごとに表で引く(表に無い値は接頭辞が undefined になり結果に表れる)
const LOCALE_PREFIX: Record<Locale, string> = { ja: '', ko: '/ko' }

// 素のパスに locale 接頭辞を付ける。ja は接頭辞なし。接頭辞があるときのルートは接頭辞だけ('/ko/' でなく '/ko')
export const withLocale = (pathname: string, locale: Locale): string => {
  const bare = stripLocale(pathname)
  const prefix = LOCALE_PREFIX[locale]
  return bare === '/' && prefix !== '' ? prefix : `${prefix}${bare}`
}

// 静的 export は trailingSlash: true で出力するため、リンクも末尾スラッシュ付きで作る。
// 付けないと GitHub Pages が 301 で付け直す1往復が増える
export const toHref = (pathname: string, locale: Locale): string => {
  const localized = withLocale(pathname, locale)
  return localized.endsWith('/') ? localized : `${localized}/`
}
