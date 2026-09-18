// 韓国語ルート。<html> の中身は HtmlShell が持ち、ここは locale を固定するだけ
import type { ReactNode } from 'react'
import '@/app/globals.css'
import HtmlShell from '@/app/html-shell'

type RootLayoutProps = { children: ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return <HtmlShell locale='ko'>{children}</HtmlShell>
}
