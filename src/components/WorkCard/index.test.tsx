import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext/LocaleProvider'
import type { Work } from '@/types/content'
import { ui } from '@content/ja/ui'
import WorkCard from './index'

// prefers-reduced-motion の判定結果を差し替えるためのフラグ。既定は false(モーション許可)で、
// reduce を確かめるテストだけ true に切り替える
let reducedMotionMatches = false

// jsdom 29.1.1 は matchMedia を実装していない。use-reveal・WorkCard 自身が prefers-reduced-motion の
// 判定に呼ぶため、このファイルの中だけで最小限のスタブを与える(実ブラウザの挙動保証はしない)
beforeAll(() => {
  if (typeof window.matchMedia === 'function') return
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: reducedMotionMatches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
})

afterEach(() => {
  reducedMotionMatches = false
})

// jsdom は HTMLMediaElement の play/pause を実装していない(呼ぶと「Not implemented」を吐く)。
// 動画トグルのテストのため prototype に最小限のスタブを与える(実ブラウザの挙動保証はしない)。
// play() は Promise を返す実 API に合わせ、resolved Promise を返す
beforeAll(() => {
  HTMLMediaElement.prototype.play = () => Promise.resolve()
  HTMLMediaElement.prototype.pause = () => {}
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

  it('video を持つ作品は動画を描画し、src が一致する', () => {
    const workWithVideo: Work = { ...work, thumbnail: '/shots/sample.png', video: '/shots/seatmap-demo-live.mp4' }
    const { container } = renderWorkCard(workWithVideo, 0)

    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe(workWithVideo.video)
    // muted は React で DOM プロパティとしてのみ反映され attribute には乗らない(jsdom の既知の挙動)ため、
    // プロパティ側で確認する
    expect((video as HTMLVideoElement).muted).toBe(true)
  })

  it('モーション抑制環境では動画の代わりに静止画を描画する', () => {
    reducedMotionMatches = true
    const workWithVideo: Work = { ...work, thumbnail: '/shots/sample.png', video: '/shots/seatmap-demo-live.mp4' }
    const { container } = renderWorkCard(workWithVideo, 0)

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(workWithVideo.thumbnail)
  })

  it('video を持つ作品は一時停止トグルを持ち、押すとラベルが再生用に入れ替わる(WCAG 2.2.2)', () => {
    const workWithVideo: Work = { ...work, thumbnail: '/shots/sample.png', video: '/shots/seatmap-demo-live.mp4' }
    renderWorkCard(workWithVideo, 0)

    const toggle = screen.getByRole('button', { name: ui.work.pauseVideo })
    expect(toggle).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseVideo })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ui.work.resumeVideo })).toBeInTheDocument()
  })
})
