// 夜だけ灯る偽の照明。光源 1 つにつき丸い div を 1 枚置くだけで、にじみは
// lighting.module.css の放射グラデーションが描く。光源計算・レイキャスト・Canvas・rAF は持たない。
// この層は .world(カメラの transform が掛かる層)の中に入るので、光源はワールド座標のまま
// 置けば親の transform がそのまま運ぶ(カメラが動いても要素側は 1 度も書き換わらない)。
// 夜以外は CSS が display:none にするので、描画そのものが起きない
'use client'
import { useMemo } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { World } from '@content/types/world'
import { PLAYER_LIGHT, worldLights, type LightSource } from '@/lib/village/lights'
import styles from './lighting.module.css'

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type LightStyle = CSSProperties & { '--light-color': string }

export type LightingProps = {
  world: World
  // 主人公が持つランタンの灯り。use-walk-loop が毎フレーム同じ transform を書く
  playerLightRef: RefObject<HTMLDivElement | null>
  // rAF が回り出すまでの土台。人物・目印・考え事の吹き出しと同じ文字列(initial-view の
  // startShift)を受け取る。これが無いと最初の 1 フレームだけ灯りがワールドの原点付近に置かれ、
  // 遅い端末では主人公から離れた場所が光って見える
  startShift: string
}

// マス数を CSS の長さにする。0.1 の誤差がそのまま HTML へ出ないよう小数第 3 位で丸める
const cells = (value: number): string => `calc(var(--cell) * ${Number(value.toFixed(3))})`

// 箱は灯の中心から半径ぶん左上へ寄せた、直径ちょうどの正方形。
// 色と濃さだけをインラインで渡し、にじみ方(段の切り方)は CSS 側に 1 つだけ置く
const lightStyle = (light: LightSource): LightStyle => ({
  left: cells(light.x - light.radius),
  top: cells(light.y - light.radius),
  width: cells(light.radius * 2),
  height: cells(light.radius * 2),
  opacity: light.intensity,
  '--light-color': light.color,
})

// 主人公のランタンは主人公と同じ原点(立っているマスの左上)から測る。
// 灯はマスの中央なので、中心 0.5 から半径を引いた位置が箱の左上になる。
// ロボットのランタン(lights.ts の dx 0.95)のように提げている腕の側へ寄せないのは、主人公の絵が
// 向きによって左右反転するため。手元へ寄せると右を向いた瞬間に灯りだけが体の反対側へ飛ぶ
// (灯りは左右対称なので、use-walk-loop は人物の反転を灯りへ渡していない)
const playerLightBox: LightStyle = {
  left: cells(0.5 - PLAYER_LIGHT.radius),
  top: cells(0.5 - PLAYER_LIGHT.radius),
  width: cells(PLAYER_LIGHT.radius * 2),
  height: cells(PLAYER_LIGHT.radius * 2),
  opacity: PLAYER_LIGHT.intensity,
  '--light-color': PLAYER_LIGHT.color,
}

export function Lighting({ world, playerLightRef, startShift }: LightingProps) {
  // 光源はワールドが変わったときだけ組み直す。歩行・天気・会話の更新では変わらない
  const lights = useMemo(() => worldLights(world), [world])

  return (
    // z-index を付けない(auto)。目的地の印(1)と主人公(2)より下に沈めて、人と印が光でぼやけないようにする
    <div className={styles.layer} aria-hidden='true'>
      {/* data-village-light は E2E がこの層を掴むための正式な取っ手。クラス名は CSS Modules が
          ビルドごとにハッシュへ変えるので使えない。値に灯りの種類を載せてあるので、
          街灯と窓の取り違えも弾ける。見た目に効かない属性だが、消すとテストが対象を見失う */}
      {lights.map(light => (
        <div
          key={light.id}
          className={light.flicker === true ? `${styles.light} ${styles.flicker}` : styles.light}
          data-village-light={light.kind}
          style={lightStyle(light)}
        />
      ))}
      <div
        ref={playerLightRef}
        className={`${styles.light} ${styles.player}`}
        data-village-light='player'
        style={{ ...playerLightBox, transform: startShift }}
      />
    </div>
  )
}

export default Lighting
