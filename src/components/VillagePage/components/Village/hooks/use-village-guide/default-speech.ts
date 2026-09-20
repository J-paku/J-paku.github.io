// 復元と到着の両方が使う既定文。定義はこのファイルだけに置く(二重定義すると文言がずれる)
import type { VillageText, World } from '@content/types/world'

// 会話地点でも目的地でもない時の既定文。屋内は出口案内、屋外は操作案内
// 屋外の操作案内はタッチ(pointer: coarse)ならスティック・A の説明に替える。判定はマウント後に一度だけ行う
export const defaultSpeech = (world: World, text: VillageText, coarse: boolean): string =>
  world.kind === 'interior' ? text.exitHint : coarse ? text.hintTouch : text.hint
