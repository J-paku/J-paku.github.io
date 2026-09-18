// 村の建物と設置物を八ドット部品から組み立てる
import { compose, mirrorX, recolor } from './art'
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

const roofInnerTop: PixelArt = [
  'xxxxxxxx',
  'rrrRrrrR',
  'rrrRrrrR',
  'RRRRRRRR',
  'rRrrrRrr',
  'rRrrrRrr',
  'rRrrrRrr',
  'RRRRRRRR',
]

const roofLeftTop: PixelArt = [
  'xxxxxxxx',
  'xrrRrrrR',
  'xrrRrrrR',
  'xRRRRRRR',
  'xRrrrRrr',
  'xRrrrRrr',
  'xRrrrRrr',
  'xRRRRRRR',
]

const roofRightTop: PixelArt = [
  'xxxxxxxx',
  'rrrRrrrx',
  'rrrRrrrx',
  'RRRRRRRx',
  'rRrrrRrx',
  'rRrrrRrx',
  'rRrrrRrx',
  'RRRRRRRx',
]

const roofInnerBottom: PixelArt = [
  'rrrRrrrR',
  'rrrRrrrR',
  'rrrRrrrR',
  'RRRRRRRR',
  'rRrrrRrr',
  'rRrrrRrr',
  'rRrrrRrr',
  'RRRRRRRR',
]

const roofLeftBottom: PixelArt = [
  'xrrRrrrR',
  'xrrRrrrR',
  'xrrRrrrR',
  'xRRRRRRR',
  'xRrrrRrr',
  'xRrrrRrr',
  'xRrrrRrr',
  'RRRRRRRR',
]

const roofRightBottom: PixelArt = [
  'rrrRrrrx',
  'rrrRrrrx',
  'rrrRrrrx',
  'RRRRRRRx',
  'rRrrrRrx',
  'rRrrrRrx',
  'rRrrrRrx',
  'RRRRRRRR',
]

const wallTopLeft: PixelArt = [
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhHhhhh',
  'hhhhhhhh',
  'HHHHHHHH',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
]

const wallTopRight: PixelArt = [
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'HHHHHHHH',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhHhhh',
]

const wallBottomLeft: PixelArt = [
  'hhhhhhhh',
  'HHHHHHHH',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'HHHHHHHH',
  'HHHHHHHH',
  'xxxxxxxx',
]

const wallBottomRight: PixelArt = [
  'hhhhhhhh',
  'HHHHHHHH',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'HHHHHHHH',
  'HHHHHHHH',
  'xxxxxxxx',
]

// 外壁の部品だけに輪郭を重ねる
const withLeftOutline = (art: PixelArt): PixelArt => art.map(row => `x${row.slice(1)}`)
const withRightOutline = (art: PixelArt): PixelArt => art.map(row => `${row.slice(0, -1)}x`)

const windowTopLeft: PixelArt = [
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhHhhhh',
  'hhhhxxxx',
  'HHHHxnvx',
  'hhhhxnnx',
  'hhhhxxxx',
  'hhhhxnnx',
]

const windowTopRight: PixelArt = [
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'xxxxhhhh',
  'nnnxHHHH',
  'nnnxhhhh',
  'xxxxhhhh',
  'nnnxHhhh',
]

const windowBottomLeft: PixelArt = [
  'hhhhxnnx',
  'HHHHxnnx',
  'hhhhxxxx',
  'hhhhHHHH',
  'hhhhhhhh',
  'HHHHHHHH',
  'HHHHHHHH',
  'xxxxxxxx',
]

const windowBottomRight: PixelArt = [
  'nnnxhhhh',
  'nnnxHHHH',
  'xxxxhhhh',
  'HHHHhhhh',
  'hhhhhhhh',
  'HHHHHHHH',
  'HHHHHHHH',
  'xxxxxxxx',
]

// 扉は幅8ドット(列4〜11)・輪郭は列3と列12。上枠は行2から始め扉板は下端まで伸ばす
const doorTopLeft: PixelArt = [
  'hhhhhhhh',
  'hHhhhhhh',
  'hhhxxxxx',
  'hhhxDDDD',
  'HHHxddDd',
  'hhhxddDd',
  'hhhxddDd',
  'hhhxddDd',
]

const doorTopRight: PixelArt = [
  'hhhhhhhh',
  'hhhhhhhh',
  'xxxxxhhh',
  'DDDDxhhh',
  'dDddxHHH',
  'dDddxhhh',
  'dDddxhhh',
  'dDddxhHh',
]

const doorBottomLeft: PixelArt = [
  'hhhxDDDD',
  'HHHxddDd',
  'hhhxddDd',
  'hhhxddDd',
  'hhhxddDd',
  'HHHxddDd',
  'HHHxddDd',
  'xxxxddDd',
]

// 腰の高さに取っ手を1ドット置く
const doorBottomRight: PixelArt = [
  'DDDDxhhh',
  'dDddxHHH',
  'dDFdxhhh',
  'dDddxhhh',
  'dDddxhhh',
  'dDddxHHH',
  'dDddxHHH',
  'dDddxxxx',
]

// AI 作業台の相棒ロボット(1マス16×16)。丸みのあるボックス頭に目玉2つ、頭上にアンテナ、短い胴体
const robot: PixelArt = [
  '.......mm.......',
  '.......xx.......',
  '.....xxxxxx.....',
  '....xSSSSSSx....',
  '....xssssssx....',
  '....xssssssx....',
  '....xsnxxnsx....',
  '....xssssssx....',
  '....xSSSSSSx....',
  '....xxxxxxxx....',
  '...xSSSSSSSSx...',
  '...xssssssssx...',
  '...xssssssssx...',
  '...xSSSSSSSSx...',
  '....xx....xx....',
  '................',
]

// 郵便ポスト(1マス16×16)。赤い箱に投函口、支柱の脇に小さな旗
const mailbox: PixelArt = [
  '................',
  '.....xxxxxx.....',
  '....xrrrrrrx....',
  '....xrUUUUrxm...',
  '....xrrrrrrx....',
  '....xrrDDrrx....',
  '....xrrrrrrx....',
  '....xrrrrrrx....',
  '....xRRRRRRx....',
  '....xxxxxxxx....',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '......kkkk......',
  '................',
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

const deskTopLeft: PixelArt = [
  'pppppppppppppppp',
  'pppppppppppppppp',
  'xxxxxxxxxxxxxxxx',
  'xvvvvvvvvvvvvvvx',
  'xvnnnnnnnnnnnnvx',
  'xvnnhhhhnnnnnnvx',
  'xvnnnnnnnnnnnnvx',
  'xxxxxxxxxxxxxxxx',
  'ppppppxssxpppppp',
  'ppppxxxxxxxxpppp',
  'xxxxxxxxxxxxxxxx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
]

const deskTopMiddle: PixelArt = [
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppxxxxxxp',
  'pppppppppxhhhhxp',
  'pppppppppxxxxxxp',
  'pppppppppppppppp',
  'pppxxxxxxxxxxppp',
  'pppxssssssssxppp',
  'pppxxssssssxxppp',
  'pppxxxxxxxxxxppp',
  'xxxxxxxxxxxxxxxx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
]

const deskTopRight: PixelArt = [
  'pppppppppppppppp',
  'ppppppppppxxpppp',
  'pppppppppxssxppp',
  'ppppppppxssssxpp',
  'ppppppppppxxpppp',
  'ppppppppppxxpppp',
  'ppxxxxxxxxxxpppp',
  'ppxhhhhhhhhxpppp',
  'ppxxxxxxxxxxpppp',
  'pppppppppppppppp',
  'xxxxxxxxxxxxxxxx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
]

const deskBottomLeft: PixelArt = [
  'xkkkkkkkkkkkkkkk',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xddddddddddddddd',
  'xxxxxxxxxxxxxxxx',
  'pxkkxppppppppppp',
  'pxkkxppppppppppp',
  'pxkkxppppppppppp',
  'pxkkxppppppppppp',
  'pxkkxppppppppppp',
  'pxxxxppppppppppp',
  'pppppppppppppppp',
]

const deskBottomMiddle: PixelArt = [
  'kkkkkkkkkkkkkkkk',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'xxxxxxxxxxxxxxxx',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
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

const roofRedLeft = compose(roofLeftTop, roofInnerTop, roofLeftBottom, roofInnerBottom)
const roofRedMiddle = compose(roofInnerTop, roofInnerTop, roofInnerBottom, roofInnerBottom)
const roofRedRight = compose(roofInnerTop, roofRightTop, roofInnerBottom, roofRightBottom)
// 最上段より下の屋根行。上端の輪郭を持たず、下半分の瓦を繰り返すだけ
const roofRedLeftLow = compose(roofLeftBottom, roofInnerBottom, roofLeftBottom, roofInnerBottom)
const roofRedMiddleLow = compose(roofInnerBottom, roofInnerBottom, roofInnerBottom, roofInnerBottom)
const roofRedRightLow = compose(roofInnerBottom, roofRightBottom, roofInnerBottom, roofRightBottom)
const wallMiddle = compose(wallTopLeft, wallTopRight, wallBottomLeft, wallBottomRight)
const wallLeft = compose(
  withLeftOutline(wallTopLeft),
  wallTopRight,
  withLeftOutline(wallBottomLeft),
  wallBottomRight
)
const wallRight = compose(
  wallTopLeft,
  withRightOutline(wallTopRight),
  wallBottomLeft,
  withRightOutline(wallBottomRight)
)
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

// 2マス幅の入口は観音開きの扉。左マスは左枠+左の扉板で、右端の1列が中央の合わせ目。右マスは左右反転
const entranceLeft: PixelArt = [
  'hhhhhhhhhhhhhhhh',
  'hHhhhhhhhhhhhhhh',
  'hhxxxxxxxxxxxxxx',
  'hhxDDDDDDDDDDDDD',
  'HHxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'hhxddDdddDdddDFD',
  'HHxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'hhxddDdddDdddDdD',
  'HHxddDdddDdddDdD',
  'HHxddDdddDdddDdD',
  'xxxddDdddDdddDdD',
]

export const structureArt: Record<StructureKey, PixelArt> = {
  'roof-red-l': roofRedLeft,
  'roof-red-m': roofRedMiddle,
  'roof-red-r': roofRedRight,
  'roof-blue-l': recolor(roofRedLeft, { r: 'u', R: 'U' }),
  'roof-blue-m': recolor(roofRedMiddle, { r: 'u', R: 'U' }),
  'roof-blue-r': recolor(roofRedRight, { r: 'u', R: 'U' }),
  'roof-red-l-low': roofRedLeftLow,
  'roof-red-m-low': roofRedMiddleLow,
  'roof-red-r-low': roofRedRightLow,
  'roof-blue-l-low': recolor(roofRedLeftLow, { r: 'u', R: 'U' }),
  'roof-blue-m-low': recolor(roofRedMiddleLow, { r: 'u', R: 'U' }),
  'roof-blue-r-low': recolor(roofRedRightLow, { r: 'u', R: 'U' }),
  'wall-l': wallLeft,
  'wall-m': wallMiddle,
  'wall-r': wallRight,
  window: compose(windowTopLeft, windowTopRight, windowBottomLeft, windowBottomRight),
  door: compose(doorTopLeft, doorTopRight, doorBottomLeft, doorBottomRight),
  'entrance-l': entranceLeft,
  'entrance-r': mirrorX(entranceLeft),
  robot,
  mailbox,
  marker: compose(
    markerTopLeft,
    mirrorX(markerTopLeft),
    markerBottomLeft,
    mirrorX(markerBottomLeft)
  ),
  'desk-tl': deskTopLeft,
  'desk-tm': deskTopMiddle,
  'desk-tr': deskTopRight,
  'desk-bl': deskBottomLeft,
  'desk-bm': deskBottomMiddle,
  'desk-br': mirrorX(deskBottomLeft),
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
