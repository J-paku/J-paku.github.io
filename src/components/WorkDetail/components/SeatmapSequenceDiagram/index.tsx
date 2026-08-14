// シーケンス図。ユーザー / 編集セッション / 保存部 / SWRキャッシュ の4本の生命線に沿って
// ドラッグ→ゴースト表示→ドロップ→ロック確認→保存結果の3分岐→再検証→再描画の順を描く
import type { WorkDiagram } from '@/types/content'

type SeatmapSequenceDiagramProps = {
  diagram: WorkDiagram
}

// 右向き矢印の先端(三角形)の頂点座標。生命線間の横向き矢印の終点にだけ添える純関数
const rightArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX - 8},${tipY - 5} ${tipX - 8},${tipY + 5}`

// 左向き矢印の先端。編集セッション→ユーザー、SWRキャッシュ→ユーザー の戻り矢印だけで使う
const leftArrowPoints = (tipX: number, tipY: number) =>
  `${tipX},${tipY} ${tipX + 8},${tipY - 5} ${tipX + 8},${tipY + 5}`

// 4本の生命線のx座標
const actorX = { user: 90, editor: 280, store: 470, cache: 640 }

function SeatmapSequenceDiagram({ diagram }: SeatmapSequenceDiagramProps) {
  const labels = diagram.labels

  return (
    <svg
      viewBox='0 0 720 300'
      width='100%'
      style={{ height: 'auto', display: 'block' }}
      role='img'
      aria-label={diagram.title}
    >
      {/* 生命線(縦の点線) */}
      <g stroke='var(--rule-input)' strokeWidth='1.5' strokeDasharray='4 4'>
        <line x1={actorX.user} y1='48' x2={actorX.user} y2='292' />
        <line x1={actorX.editor} y1='48' x2={actorX.editor} y2='292' />
        <line x1={actorX.store} y1='48' x2={actorX.store} y2='292' />
        <line x1={actorX.cache} y1='48' x2={actorX.cache} y2='292' />
      </g>

      {/* 生命線ヘッダー(役割ラベルの枠) */}
      <g fill='var(--surface-cream)' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <rect x={actorX.user - 70} y='16' width='140' height='32' rx='6' />
        <rect x={actorX.editor - 70} y='16' width='140' height='32' rx='6' />
        <rect x={actorX.store - 70} y='16' width='140' height='32' rx='6' />
        <rect x={actorX.cache - 70} y='16' width='140' height='32' rx='6' />
      </g>
      <g fontFamily='var(--f-label)' fontSize='13' fill='var(--ink)' textAnchor='middle'>
        <text x={actorX.user} y='32' dominantBaseline='middle'>
          {labels.actorUser ?? ''}
        </text>
        <text x={actorX.editor} y='32' dominantBaseline='middle'>
          {labels.actorEditor ?? ''}
        </text>
        <text x={actorX.store} y='32' dominantBaseline='middle'>
          {labels.actorStore ?? ''}
        </text>
        <text x={actorX.cache} y='32' dominantBaseline='middle'>
          {labels.actorCache ?? ''}
        </text>
      </g>

      {/* メッセージの矢印線。ドラッグ→ゴースト→ドロップ→ロック確認→再検証→再描画の順 */}
      <g fill='none' stroke='var(--ink-secondary)' strokeWidth='1.5'>
        <path d='M90 76 H272' />
        <path d='M280 106 H98' strokeDasharray='5 4' />
        <path d='M90 136 H272' />
        <path d='M280 166 H462' />
        <path d='M470 256 H632' />
        <path d='M640 280 H98' strokeDasharray='5 4' />
      </g>
      <g fill='var(--ink-secondary)'>
        <polygon points={rightArrowPoints(280, 76)} />
        <polygon points={leftArrowPoints(90, 106)} />
        <polygon points={rightArrowPoints(280, 136)} />
        <polygon points={rightArrowPoints(470, 166)} />
        <polygon points={rightArrowPoints(640, 256)} />
        <polygon points={leftArrowPoints(90, 280)} />
      </g>

      {/* メッセージのラベル */}
      <g fontFamily='var(--f-label)' fontSize='11' fill='var(--ink)' textAnchor='middle'>
        <text x='185' y='70'>
          {labels.msgDrag ?? ''}
        </text>
        <text x='185' y='100'>
          {labels.msgGhost ?? ''}
        </text>
        <text x='185' y='130'>
          {labels.msgDrop ?? ''}
        </text>
        <text x='375' y='160'>
          {labels.msgLockCheck ?? ''}
        </text>
        <text x='555' y='250'>
          {labels.msgRevalidate ?? ''}
        </text>
        <text x='365' y='274'>
          {labels.msgRender ?? ''}
        </text>
      </g>

      {/* 保存部での結果3分岐。saved だけが実線の枠で強調され、後段(再検証)へ進む */}
      <rect
        x='478'
        y='186'
        width='112'
        height='22'
        rx='4'
        fill='none'
        stroke='var(--accent)'
        strokeWidth='1.5'
      />
      <text
        x='534'
        y='197'
        fontFamily='var(--f-label)'
        fontSize='11'
        fill='var(--accent)'
        textAnchor='middle'
        dominantBaseline='middle'
      >
        {labels.msgSaved ?? ''}
      </text>
      <g fill='var(--ink-mid)'>
        <circle cx='474' cy='222' r='2.5' />
        <circle cx='474' cy='238' r='2.5' />
      </g>
      <g fontFamily='var(--f-label)' fontSize='11' fill='var(--ink-secondary)' textAnchor='start'>
        <text x='482' y='225'>
          {labels.msgBlocked ?? ''}
        </text>
        <text x='482' y='241'>
          {labels.msgConflict ?? ''}
        </text>
      </g>
    </svg>
  )
}

export default SeatmapSequenceDiagram
