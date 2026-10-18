// 会話窓(StopModal)を直接描く統合テストが共有する props と、描いた物の読み方。
// 地点の文言・本文のリンクの行き先と開き方は、村が地点で話しかけた時と同じく(utils/pick-dialog.ts)、
// container.fixture.ts が provide した村の文言と行き先から組む。描く道具(@testing-library/react・react-dom)はここから import しない
// (npm run test:boundary)ので、窓を重ねる箱は各ファイルが描く
import { inject } from 'vitest'
import type { Direction, StopText } from '@content/types/world'
import type { StopModalProps } from '@/components/VillagePage/components/Village/components/StopModal/container'

const { lang, text, stopHrefs, stopExternal, listHref } = inject('villageJa')

// 地点の文言。無ければ前提が崩れているのでその場で落とす
export const stopTextOf = (id: string): StopText => {
  const stop = text.stops[id]
  if (stop === undefined) throw new Error(`${id} の地点の文言が無い`)
  return stop
}

// 窓が呼ぶ知らせ。テストが vi.fn で作って渡し、呼ばれ方を見る
export type StopHandlers = Pick<StopModalProps, 'onNext' | 'onClose'>

type StopOptions = {
  // 地点の文言を変えた版(実際のコンテンツでは作れない空の段落など)。省くと地点の文言のまま
  stop?: StopText
  hasNext?: boolean
  returnTo?: { current: HTMLElement | null }
  scrollHeldRef?: { current: Direction | null }
}

// 地点 id で話しかけた時の会話窓。次の地点がある(コースの途中)のを既定にする
export const stopProps = (
  id: string,
  handlers: StopHandlers,
  { stop, hasNext = true, returnTo, scrollHeldRef }: StopOptions = {}
): StopModalProps => ({
  stop: stop ?? stopTextOf(id),
  href: stopHrefs[id] ?? null,
  external: stopExternal[id] ?? false,
  lang,
  closeLabel: text.close,
  hasNext,
  listHref,
  scrollHeldRef: scrollHeldRef ?? { current: null },
  ...handlers,
  returnTo: returnTo ?? { current: null },
})

// 本文を描くパネル(E2E と同じく data-village-panel で指す)。無ければその場で落とす
export const stopPanel = (dialog: Element): HTMLElement => {
  const panel = dialog.querySelector<HTMLElement>('[data-village-panel]')
  if (panel === null) throw new Error('会話窓の本文が無い')
  return panel
}
