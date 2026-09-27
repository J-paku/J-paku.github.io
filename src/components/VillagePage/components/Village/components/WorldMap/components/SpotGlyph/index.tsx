// 拡大地図の地点のボタンの中に描く ✓/? の字
import { MARKER_COLORS } from '../../../../utils/marker-colors'
import { CHECK_GLYPH, PLATE_CELLS, QUESTION_GLYPH } from '../../utils/spot-glyphs'
import styles from '../../world-map.module.css'

export type SpotGlyphProps = {
  visited: boolean
}

// 地点のボタンの中の ✓/? の字(9 ドット角の SVG、1 ドット = 1 単位)。黒い縁・白い下敷き・訪問済みは緑の ✓、未訪問は黒の ?。
// 地図の SVG ではなくボタンの中に描くので、arrangeBadges が札と一緒にずらせる。画面上の大きさは .glyph が決める
export function SpotGlyph({ visited }: SpotGlyphProps) {
  const glyph = visited ? CHECK_GLYPH : QUESTION_GLYPH
  const inkColor = visited ? MARKER_COLORS.visited : MARKER_COLORS.unvisited

  return (
    <svg
      className={styles.glyph}
      viewBox={`0 0 ${PLATE_CELLS} ${PLATE_CELLS}`}
      shapeRendering='crispEdges'
      aria-hidden='true'
    >
      <rect width={PLATE_CELLS} height={PLATE_CELLS} fill={MARKER_COLORS.plateEdge} />
      <rect
        x={1}
        y={1}
        width={PLATE_CELLS - 2}
        height={PLATE_CELLS - 2}
        fill={MARKER_COLORS.plate}
      />
      {glyph.flatMap((row, rowIndex) =>
        row
          .split('')
          .flatMap((pixel, colIndex) =>
            pixel === '#'
              ? [
                  <rect
                    key={`${colIndex}-${rowIndex}`}
                    x={colIndex + 1}
                    y={rowIndex + 1}
                    width={1}
                    height={1}
                    fill={inkColor}
                  />,
                ]
              : []
          )
      )}
    </svg>
  )
}

export default SpotGlyph
