// (ja)/(ko)のlayout・not-found・pageが共有する中身を、localeを受けて組み立てる。
// 各ルートファイルはここへ自分の経路に合ったlocaleのリテラルを渡すだけにする(localeはURLだけで決まる)。
// 画面本体(VillagePage・Directory)はここでimportしない。このファイルはlayout経由で全ページが読むため、
// 画面をimportするとそのクライアントJS・CSSが無関係なページにまで載る。画面は各pageが自分でimportする
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import type { Locale } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import { toHref } from '@/utils/locale-path'
import HtmlShell from '@/app/html-shell'

type RootLayoutProps = { children: ReactNode }

// <html>の枠はHtmlShellが持つ。globals.cssはここではなく各layout側で読む
export const createRootLayout = (locale: Locale) =>
  function RootLayout({ children }: RootLayoutProps) {
    return <HtmlShell locale={locale}>{children}</HtmlShell>
  }

// 言語ルート内のnotFound()用。直リンクの404はpublic/404.htmlが担う
export const createNotFound = (locale: Locale) =>
  function NotFound() {
    const { ui } = readContent(locale)
    return (
      <main id='main'>
        <h1>{ui.notFound.title}</h1>
        <p>{ui.notFound.body}</p>
        <a href={toHref('/list', locale)}>{ui.notFound.backHome}</a>
      </main>
    )
  }

// 村ページのメタデータ。表示文字列はcontentから組み立てる
export const createVillageMetadata = (locale: Locale): Metadata =>
  buildMetadata({
    locale,
    pathname: '/',
    title: readContent(locale).profile.name,
    description: readVillageText(locale).intro,
  })

// 一覧ページのメタデータ。表示文字列はcontentから組み立てる
export const createListMetadata = (locale: Locale): Metadata =>
  buildMetadata({
    locale,
    pathname: '/list',
    title: `${readContent(locale).ui.work.index} — ${readContent(locale).profile.name}`,
    description: readContent(locale).profile.headline,
  })
