// 受け入れ基準(06-command-palette.md)のうちVitestで検証できる範囲:
// 開く→入力→ArrowDown→Enterでルートが変わること、Escape後にトリガーへフォーカスが戻ること、
// 検索がtitle・tagline・stackのいずれでも当たること、wip作品が一覧に出ないこと。
// フォーカストラップ・inert化はjsdomのshowModalシムでは検証できないため対象外(実ブラウザ側で確認する)
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import CommandPalette from './index'

// 現在のpathnameを画面へ描画するだけの検査用コンポーネント。ルート変化をDOMから読み取るため
function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="pathname">{pathname}</div>
}

function renderPalette(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <LocaleProvider>
          <CommandPalette />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </LocaleProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('CommandPalette', () => {
  it('1: 開く→入力→ArrowDown→Enterでルートが変わる', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))
    const input = screen.getByRole('textbox', { name: 'コマンドを検索' })

    // 「を」は公開作品2件のtagline両方に含まれ、外部リンク・言語・テーマ項目には含まれないため、
    // 絞り込み結果は作品2件(座席マップデモ→ai-harness)のみになる。ArrowDownで2件目(ai-harness)へ移動しEnterで遷移させる
    await user.type(input, 'を')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/works/ai-harness')
    })
  })

  it('2: Escapeで閉じ、トリガーへフォーカスが戻る', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    const trigger = screen.getByRole('button', { name: 'コマンドパレットを開く' })
    await user.click(trigger)
    const input = screen.getByRole('textbox', { name: 'コマンドを検索' })
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  })

  it('3: 検索はtitleに部分一致する', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))
    await user.type(screen.getByRole('textbox', { name: 'コマンドを検索' }), 'AIエージェント開発環境')

    // 作品項目自体は完全一致するラベルを持つ(外部リンク項目は末尾に" - 公開ページ"等が付き別ラベルになる)
    expect(screen.getByRole('option', { name: 'AIエージェント開発環境(ハーネス)' })).toBeInTheDocument()
  })

  it('4: 検索はtaglineに部分一致する', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))
    // ai-harnessのtagline「同じ依頼を、いつも同じ結果へ」に含まれる語
    await user.type(screen.getByRole('textbox', { name: 'コマンドを検索' }), '同じ依頼を')

    expect(screen.getByRole('option', { name: /AIエージェント開発環境/ })).toBeInTheDocument()
  })

  it('5: 検索はstackに部分一致する', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))
    // ai-harnessのstackに含まれる技術名
    await user.type(screen.getByRole('textbox', { name: 'コマンドを検索' }), 'Claude Code')

    expect(screen.getByRole('option', { name: /AIエージェント開発環境/ })).toBeInTheDocument()
  })

  it('6: wip作品は一覧に出ない', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))

    // gatchanko・meishi-cross-platformはcontent/ja/works配下でstatus: 'wip'
    expect(screen.queryByText('Gatchanko')).not.toBeInTheDocument()
  })

  it('7: 該当なしのとき件数がaria-live領域に反映される', async () => {
    const user = userEvent.setup()
    renderPalette('/')

    await user.click(screen.getByRole('button', { name: 'コマンドパレットを開く' }))
    await user.type(screen.getByRole('textbox', { name: 'コマンドを検索' }), 'zzz-該当なし-zzz')

    expect(screen.getByText('0件のコマンドが見つかりました')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
