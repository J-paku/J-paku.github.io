// 地点・水辺の吹き出しに出す位置・文言・ボタン・形を 1 つに決める
import type { Cell, Spot, VillageText, World } from '@content/types/world'
import { waterBubble } from '@/lib/village/fishing'
import { talkAnchor } from '@/lib/village/spot'
import { arriveSpeech, talkLabelOf } from './spot-text'

export type TalkBubbleInput = {
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  // 釣れる中身の数。0 なら投げられないので水辺の吹き出しを出さない
  catchCount: number
  activeSpot: Spot | null
  // 歩行ループが知らせる、主人公の向いた先の水のマス。水辺でなければ null
  fishingTarget: Cell | null
  world: World
  playerCell: Cell
  text: VillageText
  // 全部を釣り上げたか
  exhausted: boolean
}

export type TalkBubble = {
  // 水辺の吹き出しを出す間は考え事の吹き出しを消すので、呼び出し側も読む
  canFish: boolean
  talkAt: { x: number; y: number } | null
  talkText: string | null
  talkLabel: string | undefined
  talkKind: 'speech' | 'thought'
}

export const resolveTalkBubble = ({
  mode,
  catchCount,
  activeSpot,
  fishingTarget,
  world,
  playerCell,
  text,
  exhausted,
}: TalkBubbleInput): TalkBubble => {
  // 釣り場の地点(action: 'fishing')に立った時は、地点の吹き出しを出さず水辺の吹き出し 1 つにまとめる。
  // 釣れる中身が無ければ投げられないので、吹き出しごと出さない
  const atFishingSpot = activeSpot?.action === 'fishing'
  const spotBubble = activeSpot !== null && !atFishingSpot ? activeSpot : null
  const canFish =
    mode === 'walk' &&
    catchCount > 0 &&
    (atFishingSpot || (activeSpot === null && fishingTarget !== null))
  const talkAt =
    spotBubble !== null
      ? talkAnchor(world, spotBubble, playerCell)
      : canFish
        ? { x: playerCell.x + 0.5, y: playerCell.y - 0.5 }
        : null
  // 水辺の吹き出しの文言・ボタン・形。全部を釣り上げた後はボタンの無い考え事に替わる
  const water = waterBubble(text.fishing, exhausted)
  const talkText =
    spotBubble !== null ? arriveSpeech(text, spotBubble) : canFish ? water.text : null
  const talkLabel =
    spotBubble !== null ? talkLabelOf(text, spotBubble) : canFish ? water.label : undefined
  const talkKind = spotBubble === null && canFish ? water.kind : 'speech'

  return { canFish, talkAt, talkText, talkLabel, talkKind }
}
