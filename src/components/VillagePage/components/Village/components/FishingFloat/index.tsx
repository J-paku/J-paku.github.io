// 釣っている間だけ水面に出る 1 枚。投げている間は浮き、かかると浮きが沈み、
// 釣り上げた瞬間は巻物が水から跳ね上がって少し浮いたまま残る。
// 絵はワールドのスプライトシートから切り出すので、このモジュールは色を 1 つも持たない
'use client'
import type { Cell } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { FISHING_LAND_MS } from '@/lib/village/fishing'
import type { FishingPhase } from '../../hooks/use-village-overlay/use-village-fishing'
import { spriteIndex, spriteStyle, type SpriteStyle } from '../../sprite-style'
// 共通の .sprite(シートの切り出し方と背景 URL の当たり先)を借りるために村の scene を読む。
// Village 側は Ground と同じ並びでこのファイルを読み込むので、CSS の出力順は変わらない
import sceneStyles from '../../scene.module.css'
import styles from './fishing-float.module.css'

export type FishingFloatProps = {
  // 浮きと巻物を置く水のマス(ワールド座標)。カメラは親の .world が掛けるので引き算しない
  at: Cell
  phase: FishingPhase
  sprites: SheetLayout
}

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type FloatStyle = SpriteStyle & { '--land-ms': string }

// 段階ごとの絵。待機中は水面に何も無いので持たない
const FLOAT_ART: Partial<Record<FishingPhase, string>> = {
  casting: 'bobber',
  bite: 'bobber-bite',
  landing: 'scroll',
  caught: 'scroll',
}

export function FishingFloat({ at, phase, sprites }: FishingFloatProps) {
  const art = FLOAT_ART[phase]
  if (art === undefined) return null

  // 跳ね上がりの長さは待ち時間と同じにする。秒数の正本は lib 側の定数 1 か所だけ
  const style: FloatStyle = {
    ...spriteStyle(at.x, at.y, spriteIndex(sprites, art)),
    '--land-ms': `${FISHING_LAND_MS}ms`,
  }

  return (
    // data-village-float は E2E がこの 1 枚を掴むための取っ手。クラス名は CSS Modules が
    // ビルドごとにハッシュへ変えるので使えない。data-float-phase は動きの出し分けも兼ねる。
    // 名前を data-phase にしないのは、村の根(昼夜の段階)が既にその名前を持っていて、
    // '[data-phase]' 1 本で根を指す E2E がこの 1 枚まで掴んでしまうため
    <div
      className={`${sceneStyles.sprite} ${styles.float}`}
      style={style}
      data-village-float
      data-float-phase={phase}
      aria-hidden='true'
    />
  )
}

export default FishingFloat
