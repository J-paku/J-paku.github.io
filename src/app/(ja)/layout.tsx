// 日本語ルート。<html> の中身は HtmlShell が持ち、ここは locale を固定するだけ
import '@/app/globals.css'
import { createRootLayout } from '@/app/locale-routes'

export default createRootLayout('ja')
