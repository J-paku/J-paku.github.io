// データフロー図。mockデータ → 遅延つきfetch → SWRキャッシュ → 3画面への分岐を描く。
// 編集画面はlocalStorageへ書き込んだ後、SWRキャッシュへ戻る循環矢印(点線)を持つ
import type { WorkDiagram } from '@/types/content'

type SeatmapDataflowDiagramProps = {
  diagram: WorkDiagram
}

// 右向き矢印の先端(三角形)の頂点座標。直角の折れ線の終点にだけ添える小さな純関数
const rightArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 8},${tipY - 5} ${tipX - 8},${tipY + 5}`

// 下向き矢印の先端。編集画面 → localStorage の縦矢印だけで使う
const downArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 5},${tipY - 8} ${tipX + 5},${tipY - 8}`

// 上向き矢印の先端。localStorage → SWRキャッシュ へ戻る循環矢印だけで使う
const upArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 5},${tipY + 8} ${tipX + 5},${tipY + 8}`

function SeatmapDataflowDiagram({ diagram }: SeatmapDataflowDiagramProps) {
  const labels = diagram.labels

  return (
    <svg
      viewBox='0 0 720 230'
      width='100%'
      style={{ height: 'auto', display: 'block' }}
      role='img'
      aria-label={diagram.title}
    >
      {/* ノード枠 */}
      <g fill='var(--surface-cream)' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <rect x='16' y='40' width='110' height='40' rx='6' />
        <rect x='158' y='40' width='130' height='40' rx='6' />
        <rect x='320' y='40' width='130' height='40' rx='6' />
        <rect x='500' y='6' width='190' height='36' rx='6' />
        <rect x='500' y='52' width='190' height='36' rx='6' />
        <rect x='500' y='98' width='190' height='36' rx='6' />
        <rect x='500' y='170' width='190' height='40' rx='6' />
      </g>

      {/* 前進の接続線(直角の折れ線)。矢印の先端は line の終点にちょうど揃える */}
      <g fill='none' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <path d='M126 60 H150' />
        <path d='M288 60 H312' />
        <path d='M450 60 H475 V24 H492' />
        <path d='M450 60 H475 V70 H492' />
        <path d='M450 60 H475 V116 H492' />
        <path d='M595 134 V162' />
      </g>
      <g fill='var(--ink-secondary)'>
        <polygon points={rightArrowPoints(158, 60)} />
        <polygon points={rightArrowPoints(320, 60)} />
        <polygon points={rightArrowPoints(500, 24)} />
        <polygon points={rightArrowPoints(500, 70)} />
        <polygon points={rightArrowPoints(500, 116)} />
        <polygon points={downArrowPoints(595, 170)} />
      </g>

      {/* 編集画面からSWRキャッシュへ戻る循環矢印(点線) */}
      <path
        d='M500 190 C 420 190, 385 150, 385 88'
        fill='none'
        stroke='var(--ink-mid)'
        strokeWidth='1.5'
        strokeDasharray='5 4'
      />
      <polygon points={upArrowPoints(385, 80)} fill='var(--ink-mid)' />

      {/* ノード内ラベル */}
      <g fontFamily='var(--f-label)' fontSize='13' fill='var(--ink)' textAnchor='middle'>
        <text x='71' y='60' dominantBaseline='middle'>
          {labels.mocks ?? ''}
        </text>
        <text x='223' y='60' dominantBaseline='middle'>
          {labels.fetchMock ?? ''}
        </text>
        <text x='385' y='60' dominantBaseline='middle'>
          {labels.swrCache ?? ''}
        </text>
        <text x='595' y='24' dominantBaseline='middle'>
          {labels.screenMap ?? ''}
        </text>
        <text x='595' y='70' dominantBaseline='middle'>
          {labels.screenDirectory ?? ''}
        </text>
        <text x='595' y='116' dominantBaseline='middle'>
          {labels.screenEdit ?? ''}
        </text>
        <text x='595' y='190' dominantBaseline='middle'>
          {labels.storage ?? ''}
        </text>
      </g>
    </svg>
  )
}

export default SeatmapDataflowDiagram
