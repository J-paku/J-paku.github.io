// ルート定義と Provider の組み立てのみを行う。個々のロジックは各 Provider・ページ側に持たせる
import { BrowserRouter, Routes, Route } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useLocale } from '@/hooks/use-locale'
import Header from '@/components/Header'
import Home from '@/pages/Home'
import WorkDetail from '@/pages/WorkDetail'
import NotFound from '@/pages/NotFound'

// skip link の文言は ui.skipToMain に依るため、LocaleProvider の内側で consume する入れ物
function AppShell() {
  const { ui } = useLocale()

  return (
    <>
      <a className="skip-link" href="#main">
        {ui.skipToMain}
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/works/:slug" element={<WorkDetail />} />
          <Route path="/ko" element={<Home />} />
          <Route path="/ko/works/:slug" element={<WorkDetail />} />
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
