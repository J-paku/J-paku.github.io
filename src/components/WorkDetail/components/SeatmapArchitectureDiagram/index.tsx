// 構成図。ブラウザ / iOSアプリ → Pleasanter → Akamaiプロキシ(サーバー間API) → Garoon の経路を描く。
// 点線の枠は Garoon だけを囲み、社内限定であることを表す(Pleasanter は社外公開のオンプレ)
import type { WorkDiagram } from '@/types/content'

type SeatmapArchitectureDiagramProps = {
  diagram: WorkDiagram
}

// 右向き矢印の先端(三角形)の頂点座標。直角の折れ線の終点にだけ添える小さな純関数
const rightArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 8},${tipY - 5} ${tipX - 8},${tipY + 5}`

function SeatmapArchitectureDiagram({ diagram }: SeatmapArchitectureDiagramProps) {
  const labels = diagram.labels

  return (
    <svg
      viewBox='0 0 780 200'
      width='100%'
      style={{ height: 'auto', display: 'block' }}
      role='img'
      aria-label={diagram.title}
    >
      {/* ノード枠 */}
      <g fill='var(--surface-cream)' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <rect x='20' y='34' width='130' height='40' rx='6' />
        <rect x='20' y='126' width='130' height='40' rx='6' />
        <rect x='200' y='80' width='130' height='40' rx='6' />
        <rect x='420' y='80' width='130' height='40' rx='6' />
        <rect x='600' y='80' width='130' height='40' rx='6' />
      </g>

      {/* 社内網の点線枠。Garoon だけを囲む */}
      <rect
        x='584'
        y='64'
        width='162'
        height='72'
        rx='8'
        fill='none'
        stroke='var(--rule-input)'
        strokeDasharray='6 4'
      />
      <text x='590' y='60' fontSize='11' fontFamily='var(--f-label)' fill='var(--accent)'>
        {labels.internalZone ?? ''}
      </text>

      {/* 接続線(直角の折れ線)。矢印の先端は line の終点にちょうど揃える */}
      <g fill='none' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <path d='M150 54 H175 V90 H192' />
        <path d='M150 146 H175 V110 H192' />
        <path d='M330 100 H412' />
        <path d='M550 100 H592' />
      </g>
      <g fill='var(--ink-secondary)'>
        <polygon points={rightArrowPoints(200, 90)} />
        <polygon points={rightArrowPoints(200, 110)} />
        <polygon points={rightArrowPoints(420, 100)} />
        <polygon points={rightArrowPoints(600, 100)} />
      </g>

      {/* サーバー間APIのラベル。Pleasanter→Akamaiプロキシ の矢印に添える */}
      <text
        x='375'
        y='90'
        fontSize='11'
        fontFamily='var(--f-label)'
        fill='var(--ink-secondary)'
        textAnchor='middle'
      >
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
        <text x='265' y='104' dominantBaseline='middle'>
          {labels.pleasanter ?? ''}
        </text>
        <text x='485' y='104' dominantBaseline='middle'>
          {labels.akamai ?? ''}
        </text>
        <text x='665' y='104' dominantBaseline='middle'>
          {labels.garoon ?? ''}
        </text>
      </g>

      {/* デモに関する注記。右下に小さく置く */}
      <text
        x='760'
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
