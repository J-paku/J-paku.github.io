import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext/LocaleProvider'
import type { Work } from '@/types/content'
import { DEFAULT_SCENE_ANIMATION_DURATION_MS } from '@/utils/scene-durations'
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

// jsdom(Node の実 fetch)は相対URLを解決できず常に失敗する。ScenePlayer(SceneSvg)が場面SVGを
// fetch で取得する経路を実行させ、プレースホルダへ落ちずに場面がそのまま描画されるようにするため、
// 有効な最小SVGを返すスタブをこのファイルの中だけで与える(実ブラウザでのアセット取得は保証しない)
const STUB_SCENE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" data-stub-scene="true"></svg>'
beforeAll(() => {
  globalThis.fetch = (async () => new Response(STUB_SCENE_SVG, { status: 200 })) as typeof fetch
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

// storyReel を持つ作品。meishi-cross-platform と同じく links を持たず story だけを持つ形にする
// (hasStoryOverlay 経路も一緒に確かめられる)
const REEL_WORK: Work = {
  ...work,
  slug: 'reel-work',
  thumbnail: '/shots/reel-work.png',
  storyReel: true,
  story: {
    intro: { title: 'イントロ見出し', lead: 'イントロ導入' },
    scenes: [
      { id: 'scene-a', title: '場面A', body: '場面Aの本文', chips: [], image: '/works/reel/scene-a.svg' },
      { id: 'scene-b', title: '場面B', body: '場面Bの本文', chips: [], image: '/works/reel/scene-b.svg' },
    ],
    outro: { title: 'まとめ見出し', body: 'まとめ本文', stackSummary: [] },
  },
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
  it('pauseMotion/resumeMotion の文言が動画専用ではなく動画・リール双方に通用する表現になっている', () => {
    expect(ui.work.pauseMotion).toBe('デモの動きを一時停止')
    expect(ui.work.resumeMotion).toBe('デモの動きを再生')
  })

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

    const toggle = screen.getByRole('button', { name: ui.work.pauseMotion })
    expect(toggle).toBeInTheDocument()
    // ラベルの参照だけでなく実際の文言も単言する(動画専用文言の混入を検出できるように)
    expect(toggle).toHaveAccessibleName('デモの動きを一時停止')

    fireEvent.click(toggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ui.work.resumeMotion })).toBeInTheDocument()
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
    const videoToggle = screen.getByRole('button', { name: ui.work.pauseMotion })
    expect(videoToggle).toBeInTheDocument()

    fireEvent.click(videoToggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ui.work.resumeMotion })).toBeInTheDocument()

    // 動画トグルの押下がオーバーレイの onClick(背景タップ=閉じる)へ伝播していない
    // (stopPropagation が効いていれば開いたまま。伝播すれば aria-expanded が false に落ちる)
    expect(overlayTrigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('storyReel を持つ作品はサムネイル画像の代わりに ScenePlayer の場面を描画し、shot 全面が一時停止トグルになる', async () => {
    const { container } = renderWorkCard(REEL_WORK, 0)

    // サムネイル画像は描画されない(story場面の循環リールがその位置を占める)
    expect(container.querySelector('img')).toBeNull()

    // デスクトップ(fine pointer)では shot 全面が一時停止トグルになる(動画カードと同じ規則)
    expect(screen.getByRole('button', { name: ui.work.pauseMotion })).toBeInTheDocument()

    // ScenePlayer(SceneSvg)の場面が実際にシャドウルートへ展開されている
    await waitFor(() => {
      const hosts = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
      const rendered = hosts.some((host) => host.shadowRoot?.innerHTML.includes('data-stub-scene') === true)
      expect(rendered).toBe(true)
    })
  })

  it('storyReel の全面トグルを押すとラベルが再生用に入れ替わる(WCAG 2.2.2)', async () => {
    const { container } = renderWorkCard(REEL_WORK, 0)

    // 場面SVGの非同期取得を先に確定させる(act 警告を避けるため、クリック前に済ませておく)
    await waitFor(() => {
      const hosts = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
      expect(hosts.some((host) => host.shadowRoot?.innerHTML.includes('data-stub-scene') === true)).toBe(true)
    })

    const toggle = screen.getByRole('button', { name: ui.work.pauseMotion })
    // ラベルの参照(ui.work.pauseMotion)が一致するだけでは、動画専用文言の使い回しを見逃す
    // (今回の実欠陥の原因)。実際の文言そのものが動画・リール双方に通用する表現であることを
    // リテラルで単言する
    expect(toggle).toHaveAccessibleName('デモの動きを一時停止')
    fireEvent.click(toggle)

    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).not.toBeInTheDocument()
    const resumed = screen.getByRole('button', { name: ui.work.resumeMotion })
    expect(resumed).toHaveAccessibleName('デモの動きを再生')
  })

  it('storyReel を持つ作品もモーション抑制環境ではリールの代わりに静止画(thumbnail)を描画する', () => {
    reducedMotionMatches = true
    const { container } = renderWorkCard(REEL_WORK, 0)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(REEL_WORK.thumbnail)
  })

  it('ロケール切替相当(WorkCard再マウント無しでworkだけ差し替え)で場面数が減っても reelIndex の添字事故で例外を投げない', () => {
    vi.useFakeTimers()
    try {
      const threeScenes: Work = {
        ...REEL_WORK,
        story: {
          ...REEL_WORK.story!,
          scenes: [
            { id: 'x1', title: 't1', body: 'b1', chips: [], image: '/works/reel/x1.svg' },
            { id: 'x2', title: 't2', body: 'b2', chips: [], image: '/works/reel/x2.svg' },
            { id: 'x3', title: 't3', body: 'b3', chips: [], image: '/works/reel/x3.svg' },
          ],
        },
      }
      const { rerender } = render(
        <MemoryRouter initialEntries={['/']}>
          <LocaleProvider>
            <WorkCard work={threeScenes} index={0} />
          </LocaleProvider>
        </MemoryRouter>,
      )

      // 自動送りタイマーを2回進め、reelIndexを3件中の末尾(2)まで進める
      act(() => {
        vi.advanceTimersByTime(DEFAULT_SCENE_ANIMATION_DURATION_MS)
      })
      act(() => {
        vi.advanceTimersByTime(DEFAULT_SCENE_ANIMATION_DURATION_MS)
      })

      // 場面数が1件だけの work へ差し替える(ロケール切替でWorkCardが再マウントされず
      // reelIndexだけが引き継がれる状況を再現する)。reelIndex(=2)は新しい配列(長さ1)の
      // 範囲外になるが、剰余で常に有効な添字に丸めるため例外を投げずに描画できるはず
      const oneScene: Work = {
        ...threeScenes,
        story: { ...threeScenes.story!, scenes: [threeScenes.story!.scenes[0]] },
      }

      expect(() => {
        rerender(
          <MemoryRouter initialEntries={['/']}>
            <LocaleProvider>
              <WorkCard work={oneScene} index={0} />
            </LocaleProvider>
          </MemoryRouter>,
        )
        act(() => {
          vi.advanceTimersByTime(DEFAULT_SCENE_ANIMATION_DURATION_MS)
        })
      }).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })
})
