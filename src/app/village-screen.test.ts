// 村ページのサーバの入口(village-screen)のテスト。描かずに、呼んで返る React 要素の型と props を見る。
// 画面のコンテナ(@/components/VillagePage)はここから実行時に import できない(scripts/check-layers.mjs の規則 3)ので、
// 要素の型は関数の名前で見る。サーバ専用の2要素(<style>・<script>)は、その要素の型と本文を見る
import { describe, expect, it, vi } from 'vitest'
import { listStorySlugs, readContent, readVillageText, readWorldSet } from '@/lib/content/read'
import { SHEET_KINDS } from '@/lib/pixel/sheet-file'
import sceneStyles from '@/components/VillagePage/components/Village/scene.module.css'
import { PHASE_INIT } from '@/components/VillagePage/utils/phase-init'
import { sheetUrl, spriteBackgroundCss } from '@/components/VillagePage/utils/sprite-css'
import { villageProps } from '@/components/VillagePage/utils/village-props'
import { DAY_PHASES } from '@/utils/day-phase'
import VillagePage from './village-screen'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('VillagePage(村ページの入口)', () => {
  it.each(['ja', 'ko'] as const)(
    '%s の content・村の文言・ワールド・ストーリーの slug で組んだデータをコンテナへ渡す',
    locale => {
      const element = VillagePage({ locale })
      const { spriteStyle, phaseInit, ...data } = element.props

      expect(element.type.name).toBe('VillagePageContainer')
      expect(data).toEqual(
        villageProps(
          locale,
          readContent(locale),
          readVillageText(locale),
          readWorldSet(),
          listStorySlugs(locale)
        )
      )
      // 渡すのはその言語の文言とワールドそのもの
      expect(data.text).toBe(readVillageText(locale))
      expect(data.worldSet).toBe(readWorldSet())
      // サーバ専用の2要素はデータと別の props で渡す
      expect(spriteStyle.type).toBe('style')
      expect(phaseInit.type).toBe('script')
    }
  )

  it('スプライトの背景規則を、村の scene.module.css のクラス名で組んで <style> の本文にする', () => {
    const { spriteStyle } = VillagePage({ locale: 'ja' }).props
    const css: string = spriteStyle.props.children

    expect(css).toBe(spriteBackgroundCss(sceneStyles))
    // 規則は呼び出し側が import したクラス名を指す(scene.module.css の出力位置を動かさないため、組む関数は import しない)
    expect(css).toContain(`.${sceneStyles.sprite}{`)
    expect(css).toContain(`.${sceneStyles.player}::before{`)
    expect(css).toContain(`.${sceneStyles.root}[data-phase=`)
    // 4 段階 × 2 種類のシートを、どれも背景として指す
    for (const kind of SHEET_KINDS) {
      for (const phase of DAY_PHASES) expect(css).toContain(`url('${sheetUrl(kind, phase)}')`)
    }
  })

  it('初回ペイント前に段階を直すスクリプト PHASE_INIT を、そのまま <script> の本文にする', () => {
    const { phaseInit } = VillagePage({ locale: 'ja' }).props

    expect(phaseInit.props).toEqual({ dangerouslySetInnerHTML: { __html: PHASE_INIT } })
  })
})
