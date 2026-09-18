// 村の地形タイルを八ドット部品から組み立てる
import { compose, mirrorX, mirrorY } from './art'
import type { PixelArt } from './art'
import type { Tile } from '@content/types/world'

const grassPart: PixelArt = [
  'gggggggg',
  'gggggggg',
  'ggGggggg',
  'gGgGgggg',
  'gggggggg',
  'gggggygg',
  'ggggGyGg',
  'gggggggg',
]

const pathPart: PixelArt = [
  'PPPPPPPP',
  'Pppppppp',
  'Pppppppp',
  'PpppPppp',
  'Pppppppp',
  'Pppppppp',
  'Pppppppp',
  'Pppppppp',
]

const waterTopLeft: PixelArt = [
  'wwwwwwww',
  'wwwwwwww',
  'wwvvvwww',
  'wwwwvvww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
]

const waterTopRight: PixelArt = [
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
]

const waterBottomLeft: PixelArt = [
  'wwwwwwww',
  'wwwwwwww',
  'wwWWWWww',
  'wwwwwWww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
]

const waterBottomRight: PixelArt = [
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wwwwwwww',
  'wvvwwwww',
  'wwvvvvww',
  'wwwwwwww',
  'wwwwwwww',
]

const plazaTopLeft: PixelArt = [
  'SSSSSSSS',
  'Ssssssss',
  'Ssssssss',
  'SssSssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
]

const plazaTopRight: PixelArt = [
  'SSSSSSSS',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'SsssssSs',
  'Ssssssss',
  'Ssssssss',
]

const plazaBottomLeft: PixelArt = [
  'SSSSSSSS',
  'Ssssssss',
  'SsssssSs',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
]

const plazaBottomRight: PixelArt = [
  'SSSSSSSS',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'Ssssssss',
  'SsssSsss',
  'Ssssssss',
]

const flowerQuarter: PixelArt = [
  'gggggggg',
  'gggggggg',
  'gggfgggg',
  'ggfFfggg',
  'gggfgggg',
  'gggggggg',
  'gggggggg',
  'gggggggg',
]

// 木は 2×2 マス(32×32 ドット)。左半分だけを手描きし、右半分は mirrorX で対称に作る
// 上の 3/4 が丸い樹冠、下は中央に太い幹。外側の角は草にして輪郭を丸く見せる
const treeTopLeft: PixelArt = [
  'ggggggggxxxxxxxx',
  'ggGggxxxTTTTTTTT',
  'gGgxxTTTtttttttt',
  'ggxTTttttttttttt',
  'gxTTtttttttttttt',
  'gxTtttttTttttttt',
  'xTTttttttttttttt',
  'xTtttttttttttttt',
  'xTttttTttttttttt',
  'xTtttttttttttttt',
  'xTttttttttTttttt',
  'xTtttttttttttttt',
  'xTtttTtttttttttt',
  'xTtttttttttttttt',
  'xTttttttTttttttt',
  'xTtttttttttttttt',
]

const treeBottomLeft: PixelArt = [
  'xTtttttttttttttt',
  'xTtttttTtttttttt',
  'gxTTtttttttttttt',
  'gxTttttttttttttt',
  'ggxTTttttttttttt',
  'gggxxTTTtttttttt',
  'gggggxxxTTTTTTTT',
  'ggGgggggxxxxxxxx',
  'gggggggggggggxkk',
  'gggggggggggggxkk',
  'ggGggggggggggxkk',
  'gGgGgggggggggxkk',
  'gggggggggggggxkk',
  'ggggggggggggxkkk',
  'ggggyggggggxkkkk',
  'gggGyGgggggGGGGG',
]

const fenceLeft: PixelArt = [
  'gggggggg',
  'gEggggEg',
  'gEggggEg',
  'Eeeeeeee',
  'gEggggEg',
  'Eeeeeeee',
  'gEggggEg',
  'gggggggg',
]

const floorPart: PixelArt = [
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'PPPPPPPP',
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'PPPPPPPP',
]

const wallTopPart: PixelArt = [
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
]

const wallBottomPart: PixelArt = [
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xeekxeek',
  'xxxxxxxx',
]

// 壁の扉(右上の出口)。木の壁の中央に枠付きの扉。上半分は壁と同じ板目
const doorwayTopLeft: PixelArt = [
  'xeekxeek',
  'xeekxeek',
  'xeekxxxx',
  'xeekxddd',
  'xeekxdDd',
  'xeekxddd',
  'xeekxdDd',
  'xeekxddd',
]
const doorwayBottomLeft: PixelArt = [
  'xeekxdDd',
  'xeekxddd',
  'xeekxdDd',
  'xeekxddF',
  'xeekxdDd',
  'xeekxddd',
  'xeekxdDd',
  'xxxxxxxx',
]

const matTopLeft: PixelArt = [
  'pppppppp',
  'pppppppp',
  'pppppppp',
  'ppSSSSSS',
  'ppShhhhh',
  'ppShhhhh',
  'ppShhhhh',
  'ppShxxxx',
]

const matBottomLeft: PixelArt = [
  'ppShhxxx',
  'ppShhhxx',
  'ppShhhhx',
  'ppShhhhh',
  'ppShhhhh',
  'ppSSSSSS',
  'pppppppp',
  'pppppppp',
]

export const terrainArt: Record<Tile, PixelArt> = {
  grass: compose(grassPart, mirrorX(grassPart), mirrorY(grassPart), mirrorY(mirrorX(grassPart))),
  'grass-alt': compose(
    mirrorY(grassPart),
    grassPart,
    mirrorX(grassPart),
    mirrorY(mirrorX(grassPart))
  ),
  path: compose(pathPart, mirrorX(pathPart), mirrorY(pathPart), mirrorY(mirrorX(pathPart))),
  water: compose(waterTopLeft, waterTopRight, waterBottomLeft, waterBottomRight),
  plaza: compose(plazaTopLeft, plazaTopRight, plazaBottomLeft, plazaBottomRight),
  flower: compose(
    flowerQuarter,
    mirrorX(flowerQuarter),
    mirrorY(flowerQuarter),
    mirrorY(mirrorX(flowerQuarter))
  ),
  'tree-tl': treeTopLeft,
  'tree-tr': mirrorX(treeTopLeft),
  'tree-bl': treeBottomLeft,
  'tree-br': mirrorX(treeBottomLeft),
  fence: compose(fenceLeft, mirrorX(fenceLeft), mirrorY(fenceLeft), mirrorY(mirrorX(fenceLeft))),
  floor: compose(floorPart, floorPart, floorPart, floorPart),
  wall: compose(wallTopPart, wallTopPart, wallBottomPart, wallBottomPart),
  mat: compose(matTopLeft, mirrorX(matTopLeft), matBottomLeft, mirrorX(matBottomLeft)),
  doorway: compose(
    doorwayTopLeft,
    mirrorX(doorwayTopLeft),
    doorwayBottomLeft,
    mirrorX(doorwayBottomLeft)
  ),
}
