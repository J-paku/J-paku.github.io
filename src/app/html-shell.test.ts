// 言語ルート共通の <html> 枠(html-shell)のテスト。描かずに、呼んで返る React 要素の木と、
// 初回ペイント前にテーマを当てるインラインスクリプトの本文を見る。
// 計測タグの有無はモジュールを読む時点の環境変数で決まるので、変数を当ててから読み込み直す
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { THEME_STORAGE_KEY } from '@/lib/preferences'

const GOATCOUNTER_ENV = 'NEXT_PUBLIC_GOATCOUNTER_URL'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

// 計測先の環境変数を当て(undefined なら消し)、枠と PageviewCounter を同じモジュールの覚えから読み込み直す
const loadShell = async (goatcounter: string | undefined) => {
  vi.stubEnv(GOATCOUNTER_ENV, goatcounter)
  vi.resetModules()
  const [{ default: HtmlShell }, { default: PageviewCounter }] = await Promise.all([
    import('./html-shell'),
    import('@/components/ui/PageviewCounter'),
  ])
  return { HtmlShell, PageviewCounter }
}

// 枠を組み、<html> と、その子の <head>・<body> を返す
const buildShell = async (locale: 'ja' | 'ko', goatcounter?: string) => {
  const { HtmlShell, PageviewCounter } = await loadShell(goatcounter)
  const child = createElement('main', { id: 'main' })
  const html = HtmlShell({ locale, children: child })
  const [head, body] = html.props.children
  return { html, head, body, child, PageviewCounter }
}

// テーマのインラインスクリプトを、保存の読み出しと <html> の data-theme だけを持つ偽の大域で走らせる。
// 読んだ保存のキーと、走らせた後の data-theme を返す
const runThemeInit = (script: string, getItem: (key: string) => string | null) => {
  const keys: string[] = []
  const dataset: { theme?: string } = {}
  const storage = {
    getItem: (key: string) => {
      keys.push(key)
      return getItem(key)
    },
  }
  new Function('localStorage', 'document', script)(storage, { documentElement: { dataset } })
  return { keys, theme: dataset.theme }
}

const themeScriptOf = async () => {
  const { head } = await buildShell('ja')
  const [script] = head.props.children
  expect(script.type).toBe('script')
  return script.props.dangerouslySetInnerHTML.__html as string
}

describe('HtmlShell(<html> の枠)', () => {
  it.each(['ja', 'ko'] as const)(
    '%s を <html> の lang にし、既定のテーマ light で始める',
    async locale => {
      const { html } = await buildShell(locale)

      expect(html.type).toBe('html')
      expect(html.props.lang).toBe(locale)
      expect(html.props['data-theme']).toBe('light')
    }
  )

  it.each([
    ['ja', 'JP', 'KR'],
    ['ko', 'KR', 'JP'],
  ] as const)(
    '%s の本文書体は Noto Sans・Serif の %s だけを Google Fonts へ1本の CSS で求める',
    async (locale, own, other) => {
      const { head } = await buildShell(locale)
      const links = head.props.children.filter(
        (child: { type?: string } | null) => child?.type === 'link'
      )
      const stylesheets = links.filter(
        (link: { props: { rel: string } }) => link.props.rel === 'stylesheet'
      )
      expect(stylesheets).toHaveLength(1)
      const href: string = stylesheets[0].props.href

      expect(new URL(href).origin).toBe('https://fonts.googleapis.com')
      // 可変フォントなので太さは範囲で1回だけ求める(列挙すると @font-face だけが太さの数だけ増える)
      expect(href).toContain(`family=Noto+Sans+${own}:wght@400..700`)
      expect(href).toContain(`family=Noto+Serif+${own}:`)
      expect(href).not.toContain(other)
      expect(href).toContain('display=swap')
      // CSS と書体ファイルの配信元へ先に接続しておく(書体ファイルは CORS で取るので crossOrigin を付ける)
      expect(links.map((link: { props: object }) => link.props)).toEqual(
        expect.arrayContaining([
          { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
          { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        ])
      )
    }
  )

  it('本文では PageviewCounter を先に置き、受け取った子をその後ろにそのまま入れる', async () => {
    const { body, child, PageviewCounter } = await buildShell('ja')
    const [counter, rest] = body.props.children

    expect(body.type).toBe('body')
    expect(counter.type).toBe(PageviewCounter)
    expect(rest).toBe(child)
  })

  it('計測先の環境変数が無ければ、計測タグを出さない', async () => {
    const { head } = await buildShell('ja', undefined)
    const scripts = head.props.children.filter(
      (child: { type?: string } | null) => child?.type === 'script'
    )

    // 残る <script> はテーマのインラインスクリプトだけ
    expect(scripts).toHaveLength(1)
    expect(scripts[0].props.src).toBeUndefined()
  })

  it('計測先の環境変数があれば、その計測先を指す計測タグを非同期で読み込む', async () => {
    const url = 'https://example.goatcounter.com/count'
    const { head } = await buildShell('ja', url)
    const counters = head.props.children.filter(
      (child: { props?: object } | null) =>
        child !== null && child.props !== undefined && 'data-goatcounter' in child.props
    )

    expect(counters).toHaveLength(1)
    expect(counters[0].type).toBe('script')
    expect(counters[0].props).toEqual({
      'data-goatcounter': url,
      async: true,
      src: 'https://gc.zgo.at/count.js',
    })
  })
})

describe('テーマのインラインスクリプト(<head> の先頭)', () => {
  it.each(['dark', 'light'])(
    '保存したテーマ %s を、初回ペイント前に <html> の data-theme へ当てる',
    async theme => {
      const script = await themeScriptOf()

      // 読むキーは保存の窓口(src/lib/preferences.ts)が書くキーと同じ
      expect(runThemeInit(script, () => theme)).toEqual({ keys: [THEME_STORAGE_KEY], theme })
    }
  )

  it.each([null, '', 'blue', 'Dark'])(
    '保存がテーマでない値(%s)なら data-theme を書き換えない',
    async stored => {
      const script = await themeScriptOf()

      expect(runThemeInit(script, () => stored).theme).toBeUndefined()
    }
  )

  it('保存を読めない(読み出しが投げる)ときも、投げずに data-theme を書き換えない', async () => {
    const script = await themeScriptOf()
    const blocked = () => {
      throw new Error('SecurityError')
    }

    expect(() => runThemeInit(script, blocked)).not.toThrow()
    expect(runThemeInit(script, blocked).theme).toBeUndefined()
  })
})
