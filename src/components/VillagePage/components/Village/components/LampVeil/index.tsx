// 主人公が立っている街灯 1 本を、主人公の上へ薄く重ねる層。
// 街灯は上のマスだけが通行不可なので、下のマス(柱の根元)には立てる。地形の層は主人公(z 2)より
// 下なので、そのままだと主人公が街灯を塗り潰す。同じ絵を主人公の上へ半透明で重ね、
// 柱の向こうに主人公が透けて見える形にする。
// 主人公が一度に重なる街灯は 1 本だけなので、席は 1 組(上のマス・下のマス)しか置かない。
// どの街灯に重なるかの判定は規則の層(@/lib/village/lamp-veil)が持つ。
// 位置・シートの添字・出す出さないは use-walk-loop が rAF の中で直接書く
// (React state を経由させると、歩いている最中の再レンダーで駒が飛ぶ)
'use client'
import type { RefObject } from 'react'
// 共通の .sprite(シートの切り出し方と背景 URL の当たり先)を借りるために村の scene を読む。
// Village 側は Ground・FishingFloat と同じ並びでこのファイルを読み込むので、CSS の出力順は変わらない
import sceneStyles from '../../scene.module.css'
import styles from './lamp-veil.module.css'

// 街灯 1 本ぶんの席。facade.ts が街灯を上下 2 マスへ展開するのに合わせて 2 つ置く
const SLOTS = [0, 1]

export type LampVeilProps = {
  // 席をまとめた箱。use-walk-loop がこの子要素へ位置・添字・表示を書く
  veilRef: RefObject<HTMLDivElement | null>
}

export function LampVeil({ veilRef }: LampVeilProps) {
  return (
    // data-village-veil は E2E がこの層を掴むための取っ手(クラス名はビルドごとにハッシュへ変わる)
    <div ref={veilRef} className={styles.layer} data-village-veil aria-hidden='true'>
      {SLOTS.map(slot => (
        <div key={slot} className={`${sceneStyles.sprite} ${styles.cell}`} />
      ))}
    </div>
  )
}

export default LampVeil
