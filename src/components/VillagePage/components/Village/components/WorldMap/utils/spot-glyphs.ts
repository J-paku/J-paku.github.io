// 拡大地図の地点の ✓/? の字のドット絵と下敷きの大きさ

// 拡大地図の印の 7×7 のドット絵。フォント依存で滲むため <text> は使わず '#' の位置に rect を置く。
// 描くのは WorldMap の components/SpotGlyph(地点のボタンの中の SVG)。札と一緒にずらせるよう、地図の SVG(MapSvg)には描かない
export const CHECK_GLYPH: readonly string[] = [
  '.......',
  '.....##',
  '....##.',
  '##.##..',
  '.###...',
  '..##...',
  '.......',
]

// 「?」は下敷きの縁と同じ黒なので、左右 1 ドットを空けて縁と繋がらないようにする
export const QUESTION_GLYPH: readonly string[] = [
  '..###..',
  '.##.##.',
  '....##.',
  '...##..',
  '...##..',
  '.......',
  '...##..',
]

const GLYPH_CELLS = 7
// 字の周りを 1 ドットずつ広げた白い下敷き(縁の黒 1 ドットを含めて 9 ドット角)
export const PLATE_CELLS = GLYPH_CELLS + 2
