// 釣っている間だけ水面に出る 1 枚。投げている間は浮き、かかると浮きが沈み、
// 釣り上げた瞬間は巻物が水から跳ね上がって少し浮いたまま残る。
// 浮きが水面にある間は、竿の先から浮きまで糸を 1 本渡す。
// 絵はワールドのスプライトシートから切り出すので、このモジュールは色を 1 つも持たない
'use client'
import type { Cell } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { FISHING_LINES } from '@/lib/pixel/fishing-art'
import { FISHING_LAND_MS } from '@/lib/village/fishing'
import { directionTo } from '@/lib/village/movement'
import { FISHING_SWING_MS } from '@/lib/village/player-pose'
import type { FishingPhase } from '../../hooks/use-village-overlay/use-village-fishing'
import { spriteIndex, spriteStyle, type SpriteStyle } from '../../sprite-style'
// 共通の .sprite(シートの切り出し方と背景 URL の当たり先)を借りるために村の scene を読む。
// Village 側は Ground と同じ並びでこのファイルを読み込むので、CSS の出力順は変わらない
import sceneStyles from '../../scene.module.css'
import styles from './fishing-float.module.css'

export type FishingFloatProps = {
  // 浮きと巻物を置く水のマス(ワールド座標)。カメラは親の .world が掛けるので引き算しない
  at: Cell
  // 竿を持って立っているマス(ワールド座標)。浮きのマスとの差が糸を渡す向きになる
  from: Cell
  phase: FishingPhase
  sprites: SheetLayout
}

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type FloatStyle = SpriteStyle & { '--land-ms': string }
type LineStyle = SpriteStyle & { '--swing-ms': string }

// 段階ごとの絵。待機中は水面に何も無いので持たない
const FLOAT_ART: Partial<Record<FishingPhase, string>> = {
  casting: 'bobber',
  bite: 'bobber-bite',
  landing: 'scroll',
  caught: 'scroll',
}

// 糸を渡すのは浮きが水面にある間だけ。巻物が跳ねた後は竿の先から結ぶ相手が無い
const LINE_PHASES: ReadonlySet<FishingPhase> = new Set(['casting', 'bite'])

export function FishingFloat({ at, from, phase, sprites }: FishingFloatProps) {
  const art = FLOAT_ART[phase]
  if (art === undefined) return null

  // 跳ね上がりの長さは待ち時間と同じにする。秒数の正本は lib 側の定数 1 か所だけ
  const style: FloatStyle = {
    ...spriteStyle(at.x, at.y, spriteIndex(sprites, art)),
    '--land-ms': `${FISHING_LAND_MS}ms`,
  }

  // 浮きは主人公の 1 マス先にしか置かないので、立つマスから浮きへの向きがそのまま糸の向きになる。
  // 向きの判定は歩行と同じ lib 側の純粋関数に任せる
  const facing = directionTo(from, at)
  const line = FISHING_LINES[facing]
  // 糸の絵と貼る場所(主人公のマスからのずれ・左右反転)は fishing-art.ts が対で持つ。
  // 竿を振っている間は糸を隠す長さも、主人公のコマを切り替える側と同じ定数から取る
  const lineStyle: LineStyle = {
    ...spriteStyle(from.x + line.x, from.y + line.y, spriteIndex(sprites, line.key)),
    transform: line.flip ? 'scaleX(-1)' : undefined,
    '--swing-ms': `${FISHING_SWING_MS}ms`,
  }

  // 糸と浮きは同じ高さ(z 1)に並べ、後に置いた浮きが糸の端の上に来るようにする。
  // 糸が無い段階も null で席を残し、浮きの要素が段階の切り替えで作り直されないようにする
  return (
    <>
      {LINE_PHASES.has(phase) ? (
        // data-village-line は E2E が糸を掴むための取っ手。向きは data-line-facing で読める
        <div
          className={`${sceneStyles.sprite} ${styles.line}`}
          style={lineStyle}
          data-village-line
          data-line-facing={facing}
          aria-hidden='true'
        />
      ) : null}
      {/* data-village-float は E2E がこの 1 枚を掴むための取っ手。クラス名は CSS Modules が
          ビルドごとにハッシュへ変えるので使えない。data-float-phase は動きの出し分けも兼ねる。
          名前を data-phase にしないのは、村の根(昼夜の段階)が既にその名前を持っていて、
          '[data-phase]' 1 本で根を指す E2E がこの 1 枚まで掴んでしまうため */}
      <div
        className={`${sceneStyles.sprite} ${styles.float}`}
        style={style}
        data-village-float
        data-float-phase={phase}
        aria-hidden='true'
      />
    </>
  )
}

export default FishingFloat
