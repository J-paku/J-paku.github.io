// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction, StopText } from '@content/types/world'
import { writePosition } from '@/lib/preferences'
import VillagePageContainer from '@/components/VillagePage/container'
import { advanceUntil, focusVillage, villageFrame } from './village-walk.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 会話窓の中身 ----
// 会話窓(StopModal)が地点の文言のどれを描き、どれを描かないか。経歴の一覧・本文のリンクの開き方・コースの最後の案内・空の段落を、
// 利用者に見える物(role・名前・属性・要素の有無)で断定する。
// 時間は実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 待つ手順は village-walk.test-helper.ts。地点の前から始める時は、保存した位置から描く
describe('会話窓の中身', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id
  const { town } = villageJa.worldSet.worlds
  const dialog = page.getByRole('dialog')

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }

  // 村を描き、起動の覆いが外れたら枠へ焦点を置き(E2E の openVillage)、useStageScale が舞台の実測を --cell に書くまで待つ。
  // CSS の既定値だけでも近い寸法になるため、インラインの値で見る。実際のコンテンツでは作れない場合だけ、props を変えた版を overrides で渡す
  const renderVillage = async (overrides: Partial<typeof villageJa> = {}) => {
    render(<VillagePageContainer {...villageJa} {...overrides} />)
    await focusVillage()
    await advanceUntil(
      () => root().style.getPropertyValue('--cell') !== '',
      'useStageScale が --cell を書いた'
    )
  }

  // 町の地点の前に立った所から描き、話しかけて会話窓を開く。読み込み直後の最初の描画は保存を捨てるので、
  // 先に一度描いて外してから保存を置く(このテストだけを走らせた時も同じ所から始めるため)
  const talkAt = async (id: string): Promise<StopText> => {
    const spot = town.spots.find(candidate => candidate.id === id)
    if (spot === undefined) throw new Error(`町に ${id} の地点が無い`)
    const saved: { worldId: string; cell: Cell; facing: Direction } = {
      worldId: town.id,
      cell: spot.cell,
      facing: spot.facing,
    }
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writePosition(setId, saved)
    await renderVillage()
    await userEvent.keyboard('e')
    const stop = text.stops[id]
    await expect
      .element(dialog.getByRole('heading', { name: stop.title }), {
        message: `${stop.place}の会話窓が開く`,
      })
      .toHaveFocus()
    return stop
  }

  test('経歴碑の会話窓は、経歴の一覧を会社ごとにロゴの画像と一緒に並べる', async () => {
    const stop = await talkAt('monument')
    const entries = stop.entries ?? []
    expect(entries.length, '前提: 経歴碑には経歴が 2 件以上ある').toBeGreaterThanOrEqual(2)
    const items = Array.from(dialog.element().querySelectorAll('ol > li'))
    expect(items.length, '経歴の 1 件が一覧の 1 行').toBe(entries.length)
    entries.forEach((entry, index) => {
      const item = items[index]
      expect(item.textContent, `${index + 1} 行目に会社名`).toContain(entry.company)
      expect(item.textContent, `${index + 1} 行目に期間`).toContain(entry.period)
      const logo = item.querySelector('img')
      expect(logo?.getAttribute('src'), `${index + 1} 行目にロゴの画像`).toBe(entry.logo)
      expect(logo?.getAttribute('alt'), 'ロゴの読み上げ名は会社名').toBe(entry.company)
    })
  })

  test('作品ストーリーへの案内は同じタブで開き、外のページへの案内は新しいタブで開く', async () => {
    const story = await talkAt('meishi')
    if (story.link === undefined) throw new Error('名刺工房に本文のリンクが無い')
    const storyLink = dialog.getByRole('link', { name: story.link.label }).element()
    expect(storyLink.getAttribute('href'), '作品ストーリーの行き先').toBe(
      villageJa.stopHrefs.meishi
    )
    expect(storyLink.hasAttribute('target'), '作品ストーリーは同じタブ').toBe(false)
    expect(storyLink.hasAttribute('rel'), '同じタブなので rel も付けない').toBe(false)

    cleanup()
    const external = await talkAt('lab')
    if (external.link === undefined) throw new Error('インタラクション研究所に本文のリンクが無い')
    const externalLink = dialog.getByRole('link', { name: external.link.label }).element()
    expect(externalLink.getAttribute('href'), '外のページの行き先').toBe(villageJa.stopHrefs.lab)
    expect(externalLink.getAttribute('target'), '外のページは新しいタブ').toBe('_blank')
    expect(externalLink.getAttribute('rel'), '開いた先へ元の窓を渡さない').toBe('noopener')
  })

  test('コースの最後の地点の会話窓は、次の地点へ進むボタンの代わりに作品一覧への案内を出す', async () => {
    const stop = await talkAt('journey')
    const toList = dialog.getByRole('link', { name: stop.next, exact: true })
    await expect.element(toList).toHaveAttribute('href', villageJa.listHref)
    expect(
      dialog.getByRole('button', { name: stop.next, exact: true }).query(),
      '次の地点へ進むボタンは無い'
    ).toBeNull()
  })

  test('会話窓は空の段落を描かず、ロゴの無い経歴の行には画像を置かない', async () => {
    // 実際のコンテンツには根拠・補足・誘いの一言が空の地点も、ロゴの無い経歴も無いので、自室の地点の文言を変えた版で描く
    const entries = text.stops.monument.entries ?? []
    expect(entries.length, '前提: 経歴碑に経歴がある').toBeGreaterThanOrEqual(1)
    const home: StopText = {
      ...text.stops.home,
      proof: '',
      detail: '',
      hook: '',
      entries: [{ ...entries[0], logo: '' }],
    }
    await renderVillage({ text: { ...text, stops: { ...text.stops, home } } })
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: home.title })).toHaveFocus()
    const panel = dialog.element().querySelector('[data-village-panel]')
    if (panel === null) throw new Error('会話窓の本文が無い')
    // 本文の直下の段落は主張の 1 つだけ。空の根拠・補足・誘いの一言は <p> ごと描かない
    const paragraphs = Array.from(panel.querySelectorAll(':scope > p'))
    expect(
      paragraphs.map(paragraph => paragraph.textContent),
      '本文の直下の段落は主張だけ'
    ).toEqual([home.claim])
    const item = panel.querySelector('ol > li')
    expect(item?.textContent, '経歴の行は描く').toContain(entries[0].company)
    expect(panel.querySelector('img'), 'ロゴの無い行には画像を置かない').toBeNull()
  })
})
