// @vitest-environment happy-dom
// ブラウザ向けの束でlinkedomの代わりに入る差し替え(linkedom-browser-stub)の単体テスト。
// budouxがlinkedomから取り出す名前をすべて持ち、中身がブラウザ標準のDOMParserであることを見る。
// 束ね器のaliasが実際に効いているか(束からlinkedomが消えたか)はビルド産物の側の話で、ここでは見ない
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as stub from './linkedom-browser-stub'

// 束が読むのはbudouxのmodule/(package.jsonのexportsのimport条件)。require条件のdist/index.jsから辿る。
// module/tests/は配布物の検査用で、index.jsから辿れず束に入らないので除く
const budouxModuleDir = path.join(
  path.dirname(path.dirname(createRequire(import.meta.url).resolve('budoux'))),
  'module'
)
const budouxSources = readdirSync(budouxModuleDir, { recursive: true, encoding: 'utf8' })
  .filter(file => file.endsWith('.js') && !file.startsWith(`tests${path.sep}`))
  .map(file => readFileSync(path.join(budouxModuleDir, file), 'utf8'))

const LINKEDOM_FROM = /from\s*['"]linkedom['"]/g
const LINKEDOM_NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]linkedom['"]/g

// 名前付きimportの左辺(`X as Y`ならX)を集める
const importedNames = budouxSources.flatMap(source =>
  [...source.matchAll(LINKEDOM_NAMED_IMPORT)].flatMap(([, list]) =>
    list
      .split(',')
      .map(entry => entry.trim().split(/\s+as\s+/)[0])
      .filter(name => name.length > 0)
  )
)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('linkedom-browser-stub', () => {
  // 既定importや名前空間importに変わると、名前を並べるだけの差し替えでは受けられない
  it('budouxはlinkedomを名前付きimportだけで読んでいる(差し替えが名前で受けられる前提)', () => {
    const fromCount = budouxSources.reduce(
      (count, source) => count + [...source.matchAll(LINKEDOM_FROM)].length,
      0
    )
    const namedCount = budouxSources.reduce(
      (count, source) => count + [...source.matchAll(LINKEDOM_NAMED_IMPORT)].length,
      0
    )
    expect(fromCount).toBeGreaterThan(0)
    expect(namedCount).toBe(fromCount)
  })

  // budouxが版上げで取り出す名前を増やすと、差し替えに無い名前は束の中でundefinedになる
  it('budouxがlinkedomから取り出す名前をすべて書き出している', () => {
    expect(importedNames.length).toBeGreaterThan(0)
    expect(Object.keys(stub)).toEqual(expect.arrayContaining(importedNames))
  })

  it('ブラウザ標準のDOMParserを渡し、budouxのdom.jsと同じ呼び方で文書を組める', () => {
    expect(stub.DOMParser).toBe(globalThis.DOMParser)
    const doc = new stub.DOMParser().parseFromString(
      '<!doctype html><html><body><p>今日は<b>天気</b>です。</p></body></html>',
      'text/html'
    )
    expect(doc.body.textContent).toBe('今日は天気です。')
  })

  // 自前のDOM実装を抱えず、読み込んだ時点のglobalThisにあるものを渡すだけであること
  it('読み込んだ時点のglobalThis.DOMParserをそのまま渡す', async () => {
    class FakeDOMParser {}
    vi.stubGlobal('DOMParser', FakeDOMParser)
    vi.resetModules()
    const fresh = await import('./linkedom-browser-stub')
    expect(fresh.DOMParser).toBe(FakeDOMParser)
  })
})
