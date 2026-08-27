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

// (hover: hover) and (pointer: fine) の判定結果を差し替えるためのフラグ。既定は true(デスクトップ)で、
// タッチ環境を確かめるテストだけ false に切り替える
let finePointerMatches = true

// jsdom 29.1.1 は matchMedia を実装していない。use-reveal・WorkCard 自身が prefers-reduced-motion・
// fine-pointer 判定の両方に呼ぶため、クエリ文字列ごとに異なる結果を返すスタブをこのファイルの中だけで
// 与える(実ブラウザの挙動保証はしない)
beforeAll(() => {
  if (typeof window.matchMedia === 'function') return
  window.matchMedia = (query: string): MediaQueryList => {
    let matches = false
    if (query === '(prefers-reduced-motion: reduce)') matches = reducedMotionMatches
    else if (query === '(hover: hover) and (pointer: fine)') matches = finePointerMatches
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  }
})

afterEach(() => {
  reducedMotionMatches = false
  finePointerMatches = true
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

  it('video を持つ作品はデスクトップ(fine pointer)で shot 全面が一時停止トグルになり、押すとラベルが再生用に入れ替わる(WCAG 2.2.2)', () => {
    const workWithVideo: Work = { ...work, thumbnail: '/shots/sample.png', video: '/shots/seatmap-demo-live.mp4' }
    renderWorkCard(workWithVideo, 0)

    const toggle = screen.getByRole('button', { name: ui.work.pauseVideo })
    expect(toggle).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseVideo })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ui.work.resumeVideo })).toBeInTheDocument()
  })

  it('video とリンクを持つ作品はタッチ(coarse pointer)で shot 全面がリンク覆いの開閉トリガーのままになり、動画の一時停止/再開はオーバーレイ内の別ボタンが担う', () => {
    finePointerMatches = false
    const workWithVideoAndLinks: Work = {
      ...work,
      thumbnail: '/shots/sample.png',
      video: '/shots/seatmap-demo-live.mp4',
      links: { live: 'https://example.com/live' },
    }
    renderWorkCard(workWithVideoAndLinks, 0)

    // shot 全面ボタンは動画トグルに変わらず、従来どおりリンク覆いの開閉トリガーのまま
    const overlayTrigger = screen.getByRole('button', { name: ui.work.openLinks })
    fireEvent.click(overlayTrigger)
    expect(overlayTrigger).toHaveAttribute('aria-expanded', 'true')

    // 動画の一時停止/再開はオーバーレイ内の別ボタンが担う(WCAG 2.2.2)
    const videoToggle = screen.getByRole('button', { name: ui.work.pauseVideo })
    expect(videoToggle).toBeInTheDocument()

    fireEvent.click(videoToggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseVideo })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ui.work.resumeVideo })).toBeInTheDocument()

    // 動画トグルの押下がオーバーレイの onClick(背景タップ=閉じる)へ伝播していない
    // (stopPropagation が効いていれば開いたまま。伝播すれば aria-expanded が false に落ちる)
    expect(overlayTrigger).toHaveAttribute('aria-expanded', 'true')
  })
})
