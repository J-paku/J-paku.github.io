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

// 石畳は8×8の石1個。1マスには compose で2×2=4個並べ、敷石らしく見せる
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

// 木は 1 マス(16×16 ドット)。丸い樹冠と短い幹だけの小さな木。四隅は草にして輪郭を丸く見せる
const tree: PixelArt = [
  'ggggggxTTxgggggg',
  'ggggxTTttTTxgggg',
  'gggxTTttttTTxggg',
  'ggxTttttttttTxgg',
  'ggxTttttttttTxgg',
  'gggxTTttttTTxggg',
  'ggggxTTttTTxgggg',
  'ggggggxTTxgggggg',
  'ggggggxkkxgggggg',
  'ggggggxkkxgggggg',
  'ggggggxkkxgggggg',
  'ggggggxkkxgggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
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
  path: compose(pathPart, pathPart, pathPart, pathPart),
  water: compose(waterTopLeft, waterTopRight, waterBottomLeft, waterBottomRight),
  plaza: compose(plazaTopLeft, plazaTopRight, plazaBottomLeft, plazaBottomRight),
  flower: compose(
    flowerQuarter,
    mirrorX(flowerQuarter),
    mirrorY(flowerQuarter),
    mirrorY(mirrorX(flowerQuarter))
  ),
  tree,
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
