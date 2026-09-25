// 言語ルート共通の <html> 枠。(ja)/(ko) の layout はこれに locale を渡すだけにし、
// lang 属性と本文書体(Noto JP / KR)の差し替えだけをここで持つ。globals.css は各 layout 側で読む
import type { ReactNode } from 'react'
import type { Locale } from '@content/types/content'
import PageviewCounter from '@/components/ui/PageviewCounter'

type HtmlShellProps = {
  locale: Locale
  children: ReactNode
}

// 文字列 'theme' は THEME_STORAGE_KEY と同じ値を保つ
const THEME_INIT = `;(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}})()`

// Google Fonts の配信 CSS(自前 @font-face は持たない)。Inter・Playfair は共通、本文書体だけ言語で切り替える。
// Noto Sans は可変フォントなので太さを 400..700 の範囲で1回だけ要求する。400;500;700 と列挙すると
// 届くフォントファイルは同じまま、描画を止める CSS だけが太さの数だけ @font-face を繰り返して膨らむ
const FONT_HREF: Record<Locale, string> = {
  ja: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Noto+Sans+JP:wght@400..700&family=Noto+Serif+JP:wght@400&family=Playfair+Display:wght@400&display=swap',
  ko: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Noto+Sans+KR:wght@400..700&family=Noto+Serif+KR:wght@400&family=Playfair+Display:wght@400&display=swap',
}

// 計測先はリポジトリに書かず、配信の workflow が GitHub の変数から渡す。無ければ計測タグを出さない
const GOATCOUNTER_URL = process.env.NEXT_PUBLIC_GOATCOUNTER_URL

// スキップリンクの文言は content から取るため各ページ側(VillagePage 等)が持つ
function HtmlShell({ locale, children }: HtmlShellProps) {
  return (
    <html lang={locale} data-theme='light'>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
        <link rel='stylesheet' href={FONT_HREF[locale]} />
        {GOATCOUNTER_URL ? (
          <script data-goatcounter={GOATCOUNTER_URL} async src='https://gc.zgo.at/count.js' />
        ) : null}
      </head>
      <body>
        <PageviewCounter />
        {children}
      </body>
    </html>
  )
}

export default HtmlShell
