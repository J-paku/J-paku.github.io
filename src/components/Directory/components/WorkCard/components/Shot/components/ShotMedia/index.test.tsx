// @vitest-environment happy-dom
// 作品カードの画面キャプチャ枠の中身(ShotMedia)の統合テスト。親(WorkCard)が渡す出し分けの指示と
// 実データの作品で、動画・リール・静止画・準備中の文言のどれを描くかを、利用者に見える形
// (aria-*・要素の有無・読み込む先・文言)で確かめる
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Work } from '@content/types/content'
import ShotMedia from './index'
// 部品は親のshot.module.cssのクラス表を受け取る。同じmoduleをimportすれば部品と同じクラス名が引ける
import shotStyles from '../../shot.module.css'

// server-onlyはvitestでは無条件に例外を投げるため、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works, ui } = readContent('ja')

const pickWork = (label: string, predicate: (work: Work) => boolean): Work => {
  const found = works.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 実操作デモ動画を持つ作品
const videoWork = pickWork('動画を持つ', work => work.video !== undefined)
// ストーリー場面をサムネイル枠で循環させる作品
const reelWork = pickWork(
  'リールを持つ',
  work => work.storyReel === true && (work.story?.scenes.length ?? 0) > 0
)
const reelScenes = reelWork.story?.scenes ?? []
// 動画もリールも持たず、静止画だけを持つ作品
const stillWork = pickWork(
  '静止画だけを持つ',
  work => work.thumbnail !== undefined && work.video === undefined && work.storyReel !== true
)

type Direction = Partial<Omit<ComponentProps<typeof ShotMedia>, 'work' | 'ui' | 'styles'>>

// 既定は「動きを出さない・画面の外・再生中」。各テストが必要な指示だけ上書きする
const renderMedia = (work: Work, direction: Direction = {}) => {
  const videoRef = createRef<HTMLVideoElement>()
  const result = render(
    <ShotMedia
      work={work}
      ui={ui}
      styles={shotStyles}
      videoRef={videoRef}
      showVideo={false}
      shouldLoadVideo={false}
      showReel={false}
      storyScenes={work.story?.scenes}
      activeReelIndex={0}
      isMotionPaused={false}
      {...direction}
    />
  )
  return { ...result, videoRef }
}

const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector}が描かれていない`)
  return element
}

// リールの場面の取得が失敗し終えるまで待つ。テストでは通信させないので、どの場面も準備中の文言に替わる。
// 待たずに終えると、失敗の通知がテストの外で状態を更新する
const waitForScenesSettled = () => screen.findAllByText(ui.work.shotPlaceholder)

beforeEach(() => {
  // 外へ通信させない。リールの場面SVGは取得して描く(happy-domは相対URLをlocalhost:3000へ取りに行く)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('動画', () => {
  it('画面に入るまでは、読み上げから外した動画にsrcを付けず、ポスターの静止画だけを出す', () => {
    const { container } = renderMedia(videoWork, { showVideo: true, shouldLoadVideo: false })

    const video = queryOrThrow(container, 'video')
    expect(video.getAttribute('aria-hidden')).toBe('true')
    expect(video.hasAttribute('src')).toBe(false)
    expect(video.getAttribute('poster')).toBe(videoWork.thumbnail)
    expect(container.querySelector('img')).toBeNull()
  })

  it.each([
    ['再生中なら自動再生を付ける', false, true],
    ['一時停止中なら自動再生を外す', true, false],
  ])('画面に入った後は動画のsrcを付け、%s', (_label, isMotionPaused, autoplay) => {
    const { container, videoRef } = renderMedia(videoWork, {
      showVideo: true,
      shouldLoadVideo: true,
      isMotionPaused,
    })

    const video = queryOrThrow(container, 'video')
    expect(video.getAttribute('src')).toBe(videoWork.video)
    expect(video.hasAttribute('autoplay')).toBe(autoplay)
    // 親の一時停止ボタンが止める・再生する相手
    expect(videoRef.current).toBe(video)
  })
})

describe('リール', () => {
  it('読み上げから外した枠に場面を並べ、動画も静止画も出さない。取れない場面は準備中の文言に替わる', async () => {
    const { container } = renderMedia(reelWork, { showReel: true })

    const reel = queryOrThrow(container, `.${shotStyles.reel}`)
    expect(reel.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(await waitForScenesSettled()).toHaveLength(reelScenes.length)
  })

  it.each([
    ['一時停止中は、すべての場面の動きを止める', true, reelScenes.length],
    ['再生中は、どの場面の動きも止めない', false, 0],
  ])('%s', async (_label, isMotionPaused, pausedCount) => {
    const { container } = renderMedia(reelWork, { showReel: true, isMotionPaused })

    // 場面SVGの受け皿が止めた印を持つ(取得の失敗で文言へ替わる前に数える)
    expect(container.querySelectorAll('[data-paused]')).toHaveLength(pausedCount)
    await waitForScenesSettled()
  })
})

describe('静止画と準備中の文言', () => {
  const stillCases: [string, Work, Direction][] = [
    ['動きの指示が無ければ', stillWork, {}],
    [
      'リールの指示があっても場面が渡らなければ',
      reelWork,
      { showReel: true, storyScenes: undefined },
    ],
  ]

  it.each(stillCases)('%s、作品の静止画を装飾として出す', (_label, work, direction) => {
    const { container } = renderMedia(work, direction)

    const image = queryOrThrow(container, 'img')
    expect(image.getAttribute('src')).toBe(work.thumbnail)
    expect(image.getAttribute('alt')).toBe('')
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector(`.${shotStyles.reel}`)).toBeNull()
  })

  it('静止画も持たない作品では、準備中の文言を出す', () => {
    const { container } = renderMedia({ ...stillWork, thumbnail: undefined })

    expect(screen.getByText(ui.work.shotPlaceholder)).toBeDefined()
    expect(container.querySelector('img')).toBeNull()
  })
})
