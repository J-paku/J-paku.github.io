// 会話窓(StopModal)を直接描き、地点の文言のどれを本文に描き、どれを描かないかを見る。
// 経歴の一覧・ロゴの画像・空の段落・本文のリンクの開き方を、利用者に見える物(role・名前・属性・要素の有無)で断定する。
// 村と同じく、大きさのある箱(村では枠)の中に重ねて描く。村の画面の中で地点に話しかけて開いた窓の中身は、画面全体を描く stop-content が見る
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import StopModal from '@/components/VillagePage/components/Village/components/StopModal/container'
import { stopPanel, stopProps, stopTextOf } from './stop-modal.test-helper'

const { lang, stopHrefs } = inject('villageJa')

// 村の枠と同じく、窓を重ねる大きさのある箱
const renderInBox = (modal: ReactNode) =>
  render(<div style={{ position: 'relative', width: 480, height: 640 }}>{modal}</div>)
const handlers = () => ({ onNext: vi.fn(), onClose: vi.fn() })

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('会話窓の本文', () => {
  const dialog = page.getByRole('dialog')

  test('見出しを窓の名前にし、場所・見出し・主張・根拠・補足・誘いの一言を地点の言語で描く', async () => {
    const stop = stopTextOf('home')
    expect([stop.proof, stop.detail, stop.hook], '前提: 自室の地点は段落が全部ある').not.toContain(
      ''
    )
    renderInBox(<StopModal {...stopProps('home', handlers())} />)
    await expect.element(dialog, { message: '見出しが窓の名前' }).toHaveAccessibleName(stop.title)
    expect(dialog.element().getAttribute('lang'), '窓の言語').toBe(lang)
    const panel = stopPanel(dialog.element())
    expect(panel.textContent, '場所の名前').toContain(stop.place)
    const paragraphs = Array.from(panel.querySelectorAll(':scope > p')).map(p => p.textContent)
    expect(paragraphs, '主張・根拠・補足・誘いの一言の段落をこの順で描く').toEqual([
      stop.claim,
      stop.proof,
      stop.detail,
      stop.hook,
    ])
  })

  test('経歴の一覧を会社ごとに、ロゴの画像・会社名・期間・本文で並べ、ロゴの無い行には画像を置かない', () => {
    const monument = stopTextOf('monument')
    const entries = monument.entries ?? []
    expect(entries.length, '前提: 経歴碑には経歴が 2 件以上ある').toBeGreaterThanOrEqual(2)
    // 実際のコンテンツにはロゴの無い経歴が無いので、最後の 1 件のロゴを外した版で描く
    const last = entries.length - 1
    const stop = {
      ...monument,
      entries: entries.map((entry, index) => (index === last ? { ...entry, logo: '' } : entry)),
    }
    renderInBox(<StopModal {...stopProps('monument', handlers(), { stop })} />)
    const items = Array.from(stopPanel(dialog.element()).querySelectorAll('ol > li'))
    expect(items.length, '経歴の 1 件が一覧の 1 行').toBe(entries.length)
    entries.forEach((entry, index) => {
      const item = items[index]
      expect(item.textContent, `${index + 1} 行目に会社名`).toContain(entry.company)
      expect(item.textContent, `${index + 1} 行目に期間`).toContain(entry.period)
      expect(item.textContent, `${index + 1} 行目に本文`).toContain(entry.body)
      const logo = item.querySelector('img')
      if (index === last) {
        expect(logo, 'ロゴの無い行には画像を置かない').toBeNull()
        return
      }
      expect(logo?.getAttribute('src'), `${index + 1} 行目にロゴの画像`).toBe(entry.logo)
      expect(logo?.getAttribute('alt'), 'ロゴの読み上げ名は会社名').toBe(entry.company)
    })
  })

  test('経歴の並びが空の地点は一覧を描かず、空の根拠・補足・誘いの一言は段落ごと描かない', () => {
    const stop = { ...stopTextOf('home'), entries: [], proof: '', detail: '', hook: '' }
    renderInBox(<StopModal {...stopProps('home', handlers(), { stop })} />)
    const panel = stopPanel(dialog.element())
    expect(panel.querySelector('ol'), '空の一覧は描かない').toBeNull()
    const paragraphs = Array.from(panel.querySelectorAll(':scope > p')).map(p => p.textContent)
    expect(paragraphs, '本文の直下の段落は主張だけ').toEqual([stop.claim])
  })

  test('作品ストーリーへの本文のリンクは同じタブで開き、外のページへのリンクは新しいタブで開く', () => {
    const story = stopTextOf('meishi')
    if (story.link === undefined) throw new Error('名刺工房に本文のリンクが無い')
    renderInBox(<StopModal {...stopProps('meishi', handlers())} />)
    const storyLink = dialog.getByRole('link', { name: story.link.label }).element()
    expect(storyLink.getAttribute('href'), '作品ストーリーの行き先').toBe(stopHrefs.meishi)
    expect(storyLink.hasAttribute('target'), '作品ストーリーは同じタブ').toBe(false)
    expect(storyLink.hasAttribute('rel'), '同じタブなので rel も付けない').toBe(false)
    cleanup()

    const external = stopTextOf('lab')
    if (external.link === undefined) throw new Error('インタラクション研究所に本文のリンクが無い')
    renderInBox(<StopModal {...stopProps('lab', handlers())} />)
    const externalLink = dialog.getByRole('link', { name: external.link.label }).element()
    expect(externalLink.getAttribute('href'), '外のページの行き先').toBe(stopHrefs.lab)
    expect(externalLink.getAttribute('target'), '外のページは新しいタブ').toBe('_blank')
    expect(externalLink.getAttribute('rel'), '開いた先へ元の窓を渡さない').toBe('noopener')
  })

  test('本文のリンクの文言があっても行き先が無い時は、リンクを描かない', () => {
    const story = stopTextOf('meishi')
    if (story.link === undefined) throw new Error('名刺工房に本文のリンクが無い')
    renderInBox(<StopModal {...stopProps('meishi', handlers())} href={null} />)
    expect(
      dialog.getByRole('link', { name: story.link.label }).query(),
      '行き先の無いリンクは描かない'
    ).toBeNull()
  })
})
