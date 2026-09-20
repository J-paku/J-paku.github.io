// 村の建物と設置物を文字マトリクスで描く
import { compose, mirrorX, recolor, TILE } from './art'
import type { PixelArt } from './art'

type StructureKey =
  | 'roof-red-l'
  | 'roof-red-m'
  | 'roof-red-r'
  | 'roof-blue-l'
  | 'roof-blue-m'
  | 'roof-blue-r'
  | 'roof-red-l-low'
  | 'roof-red-m-low'
  | 'roof-red-r-low'
  | 'roof-blue-l-low'
  | 'roof-blue-m-low'
  | 'roof-blue-r-low'
  | 'wall-l'
  | 'wall-m'
  | 'wall-r'
  | 'window'
  | 'door'
  | 'entrance-l'
  | 'entrance-r'
  | 'robot'
  | 'mailbox'
  | 'monument-tl'
  | 'monument-tr'
  | 'monument-bl'
  | 'monument-br'
  | 'stele-t'
  | 'stele-b'
  | 'marker'
  | 'desk-tl'
  | 'desk-tm'
  | 'desk-tr'
  | 'desk-bl'
  | 'desk-bm'
  | 'desk-br'
  | 'bed-t'
  | 'bed-b'
  | 'table-tl'
  | 'table-tr'
  | 'table-bl'
  | 'table-br'
  | 'locator'

// 32×32 や 16×32 の下絵から 16×16 のマス 1 枚を切り出す。col・row はマス単位
const cut = (art: PixelArt, col: number, row: number): PixelArt =>
  art.slice(row * TILE, row * TILE + TILE).map(line => line.slice(col * TILE, col * TILE + TILE))

// 屋根の最上段。上辺だけ輪郭を持ち、鱗状の瓦を赤 2 色だけで描く(青は recolor で作る)
const roofRedLeft: PixelArt = [
  '....xxxxxxxxxxxx',
  '....xrrrRrrrrrrr',
  '...xrrrrrrrrrrrr',
  '...xrrrrrrrrrrrr',
  '..xrrrrRRrrrrrrR',
  '..xrrrRRRRrrrrRR',
  '.xRRRRRRRRRRRRRR',
  '.xrrRrrrrrrrRrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrRRrrrrrrRRrrr',
  'xrRRRRrrrrRRRRrr',
  'xRRRRRRRRRRRRRRR',
  'xrrrrrrrRrrrrrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrrrrrrrrrrrrrr',
]

const roofRedMiddle: PixelArt = [
  'xxxxxxxxxxxxxxxx',
  'RrrrrrrrRrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'RrrrrrrRRrrrrrrR',
  'RRrrrrRRRRrrrrRR',
  'RRRRRRRRRRRRRRRR',
  'rrrrRrrrrrrrRrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrRRrrrrrrRRrrr',
  'rrRRRRrrrrRRRRrr',
  'RRRRRRRRRRRRRRRR',
  'RrrrrrrrRrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
]

const roofRedRight: PixelArt = [
  'xxxxxxxxxxxx....',
  'RrrrrrrrRrrx....',
  'rrrrrrrrrrrrx...',
  'rrrrrrrrrrrrx...',
  'RrrrrrrRRrrrrx..',
  'RRrrrrRRRRrrrx..',
  'RRRRRRRRRRRRRRx.',
  'rrrrRrrrrrrrRrx.',
  'rrrrrrrrrrrrrrrx',
  'rrrrrrrrrrrrrrrx',
  'rrrRRrrrrrrRRrrx',
  'rrRRRRrrrrRRRRrx',
  'RRRRRRRRRRRRRRRx',
  'RrrrrrrrRrrrrrrx',
  'rrrrrrrrrrrrrrrx',
  'rrrrrrrrrrrrrrrx',
]

// 屋根の続きの段。上辺の輪郭を持たず、下 4 行が軒(茶色の桁)になる
const roofRedLeftLow: PixelArt = [
  'xrrrrrrRRrrrrrrR',
  'xRrrrrRRRRrrrrRR',
  'xRRRRRRRRRRRRRRR',
  'xrrrRrrrrrrrRrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrRRrrrrrrRRrrr',
  'xrRRRRrrrrRRRRrr',
  'xRRRRRRRRRRRRRRR',
  'xrrrrrrrRrrrrrrr',
  'xrrrrrrrrrrrrrrr',
  'xrrrrrrrrrrrrrrr',
  'xxxxxxxxxxxxxxxx',
  'xeeeeeeeeeeeeeee',
  'xkkkkkkkkkkkkkkk',
  'xxxxxxxxxxxxxxxx',
]

const roofRedMiddleLow: PixelArt = [
  'RrrrrrrRRrrrrrrR',
  'RRrrrrRRRRrrrrRR',
  'RRRRRRRRRRRRRRRR',
  'rrrrRrrrrrrrRrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrRRrrrrrrRRrrr',
  'rrRRRRrrrrRRRRrr',
  'RRRRRRRRRRRRRRRR',
  'RrrrrrrrRrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'xxxxxxxxxxxxxxxx',
  'eeeeeeeeeeeeeeee',
  'kkkkkkkkkkkkkkkk',
  'xxxxxxxxxxxxxxxx',
]

const roofRedRightLow: PixelArt = [
  'RrrrrrrRRrrrrrrx',
  'RRrrrrRRRRrrrrRx',
  'RRRRRRRRRRRRRRRx',
  'rrrrRrrrrrrrRrrx',
  'rrrrrrrrrrrrrrrx',
  'rrrrrrrrrrrrrrrx',
  'rrrRRrrrrrrRRrrx',
  'rrRRRRrrrrRRRRrx',
  'RRRRRRRRRRRRRRRx',
  'RrrrrrrrRrrrrrrx',
  'rrrrrrrrrrrrrrrx',
  'rrrrrrrrrrrrrrrx',
  'xxxxxxxxxxxxxxxx',
  'eeeeeeeeeeeeeeex',
  'kkkkkkkkkkkkkkkx',
  'xxxxxxxxxxxxxxxx',
]

// 壁。左端に木の柱、上に梁受け、下に石積みの土台。中央のマスは横に繰り返しても継ぎ目が出ない
const wallLeft: PixelArt = [
  'xekxkkhhhhhhhhkk',
  'xekxkhhhhhhhhhhk',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxHHHHHHHHHHHH',
  'xekxsssSsssssSss',
  'xekxSsssssSsssss',
  'xxxxxxxxxxxxxxxx',
]

// 中央の壁だけ花の彫り飾りを入れる
const wallMiddle: PixelArt = [
  'xekxkkhhhhhhhhkk',
  'xekxkhhhhhhhhhhk',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhkhhhhh',
  'xekxhhhhkhkhkhhh',
  'xekxhhhhhkkkhhhh',
  'xekxhhhhhhkhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxhhhhhhhhhhhh',
  'xekxHHHHHHHHHHHH',
  'xekxsssSsssssSss',
  'xekxSsssssSsssss',
  'xxxxxxxxxxxxxxxx',
]

// 右端の壁は外側にも柱を立て、最外列を輪郭にする
const wallRight: PixelArt = [
  'xekxkkhhhhkkxkex',
  'xekxkhhhhhhkxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxhhhhhhhhxkex',
  'xekxHHHHHHHHxkex',
  'xekxsssSssssxkex',
  'xekxSsssssSsxkex',
  'xxxxxxxxxxxxxxxx',
]

// 窓。壁を下地に木枠と 4 枚ガラス、下に窓台を置く
const windowTile: PixelArt = [
  'xekxkkhhhhhhhhkk',
  'xekxkhhhhhhhhhhk',
  'xekxhhhhhhhhhhhh',
  'xekxhxxxxxxxxxxh',
  'xekxhxvnnxxvnnxh',
  'xekxhxnnnxxnnnxh',
  'xekxhxxxxxxxxxxh',
  'xekxhxvnnxxvnnxh',
  'xekxhxnnnxxnnnxh',
  'xekxhxxxxxxxxxxh',
  'xekxheeeeeeeeeeh',
  'xekxhxxxxxxxxxxh',
  'xekxHHHHHHHHHHHH',
  'xekxsssSsssssSss',
  'xekxSsssssSsssss',
  'xxxxxxxxxxxxxxxx',
]

// 扉 1 マス。まぐさの下に板戸、腰の高さに取っ手
const doorTile: PixelArt = [
  'xekxkkhhhhhhhhkk',
  'xekxkhhhhhhhhhhk',
  'xekxhxxxxxxxxxxh',
  'xekxhxEEEEEEEExh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkFEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxhxkkEkkEkkxh',
  'xekxHxkkEkkEkkxH',
  'xekxsxkkEkkEkkxs',
  'xekxSxkkEkkEkkxs',
  'xxxxxxxxxxxxxxxx',
]

// 2 マス幅の入口は観音開き。右端の列が中央の合わせ目で、右マスは左右反転
const entranceLeft: PixelArt = [
  'xekxkkhhhhhhhhhh',
  'xekxkhhhhhhhhhhh',
  'xekxhxxxxxxxxxxx',
  'xekxhxEEEEEEEEEx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkFx',
  'xekxhxkkEkkEkkkx',
  'xekxhxkkEkkEkkkx',
  'xekxHxkkEkkEkkkx',
  'xekxsxkkEkkEkkkx',
  'xekxSxkkEkkEkkkx',
  'xxxxxxxxxxxxxxxx',
]

// AI 作業台の相棒ロボット(1 マス)。ゴーグルの目とアンテナの星が目印
const robot: PixelArt = [
  '.......FF.......',
  '......FFFF......',
  '.......aa.......',
  '....xxxxxxxx....',
  '..x1111111111x..',
  '..x111111111sx..',
  'xxxaaaassaaaaxxx',
  'xSxnvvnssnvvnxSx',
  'xSxLnnLssLnnLxSx',
  'xxxaaaassaaaaxxx',
  '..xsssSSSSsssx..',
  '..xxxxxxxxxxxx..',
  '...xssssssssx...',
  '...xsxhhhhxsx...',
  '...xxxxxxxxxx...',
  '...xeex..xeex...',
]

// 郵便ポスト(1 マス)。日本式の丸型で、笠・投函口・〒 の印・石の台座
const mailbox: PixelArt = [
  '.......xx.......',
  '......xrrx......',
  '.....xrrrrx.....',
  '....xrrrrrrx....',
  '..xxrrrrrrrrxx..',
  '..xRRRRRRRRRRx..',
  '...xrrrrrrrrx...',
  '...xrxxxxxxrx...',
  '...xrxxxxxxrx...',
  '...xrrrrrrrrx...',
  '...xrhhhhhhrx...',
  '...xrrrhhrrrx...',
  '...xRrrhhrrRx...',
  '...xRRRRRRRRx...',
  '..xssssssssssx..',
  '..xxxxxxxxxxxx..',
]

// 経歴碑 2×2(32×32)。石の台座に金の星と月桂樹、中央に 2 社分の碑文の線
const monument: PixelArt = [
  '................................',
  '..............xxxx..............',
  '............xxhsSSxx............',
  '...........xhssFFsSSx...........',
  '..........xhssFFFFsSSx..........',
  '.........xhsssFFFFssSSx.........',
  '.........xhFFFFFFFFFFSx.........',
  '.........xhsFFFppFFFSSx.........',
  '.....xxxxxhssFFFFFPsSSxxxxx.....',
  '.....xhssssssFFssFFsssssSSx.....',
  '.....xhsssssFFssssFPssssSSx.....',
  '.....xhsssssssssssssssssSSx.....',
  '.....xhsssssssssssssssssSSx.....',
  '.....xhssGssssssssssssGsSSx.....',
  '.....xhsgGgssSSSSSSssgGgSSx.....',
  '.....xhgtGtgsSSSSSSsgtGtgSx.....',
  '.....xhsgGgsshhhhhhssgGgSSx.....',
  '.....xhgtGtgssssssssgtGtgSx.....',
  '.....xhsgGgssSSSSSSssgGgSSx.....',
  '.....xhssGsssSSSSSSsssGsSSx.....',
  '.....xhsssssshhhhhhsssssSSx.....',
  '.....xhsssssssssssssssssSSx.....',
  '.....xSSSSSSSSSSSSSSSSSSSSx.....',
  '.....xhhhhhhhhhhhhhhhhhhhhx.....',
  '...xhhhhhhhhhhhhhhhhhhhhhhhhx...',
  '...xssssssssssssssssssssssssx...',
  '...xHHHHHHHHHHHHHHHHHHHHHHHHx...',
  '...xSSSSSSSSSSSSSSSSSSSSSSSSx...',
  '.xhhhhhhhhhhhhhhhhhhhhhhhhhhhhx.',
  '.xssssssssssssssssssssssssssssx.',
  '.xHHHHHHHHHHHHHHHHHHHHHHHHHHHHx.',
  '.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.',
]

// 縦長の碑 1×2(16×32)。2×2 と同じ意匠を 1 マス幅へ縮めたもの
const stele: PixelArt = [
  '................',
  '......xxxx......',
  '.....xhssSx.....',
  '....xhssssSx....',
  '...xhssssssSx...',
  '..xhssssssssSx..',
  '..xhssssssssSx..',
  '..xhsssFFsssSx..',
  '..xhssFFFFssSx..',
  '..xhFFFFFFFFSx..',
  '..xhsFFppFFsSx..',
  '..xhssFFFFssSx..',
  '..xhsFFssFFsSx..',
  '..xhssssssssSx..',
  '..xhssssssssSx..',
  '..xhssssssssSx..',
  '..xhSSSSSSSSSx..',
  '..xhSSSSSSSSSx..',
  '..xhhhhhhhhhSx..',
  '..xhssssssssSx..',
  '..xhSSSSSSSSSx..',
  '..xhSSSSSSSSSx..',
  '..xhhhhhhhhhSx..',
  '..xhssssssssSx..',
  '.xhhhhhhhhhhhhx.',
  '.xssssssssssssx.',
  '.xSSSSSSSSSSSSx.',
  'xhhhhhhhhhhhhhhx',
  'xssssssssssssssx',
  'xssssssssssssssx',
  'xSSSSSSSSSSSSSSx',
  'xxxxxxxxxxxxxxxx',
]

// PC 机 3×2(48×32)。上段は天板を上から見た形で画面 2 枚・キーボード・ノート PC、下段は前板と脚
const desk: PixelArt = [
  '.........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.........',
  '.........xvnnnnnnnnnnnnxxvnnnnnnnnnnnnx.........',
  '.........xnhhhhnnnnnnnnxxnhhhhhhhnnnnnx.........',
  '.........xnnhhhhhhnnnnnxxnnnnnnnnnnnnnx.........',
  '.........xnhhhhhnnnnnnnxxnnnnnnnnhhnnnx.........',
  '.........xnnnhhhhhhhnnnxxnnhhnhhnhhnnnx.........',
  '.........xnnnnnnnnnnnnnxxnnnnnnnnnnnnnx.........',
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'xeeeeeeeeeeeeeeaaaeeeeeeeeeeeeaaaeeeeeeeeeeeeeex',
  'xeeeeeeeeeeeaaaaaaaaaeeeeeeaaaaaaaaaeeeeeeeeeeex',
  'xeeeexxxxxxxxxeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeexnnnnnnnxeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeexnhhhnnnxeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeexnnnnnnnxeeeexxxxxxxxxxxxxxxxxxxxeeeeeeeeex',
  'xeeeexxxxxxxxxeeeexsasasasasasasasasaxeeeeeeeeex',
  'xeeexsssssssssxeeexsasasasasasasasasaxeeeeeeeeex',
  'xeeexSSSSSSSSSxeeexsasasssssssssasasaxeeeeeeeeex',
  'xeeexxxxxxxxxxxeeexxxxxxxxxxxxxxxxxxxxeeeeeeeeex',
  'xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx',
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  '..xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex..',
  '..xkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx..',
  '..xkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx..',
  '..xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEx..',
  '..xkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx..',
  '..xkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx..',
  '..xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEx..',
  '..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..',
  '..xkkkkx................................xkkkkx..',
  '..xkkkkx................................xkkkkx..',
  '..xxxxxx................................xxxxxx..',
]

const markerTopLeft: PixelArt = [
  '........',
  '........',
  '......xx',
  '.....xmm',
  '....xmmm',
  '...xmmmm',
  '....xmmm',
  '.....xmm',
]

const markerBottomLeft: PixelArt = [
  '......xx',
  '.......x',
  '.......x',
  '.......x',
  '.......x',
  '.......x',
  '.....xxx',
  '........',
]

const bedTop: PixelArt = [
  'pppppppppppppppp',
  'pxxxxxxxxxxxxxxp',
  'pxkkkkkkkkkkkkxp',
  'pxxxxxxxxxxxxxxp',
  'pxxxxxxxxxxxxxxp',
  'pxxhhhhhhhhhhxxp',
  'pxxhhhhhhhhhhxxp',
  'pxxxxxxxxxxxxxxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
]

const bedBottom: PixelArt = [
  'pxhhhhhhhhhhhhxp',
  'pxhhhhhhhhhhhhxp',
  'pxxxxxxxxxxxxxxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxssssssssssssxp',
  'pxxxxxxxxxxxxxxp',
  'pxkkkkkkkkkkkkxp',
  'pxxxxxxxxxxxxxxp',
]

const tableTopOuterTop: PixelArt = [
  'pppppppp',
  'pppppppp',
  'pppxxxxx',
  'ppxEEEEE',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
]

const tableTopInnerTop: PixelArt = [
  'pppppppp',
  'pppppppp',
  'xxxxxxxx',
  'EEEEEEEE',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
]

const tableTopOuterBottom: PixelArt = [
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
]

const tableTopInnerBottom: PixelArt = [
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
]

const tableBottomOuterTop: PixelArt = [
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
  'pxEeeeee',
]

const tableBottomInnerTop: PixelArt = [
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
  'eeeeeeee',
]

const tableBottomOuterBottom: PixelArt = [
  'ppxEEEEE',
  'pppxxxxx',
  'ppppxEEx',
  'ppppxEEx',
  'ppppxEEx',
  'ppppxEEx',
  'ppppxEEx',
  'pppxxxxp',
]

const tableBottomInnerBottom: PixelArt = [
  'EEEEEEEE',
  'xxxxxxxx',
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'pppppppp',
]

const locatorTopLeft: PixelArt = [
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '...xxxxx',
]

const locatorBottomLeft: PixelArt = [
  '...xhhhh',
  '....xhhh',
  '....xhhh',
  '.....xhh',
  '.....xhh',
  '......xh',
  '.......x',
  '........',
]

const shiftedMirrorX = (art: PixelArt): PixelArt => mirrorX(art).map(row => `${row.slice(1)}.`)

const tableTopLeft = compose(
  tableTopOuterTop,
  tableTopInnerTop,
  tableTopOuterBottom,
  tableTopInnerBottom
)
const tableBottomLeft = compose(
  tableBottomOuterTop,
  tableBottomInnerTop,
  tableBottomOuterBottom,
  tableBottomInnerBottom
)

const blueRoof = { r: 'u', R: 'U' }

export const structureArt: Record<StructureKey, PixelArt> = {
  'roof-red-l': roofRedLeft,
  'roof-red-m': roofRedMiddle,
  'roof-red-r': roofRedRight,
  'roof-blue-l': recolor(roofRedLeft, blueRoof),
  'roof-blue-m': recolor(roofRedMiddle, blueRoof),
  'roof-blue-r': recolor(roofRedRight, blueRoof),
  'roof-red-l-low': roofRedLeftLow,
  'roof-red-m-low': roofRedMiddleLow,
  'roof-red-r-low': roofRedRightLow,
  'roof-blue-l-low': recolor(roofRedLeftLow, blueRoof),
  'roof-blue-m-low': recolor(roofRedMiddleLow, blueRoof),
  'roof-blue-r-low': recolor(roofRedRightLow, blueRoof),
  'wall-l': wallLeft,
  'wall-m': wallMiddle,
  'wall-r': wallRight,
  window: windowTile,
  door: doorTile,
  'entrance-l': entranceLeft,
  'entrance-r': mirrorX(entranceLeft),
  robot,
  mailbox,
  'monument-tl': cut(monument, 0, 0),
  'monument-tr': cut(monument, 1, 0),
  'monument-bl': cut(monument, 0, 1),
  'monument-br': cut(monument, 1, 1),
  'stele-t': cut(stele, 0, 0),
  'stele-b': cut(stele, 0, 1),
  marker: compose(
    markerTopLeft,
    mirrorX(markerTopLeft),
    markerBottomLeft,
    mirrorX(markerBottomLeft)
  ),
  'desk-tl': cut(desk, 0, 0),
  'desk-tm': cut(desk, 1, 0),
  'desk-tr': cut(desk, 2, 0),
  'desk-bl': cut(desk, 0, 1),
  'desk-bm': cut(desk, 1, 1),
  'desk-br': cut(desk, 2, 1),
  'bed-t': bedTop,
  'bed-b': bedBottom,
  'table-tl': tableTopLeft,
  'table-tr': mirrorX(tableTopLeft),
  'table-bl': tableBottomLeft,
  'table-br': mirrorX(tableBottomLeft),
  locator: compose(
    locatorTopLeft,
    shiftedMirrorX(locatorTopLeft),
    locatorBottomLeft,
    shiftedMirrorX(locatorBottomLeft)
  ),
}
