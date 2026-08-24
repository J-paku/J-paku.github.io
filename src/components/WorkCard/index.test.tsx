import { beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext/LocaleProvider'
import type { Work } from '@/types/content'
import { ui } from '@content/ja/ui'
import WorkCard from './index'

// jsdom 29.1.1 は matchMedia を実装していない。use-reveal が prefers-reduced-motion の判定に呼ぶため、
// このファイルの中だけで最小限のスタブを与える(実ブラウザの挙動保証はしない)
beforeAll(() => {
  if (typeof window.matchMedia === 'function') return
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
})

const TITLE = '在庫管理システム'
const PERIOD = '2024.04–2024.09'
const ROLE = 'フロントエンド'
const SCALE = '1人'

// links・detail を持たない最小の Work。overlay・詳細トグルが出ないことの確認も兼ねる
const work: Work = {
  slug: 'sample-work',
  status: 'published',
  title: TITLE,
  tagline: '入出庫を一元管理するアプリ',
  context: '自社開発',
  contextKind: 'work',
  period: PERIOD,
  role: ROLE,
  scale: SCALE,
  stack: ['React', 'TypeScript'],
  links: {},
}

// WorkCard は useLocation(hash 判定)・useLocale(PhraseText 等)を使うため Router で包む
function renderWorkCard(target: Work, index: number) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LocaleProvider>
        <WorkCard work={target} index={index} />
      </LocaleProvider>
    </MemoryRouter>,
  )
}

describe('WorkCard', () => {
  it('タイトル・通し番号・仕様表(期間/役割/規模)を props から描画する', () => {
    renderWorkCard(work, 0)

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(TITLE)
    expect(screen.getByText('NO.01')).toBeInTheDocument()

    const periodRow = screen.getByText(ui.work.period).closest('dt')
    expect(periodRow?.nextElementSibling?.textContent).toBe(PERIOD)
    expect(screen.getByText(ROLE)).toBeInTheDocument()
    expect(screen.getByText(SCALE)).toBeInTheDocument()
  })

  it('links・detail を持たない作品は詳細トグルとリンクオーバーレイのトリガーを出さない', () => {
    renderWorkCard(work, 0)

    expect(screen.queryByRole('button', { name: ui.work.showDetail })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ui.work.openLinks })).not.toBeInTheDocument()
  })
})
