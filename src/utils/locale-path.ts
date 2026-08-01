// パスと locale の相互変換のみを行う純粋関数群。
// locale の判定はここ一箇所に集約する(各所で pathname.startsWith('/ko') を書かせない)
import type { Locale } from '@/types/content'

export const DEFAULT_LOCALE: Locale = 'ja'

// pathname から locale を取り出す。/ko 配下だけが ko('/korea' のような前方一致もどきは ja のまま)
export const parseLocale = (pathname: string): Locale =>
  pathname === '/ko' || pathname.startsWith('/ko/') ? 'ko' : 'ja'

// locale 接頭辞を取り除いた「素の」パスを返す。常に / 始まり(有効な絶対パス入力の場合)
export const stripLocale = (pathname: string): string => {
  if (pathname === '/ko') return '/'
  if (pathname.startsWith('/ko/')) {
    const rest = pathname.slice('/ko'.length)
    return rest === '' ? '/' : rest
  }
  return pathname
}

// 素のパスに locale 接頭辞を付ける。ja は接頭辞なし
export const withLocale = (pathname: string, locale: Locale): string => {
  const bare = stripLocale(pathname)
  if (locale === 'ja') return bare
  return bare === '/' ? '/ko' : `/ko${bare}`
}
