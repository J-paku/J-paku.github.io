// 構成図。ブラウザ / iOSアプリ → Akamai → Pleasanter → Garoon(サーバー間API)の経路を描く。
// Pleasanter と Garoon を囲む点線の枠が社内網であることを表す
import type { WorkDiagram } from '@/types/content'

type SeatmapArchitectureDiagramProps = {
  diagram: WorkDiagram
}

// 右向き矢印の先端(三角形)の頂点座標。直角の折れ線の終点にだけ添える小さな純関数
const rightArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 8},${tipY - 5} ${tipX - 8},${tipY + 5}`

// 下向き矢印の先端。Pleasanter → Garoon の縦矢印だけで使う
const downArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 5},${tipY - 8} ${tipX + 5},${tipY - 8}`

function SeatmapArchitectureDiagram({ diagram }: SeatmapArchitectureDiagramProps) {
  const labels = diagram.labels

  return (
    <svg
      viewBox='0 0 720 200'
      width='100%'
      style={{ height: 'auto', display: 'block' }}
      role='img'
      aria-label={diagram.title}
    >
      {/* ノード枠 */}
      <g fill='var(--surface-cream)' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <rect x='20' y='34' width='130' height='40' rx='6' />
        <rect x='20' y='126' width='130' height='40' rx='6' />
        <rect x='210' y='80' width='130' height='40' rx='6' />
        <rect x='420' y='34' width='160' height='40' rx='6' />
        <rect x='420' y='126' width='160' height='40' rx='6' />
      </g>

      {/* 社内網の点線枠。Pleasanter と Garoon をまとめて囲む */}
      <rect
        x='400'
        y='16'
        width='210'
        height='168'
        rx='8'
        fill='none'
        stroke='var(--rule-input)'
        strokeDasharray='6 4'
      />
      <text x='406' y='12' fontSize='11' fontFamily='var(--f-label)' fill='var(--accent)'>
        {labels.internalZone ?? ''}
      </text>

      {/* 接続線(直角の折れ線)。矢印の先端は line の終点にちょうど揃える */}
      <g fill='none' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <path d='M150 54 H180 V90 H202' />
        <path d='M150 146 H180 V110 H202' />
        <path d='M340 100 H380 V54 H412' />
        <path d='M500 74 V118' />
      </g>
      <g fill='var(--ink-secondary)'>
        <polygon points={rightArrowPoints(210, 90)} />
        <polygon points={rightArrowPoints(210, 110)} />
        <polygon points={rightArrowPoints(420, 54)} />
        <polygon points={downArrowPoints(500, 126)} />
      </g>

      {/* サーバー間APIのラベル。Pleasanter→Garoon の矢印に添える */}
      <text x='512' y='104' fontSize='11' fontFamily='var(--f-label)' fill='var(--ink-secondary)'>
        {labels.serverToServer ?? ''}
      </text>

      {/* ノード内ラベル */}
      <g fontFamily='var(--f-label)' fontSize='13' fill='var(--ink)' textAnchor='middle'>
        <text x='85' y='58' dominantBaseline='middle'>
          {labels.browser ?? ''}
        </text>
        <text x='85' y='150' dominantBaseline='middle'>
          {labels.iosApp ?? ''}
        </text>
        <text x='275' y='104' dominantBaseline='middle'>
          {labels.akamai ?? ''}
        </text>
        <text x='500' y='58' dominantBaseline='middle'>
          {labels.pleasanter ?? ''}
        </text>
        <text x='500' y='150' dominantBaseline='middle'>
          {labels.garoon ?? ''}
        </text>
      </g>

      {/* デモに関する注記。右下に小さく置く */}
      <text
        x='700'
        y='192'
        fontSize='11'
        fontFamily='var(--f-label)'
        fill='var(--ink-secondary)'
        textAnchor='end'
      >
        {labels.demoNote ?? ''}
      </text>
    </svg>
  )
}

export default SeatmapArchitectureDiagram
