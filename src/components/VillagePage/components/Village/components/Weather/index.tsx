// 雨・雪の層。地図ではなく表示枠に貼り付く全画面タイルで、枠の中だけを覆う。触作には一切関与しない。
// 2 コマは「1 枚のシートを background-position でずらす」のではなく、1 コマ 1 枚の層を重ねて
// 交互に見せ消しする。横に並べたシートをタイル化すると、コマ送りが横スライドになってしまうため
'use client'
import type { CSSProperties } from 'react'
import type { Sheet } from '@/lib/pixel/art'
import type { Precipitation } from '@/lib/weather'
import styles from './weather.module.css'

// 降水の種類ごとに、16×16 の 1 コマだけを持つシートを 2 枚
export type WeatherSheets = Record<Exclude<Precipitation, 'none'>, readonly [Sheet, Sheet]>

export type WeatherProps = {
  kind: Precipitation
  sheets: WeatherSheets
}

// シートの data URI だけをカスタムプロパティで渡す。敷くのは 2 要素だけなので、
// 町の約 700 マスで問題になった「要素ごとの URI 再解析」には当たらない
type LayerStyle = CSSProperties & { '--weather-sheet': string }

const layerStyle = (sheet: Sheet): LayerStyle => ({ '--weather-sheet': `url('${sheet.uri}')` })

export function Weather({ kind, sheets }: WeatherProps) {
  if (kind === 'none') return null
  const [first, second] = sheets[kind]

  return (
    <>
      {/* data-weather は E2E がこの層を掴むための正式な取っ手。クラス名は CSS Modules が
          ビルドごとにハッシュへ変えるので使えず、DOM の位置で指すと層の置き場所を変えた
          途端に空振りする。値に降水の種類を載せてあるので雨と雪の取り違えも弾ける。
          見た目に効かない属性だが、消すとテストが対象を見失う */}
      <div
        className={styles.layer}
        style={layerStyle(first)}
        data-weather={kind}
        aria-hidden='true'
      />
      <div
        className={`${styles.layer} ${styles.second}`}
        style={layerStyle(second)}
        data-weather={kind}
        aria-hidden='true'
      />
    </>
  )
}

export default Weather
