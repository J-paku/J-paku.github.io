// ルート定義と Provider の組み立てのみを行う。個々のロジックは各 Provider・ページ側に持たせる
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useContent } from '@/hooks/use-content'
import ThemeToggle from '@/components/ThemeToggle'
import Home from '@/pages/Home'
import NotFound from '@/pages/NotFound'

// SPAはルートが変わってもスクロール位置が保持されるため、遷移直後に
// 記事の途中から見える現象を防ぐ。ただしハッシュ付き遷移(#worksなどの
// アンカーリンク)はブラウザ標準のアンカー挙動を優先し、上端へは戻さない
function useScrollRestoration(): void {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])
}

// skip link の文言は ui.skipToMain に依るため、LocaleProvider の内側で consume する入れ物
function AppShell() {
  const { ui } = useContent()
  useScrollRestoration()

  return (
    <>
      <a className="skip-link" href="#main">
        {ui.skipToMain}
      </a>
      {/* 08段階: サイト共通ヘッダーは持たない。左列(Home内)が識別の役目を担い、
          テーマ切り替えだけが全ルートで固定表示される */}
      <ThemeToggle />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ko" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LocaleProvider>
          <AppShell />
        </LocaleProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
