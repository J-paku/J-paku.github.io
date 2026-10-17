// 吹き出し(TalkBubble)を直接描く統合テストが共有する props と、描いた物の読み方。
// 文言は村が地点の前で出すものと同じ手(utils/spot-text.ts)で、container.fixture.ts が provide した村の文言から組む。
// 描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)ので、枠と world 層は各ファイルが描く
import { inject } from 'vitest'
import type { TalkBubbleProps } from '@/components/VillagePage/components/Village/components/TalkBubble/container'
import {
  arriveSpeech,
  talkLabelOf,
} from '@/components/VillagePage/components/Village/utils/spot-text'

const { lang, text, worldSet } = inject('villageJa')

// 台詞を出す地点。自室の出発の机(村が最初に吹き出しを出す所)
const home = worldSet.worlds.room.spots.find(spot => spot.id === 'home')
if (home === undefined) throw new Error('自室に出発の机(home)の地点が無い')

// 指す点(マス単位)
export type BubblePoint = TalkBubbleProps['at']

// 地点の前で出す台詞の吹き出し。形(kind)は既定の台詞のまま渡さない
export const speechProps = (at: BubblePoint, onAction: () => void): TalkBubbleProps => ({
  text: arriveSpeech(text, home),
  lang,
  at,
  actionLabel: talkLabelOf(text, home),
  onAction,
})

// 話せる相手がいない時の考え事の吹き出し。村は押す手を渡さない
export const thoughtProps = (at: BubblePoint): TalkBubbleProps => ({
  text: text.noTarget,
  lang,
  at,
  kind: 'thought',
})

// 描いた吹き出し。無ければ前提が崩れているのでその場で落とす
export const bubbleElement = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('[data-village-bubble]')
  if (element === null) throw new Error('吹き出しが描かれていない')
  return element
}

// 吹き出しに書いた押し戻す量(「18px」の形)。まだ測っていなければ空
export const shiftOf = (bubble: HTMLElement): string => bubble.style.getPropertyValue('--shift')
