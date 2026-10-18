// 作品カード(状態コンテナ)の、キャプチャ枠の中身(ShotMedia)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、動画・リール・静止画・準備中の文言の出し分けを、
// 利用者に見える形(要素の有無・行き先・aria-hidden・文字)で確かめる。
// 差し替えるのはネットワーク(場面 SVG の取得)と時間(リールの自動送り)だけ。
// props は一覧の container.fixture.ts が node で組んで provide した作品・文言を inject で受け取る。
// 実データに無い形(静止画を持たない作品など)は、作品の写しを変えてテストが直接渡す
import { act, cleanup, render, within } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import type { Work } from '@content/types/content'
import { sceneCycleMs } from '@/utils/cycle-scenes'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import playerStyles from '@/components/ui/ScenePlayer/scene-player.module.css'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  belowFold,
  cardOf,
  cardProps,
  holdSceneFetches,
  intersectionSettled,
  prepareEachTest,
  queryOrThrow,
  reelScenes,
  reelWork,
  releaseSceneFetches,
  restoreEachTest,
  settleNotice,
  shotOf,
  stillWork,
  ui,
  videoIn,
  videoWork,
} from '@/components/Directory/__tests__/directory.test-helper'

const reelOf = (work: Work) => queryOrThrow(shotOf(work), `.${shotStyles.reel}`)

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('キャプチャ枠の中身(ShotMedia)', () => {
  describe('動画', () => {
    it('画面に入るまでは、読み上げから外した動画にsrcを付けず、ポスターの静止画だけを出す', async () => {
      // カードを最初の画面の外に置く
      render(<WorkCard {...cardProps(videoWork)} />, { container: belowFold() })

      const shot = shotOf(videoWork)
      expect(
        cardOf(videoWork).getBoundingClientRect().top,
        'カードは最初の画面の外'
      ).toBeGreaterThan(window.innerHeight)
      await intersectionSettled(shot)
      await settleNotice()

      const video = videoIn(shot)
      expect(video.getAttribute('aria-hidden')).toBe('true')
      expect(video.hasAttribute('src')).toBe(false)
      expect(video.getAttribute('poster')).toBe(videoWork.thumbnail)
      expect(shot.querySelector('img')).toBeNull()
    })

    it('画面に入った後は動画のsrcを付け、再生中なら自動再生を付ける', async () => {
      render(<WorkCard {...cardProps(videoWork)} />)

      const video = videoIn(shotOf(videoWork))
      await expect
        .poll(() => video.getAttribute('src'), {
          message: '最初の画面にあるカードの動画は読み込む',
        })
        .toBe(videoWork.video)
      expect(video.hasAttribute('autoplay')).toBe(true)
      // ブラウザは音の出る動画の自動再生を止めるので、消音で流す
      expect(video.muted).toBe(true)
    })

    it('画面に入った後に一時停止すると自動再生を外し、止める相手はこの動画', async () => {
      const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
      render(<WorkCard {...cardProps(videoWork)} />)

      const shot = shotOf(videoWork)
      const video = videoIn(shot)
      await expect
        .poll(() => video.getAttribute('src'), {
          message: '最初の画面にあるカードの動画は読み込む',
        })
        .toBe(videoWork.video)

      await userEvent.click(within(shot).getByRole('button', { name: ui.work.pauseMotion }))
      await expect.poll(() => video.hasAttribute('autoplay')).toBe(false)
      expect(video.getAttribute('src')).toBe(videoWork.video)
      // 親の一時停止ボタンが止める相手(ShotMedia が受け取る videoRef)は、この枠の動画
      expect(pause.mock.contexts).toHaveLength(1)
      expect(pause.mock.contexts[0]).toBe(video)
    })
  })

  describe('リール', () => {
    it('読み上げから外した枠に場面を並べ、動画も静止画も出さない。取れない場面は準備中の文言に替わる', async () => {
      render(<WorkCard {...cardProps(reelWork)} />)

      const shot = shotOf(reelWork)
      const reel = reelOf(reelWork)
      expect(reel.getAttribute('aria-hidden')).toBe('true')
      expect(shot.querySelector('video')).toBeNull()
      expect(shot.querySelector('img')).toBeNull()
      expect(await within(reel).findAllByText(ui.work.shotPlaceholder)).toHaveLength(
        reelScenes.length
      )
    })

    it('自動送りで今の場面だけを見せる場面にし、ほかの場面は伏せる', () => {
      // 先頭以外を指す添字で見る(先頭固定の取り違えを見分けるため、場面が2つ以上ある前提)
      expect(reelScenes.length).toBeGreaterThanOrEqual(2)
      const activeIndex = reelScenes.length - 1
      // 時間だけを差し替え、場面ごとの周期で送る setTimeout を末尾の場面まで進める
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      render(<WorkCard {...cardProps(reelWork)} />)

      for (const scene of reelScenes.slice(0, activeIndex)) {
        act(() => {
          vi.advanceTimersByTime(sceneCycleMs(scene.id))
        })
      }
      const frames = [...reelOf(reelWork).querySelectorAll(`.${playerStyles.frame}`)]
      expect(frames.map(frame => frame.classList.contains(playerStyles.frameActive))).toEqual(
        reelScenes.map((_, index) => index === activeIndex)
      )
    })

    it('再生中は、どの場面の動きも止めない', async () => {
      // 場面 SVG の受け皿が止めた印を持つ。取得の失敗で文言へ替わると受け皿ごと消えるので、数え終わるまで取得を返さない
      holdSceneFetches()
      render(<WorkCard {...cardProps(reelWork)} />)

      const reel = reelOf(reelWork)
      expect(reel.querySelectorAll(`.${playerStyles.sceneSvg}`)).toHaveLength(reelScenes.length)
      expect(reel.querySelectorAll('[data-paused]')).toHaveLength(0)

      // 取れない場面は準備中の文言に替わる。待たずに終えると、失敗の通知がテストの外で状態を更新する
      releaseSceneFetches()
      await within(reel).findAllByText(ui.work.shotPlaceholder)
    })

    it('一時停止中は、すべての場面の動きを止める', async () => {
      holdSceneFetches()
      render(<WorkCard {...cardProps(reelWork)} />)

      const reel = reelOf(reelWork)
      await userEvent.click(
        within(shotOf(reelWork)).getByRole('button', { name: ui.work.pauseMotion })
      )
      await expect.poll(() => reel.querySelectorAll('[data-paused]').length).toBe(reelScenes.length)

      releaseSceneFetches()
      await within(reel).findAllByText(ui.work.shotPlaceholder)
    })
  })

  describe('静止画と準備中の文言', () => {
    const stillCases: [string, Work][] = [
      ['動きを持たない作品は', stillWork],
      // リールの指示だけを残して場面を外した写し。場面が無ければリールにならない
      ['リールの指示があっても場面を持たない作品は', { ...reelWork, story: undefined }],
    ]

    it.each(stillCases)('%s、作品の静止画を装飾として出す', (_label, work) => {
      render(<WorkCard {...cardProps(work)} />)

      const shot = shotOf(work)
      const image = queryOrThrow(shot, 'img')
      expect(image.getAttribute('src')).toBe(work.thumbnail)
      expect(image.getAttribute('alt')).toBe('')
      expect(shot.querySelector('video')).toBeNull()
      expect(shot.querySelector(`.${shotStyles.reel}`)).toBeNull()
    })

    it('静止画も持たない作品では、準備中の文言を出す', () => {
      const work: Work = { ...stillWork, thumbnail: undefined }
      render(<WorkCard {...cardProps(work)} />)

      const shot = shotOf(work)
      expect(within(shot).getByText(ui.work.shotPlaceholder)).toBeDefined()
      expect(shot.querySelector('img')).toBeNull()
    })
  })
})
