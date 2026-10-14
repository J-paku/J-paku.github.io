// @vitest-environment happy-dom
// 作品カード(WorkCard)のうち、一覧の統合テスト(src/components/Directory/container.browser.test.tsx)へ移せない1件だけを残す。
// 移せないのは IntersectionObserver が無い環境。ブラウザでは読み込み済みのモジュールを読み直せず、後から
// IntersectionObserver を消すと、読み込み時に「ある」と覚えた next/link(画面右下の「マップで見る」など)が
// new IntersectionObserver を呼んで画面ごと落ちる(2026-10-14 の実測: next/dist/client/use-intersection.js の
// createObserver で TypeError)。カード1枚だけを happy-dom で描き、観察できない時の倒し方を利用者に見える形で確かめる
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Work } from '@content/types/content'
import WorkCard from './index'
// vitest は CSS を処理せず、CSS Modules を「キーから `_<キー>_<ファイル名のハッシュ>` を返す Proxy」に
// 置き換える(node_modules/vitest の CSSEnablerPlugin)。同じ module を import すれば部品と同じクラス名が引ける
import cardStyles from './work-card.module.css'
import shotStyles from './components/Shot/shot.module.css'

// server-only は Next.js のビルド境界専用ガードで、vitest では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works, ui } = readContent('ja')

const pickWork = (label: string, predicate: (work: Work) => boolean): Work => {
  const found = works.find(predicate)
  if (found === undefined) throw new Error(`${label}作品が content に無い`)
  return found
}

// 実操作デモ動画を持つ作品
const videoWork = pickWork('動画を持つ', work => work.video !== undefined)

const FINE_POINTER = '(hover: hover) and (pointer: fine)'

// matchMedia を「渡した問い合わせだけが一致する」形に差し替える。カードのフックは matches だけを読む
const stubMatchMedia = (matching: readonly string[]) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: matching.includes(query),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

const renderCard = (work: Work, index = 0) =>
  render(<WorkCard work={work} index={index} locale='ja' ui={ui} />)

const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector} が描かれていない`)
  return element
}

beforeEach(() => {
  // 既定はマウス操作・動きを許す設定
  stubMatchMedia([FINE_POINTER])
  // 外へ通信させない(差し替えないと happy-dom が :3000 へ接続しに行く)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
})

afterEach(() => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.unstubAllGlobals()
})

describe('交差を観察できるかどうか(use-reveal・use-fully-visible)', () => {
  it('IntersectionObserver が無い環境では、カードを隠さず写真も色付きで描く', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = renderCard(videoWork)

    // 表示してよい合図は動画の src を付けてよい合図も兼ねる
    expect(queryOrThrow(container, 'article').classList.contains(cardStyles.cardRevealed)).toBe(
      true
    )
    expect(queryOrThrow(container, 'video').getAttribute('src')).toBe(videoWork.video)
    // 画面に丸ごと収まっている印(写真の色を戻す)。判定できない環境では表示側へ倒す
    expect(
      queryOrThrow(container, `.${shotStyles.shot}`).classList.contains(shotStyles.shotInView)
    ).toBe(true)
  })
})
