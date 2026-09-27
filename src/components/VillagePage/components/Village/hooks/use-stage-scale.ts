// 舞台(黒地)に収まる整数マス寸法を実測から決める。計算は純粋関数に分け、
// フックは ResizeObserver の結果を --cell へ書くだけ。React state は使わず再レンダーを起こさない。
// 帯が画面下端に接していないので、--band には高さではなく帯の上端までの距離を書き、
// 重ね表示(会話窓・地図)が帯を覆わないようにする
import { useEffect } from 'react'
import type { RefObject } from 'react'
import { bandGap, bandHeight, computeCell, hasGutters } from '../utils/stage-scale'

export type StageScaleOptions = {
  // --cell を書き込む要素(舞台いっぱいの .root)
  root: RefObject<HTMLDivElement | null>
  // 縦持ちで枠の下に置く十字キー帯。横持ち・PC では absolute か非表示なので高さ 0 として扱う
  band: RefObject<HTMLDivElement | null>
  // 縦持ちで枠のすぐ下に置く一覧への出口。それ以外は display: contents で箱を作らないので高さ 0
  exit?: RefObject<HTMLDivElement | null>
  cols: number
  rows: number
}

export function useStageScale({ root, band, exit, cols, rows }: StageScaleOptions): void {
  useEffect(() => {
    const rootEl = root.current
    if (rootEl === null) return
    const apply = () => {
      const bandEl = band.current
      // 出口も帯と同じく通常フローにいる時だけ高さを持つ(display: contents なら offsetHeight は 0)
      const reserved = bandHeight(bandEl) + bandHeight(exit?.current ?? null)
      const cell = computeCell(rootEl.clientWidth, rootEl.clientHeight, reserved, cols, rows)
      // 帯が静的配置(縦持ち)のときだけ、実測した上端までの距離を --band に書く。
      // absolute / display:none のときは帯が枠に重なっているだけなので 0
      const gap =
        bandEl !== null && getComputedStyle(bandEl).position === 'static'
          ? bandGap(rootEl.getBoundingClientRect().bottom, bandEl.getBoundingClientRect().top)
          : 0
      rootEl.style.setProperty('--cell', `${cell}px`)
      rootEl.style.setProperty('--band', `${gap}px`)
      // scene.module.css の [data-gutters] が帯の配置(下段の帯 or 左右のガター)を切り替える
      if (hasGutters(rootEl.clientWidth, cell, cols)) {
        rootEl.setAttribute('data-gutters', '')
      } else {
        rootEl.removeAttribute('data-gutters')
      }
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(rootEl)
    if (band.current !== null) observer.observe(band.current)
    if (exit?.current) observer.observe(exit.current)
    return () => observer.disconnect()
  }, [root, band, exit, cols, rows])
}
