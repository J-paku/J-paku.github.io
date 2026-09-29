// @vitest-environment happy-dom
// 重ね表示の窓で焦点を移せる要素の並び(focusablesInと3つのセレクタ)のテスト。
// Tabの輪と押しっぱなしの焦点送りが同じ並びを読むので、何を含み何を外すか・並び順をここで固定する
import { afterEach, describe, expect, it } from 'vitest'
import {
  CLOCK_FOCUSABLE_SELECTOR,
  MAP_FOCUSABLE_SELECTOR,
  STOP_FOCUSABLE_SELECTOR,
  focusablesIn,
} from './focusables'

// 窓の中身を組み立てて根を返す。要素はidで見分ける(属性値は引用符なしで書けるものだけを使う)
const mount = (html: string): HTMLElement => {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

const idsOf = (elements: HTMLElement[]): string[] => elements.map(element => element.id)

// リンク・ボタンが入り混じり、焦点を移せないもの(hrefの無いa・disabledのボタン)も含む窓
const MIXED = `
  <section>
    <p>本文<a id=link href=/works/lab>作品へ</a><a id=bare>名前だけ</a></p>
    <button id=disabled disabled>押せない</button>
  </section>
  <div>
    <button id=next>次へ</button>
    <a id=external href=https://example.com>外へ</a>
    <button id=close>閉じる</button>
  </div>
`

afterEach(() => {
  document.body.replaceChildren()
})

describe('STOP_FOCUSABLE_SELECTOR', () => {
  it('会話窓はhref付きのリンクと押せるボタンをDOM順に並べる', () => {
    expect(idsOf(focusablesIn(mount(MIXED), STOP_FOCUSABLE_SELECTOR))).toEqual([
      'link',
      'next',
      'external',
      'close',
    ])
  })

  it('hrefの無いaとdisabledのボタンは焦点を移せないので外す', () => {
    const ids = idsOf(focusablesIn(mount(MIXED), STOP_FOCUSABLE_SELECTOR))
    expect(ids).not.toContain('bare')
    expect(ids).not.toContain('disabled')
  })

  it('空のhrefでもhref属性があればリンクとして含める', () => {
    // a[href]は属性の有無だけを見る。値の中身で外す実装に変わると本文中のリンクが輪から抜ける
    const root = mount('<a id=empty href>空</a><button id=ok>閉じる</button>')
    expect(idsOf(focusablesIn(root, STOP_FOCUSABLE_SELECTOR))).toEqual(['empty', 'ok'])
  })
})

describe('CLOCK_FOCUSABLE_SELECTOR', () => {
  it('卓上時計の窓は押せるボタンだけを並べ、リンクは含めない', () => {
    expect(idsOf(focusablesIn(mount(MIXED), CLOCK_FOCUSABLE_SELECTOR))).toEqual(['next', 'close'])
  })
})

describe('MAP_FOCUSABLE_SELECTOR', () => {
  it('セレクタはボタンを先に書いてあっても、並びはDOM順のまま', () => {
    // querySelectorAllはセレクタの順ではなく文書順で返す。ボタンを先に集める実装へ変えると
    // 拡大地図のTabの輪がリンクを最後へ回してしまう
    expect(idsOf(focusablesIn(mount(MIXED), MAP_FOCUSABLE_SELECTOR))).toEqual([
      'link',
      'next',
      'external',
      'close',
    ])
  })
})

describe('focusablesIn', () => {
  it('配列を返す(NodeListのままでは呼び出し側の添字計算・indexOfが使えない)', () => {
    const result = focusablesIn(mount(MIXED), STOP_FOCUSABLE_SELECTOR)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(4)
  })

  it('根そのものは数えず、子孫だけを集める', () => {
    // 根がボタンでも自分は含まない。会話窓は根をダイアログ全体にして、その中の操作ボタンを拾う
    const root = document.createElement('button')
    root.id = 'root'
    root.append(document.createElement('span'))
    document.body.append(root)
    expect(focusablesIn(root, CLOCK_FOCUSABLE_SELECTOR)).toEqual([])
  })

  it('根の外にある要素は拾わない', () => {
    const outside = mount('<button id=outside>外</button>')
    const root = mount('<button id=inside>中</button>')
    expect(outside.isConnected).toBe(true)
    expect(idsOf(focusablesIn(root, CLOCK_FOCUSABLE_SELECTOR))).toEqual(['inside'])
  })

  it('深く入れ子になった要素も拾う', () => {
    const root = mount('<div><div><ul><li><button id=deep>奥</button></li></ul></div></div>')
    expect(idsOf(focusablesIn(root, CLOCK_FOCUSABLE_SELECTOR))).toEqual(['deep'])
  })

  it('一致する要素が無ければ空の配列', () => {
    const root = mount('<p>本文だけ</p>')
    expect(focusablesIn(root, STOP_FOCUSABLE_SELECTOR)).toEqual([])
  })
})
