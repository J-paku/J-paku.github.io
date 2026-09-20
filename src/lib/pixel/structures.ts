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
  | 'lamp-t'
  | 'lamp-b'
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

// 窓。壁を下地に木枠と 4 枚ガラス、下に窓台を置く。ガラスは灯り用の文字(4・5)で描く
const windowTile: PixelArt = [
  'xekxkkhhhhhhhhkk',
  'xekxkhhhhhhhhhhk',
  'xekxhhhhhhhhhhhh',
  'xekxhxxxxxxxxxxh',
  'xekxhx455xx455xh',
  'xekxhx555xx555xh',
  'xekxhxxxxxxxxxxh',
  'xekxhx455xx455xh',
  'xekxhx555xx555xh',
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

// AI 作業台の相棒ロボット(1 マス)。ゴーグルの目とアンテナの星が目印。レンズは灯り用の文字(8)
const robot: PixelArt = [
  '.......FF.......',
  '......FFFF......',
  '.......aa.......',
  '....xxxxxxxx....',
  '..x1111111111x..',
  '..x111111111sx..',
  'xxxaaaassaaaaxxx',
  'xSxnvvnssnvvnxSx',
  'xSx8nn8ss8nn8xSx',
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

// 経歴碑 2×2(32×32)。石の台座に金の星と月桂樹、中央に 2 社分の碑文の線。星は灯り用の文字(9)
const monument: PixelArt = [
  '................................',
  '..............xxxx..............',
  '............xxhsSSxx............',
  '...........xhss99sSSx...........',
  '..........xhss9999sSSx..........',
  '.........xhsss9999ssSSx.........',
  '.........xh9999999999Sx.........',
  '.........xhs999pp999SSx.........',
  '.....xxxxxhss99999PsSSxxxxx.....',
  '.....xhssssss99ss99sssssSSx.....',
  '.....xhsssss99ssss9PssssSSx.....',
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

// PC 机 3×2(48×32)。上段は天板を上から見た形で画面 2 枚・キーボード・ノート PC、下段は前板と脚。
// 画面は灯り用の文字(6・7)。各モニターの左上 1 ドット(2 枚で計 2 ドット)だけは水色(v)のままで、
// 夜は光らない縁として残す
const desk: PixelArt = [
  '.........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.........',
  '.........xv666666666666xxv666666666666x.........',
  '.........x6777766666666xx6777777766666x.........',
  '.........x6677777766666xx6666666666666x.........',
  '.........x6777776666666xx6666666677666x.........',
  '.........x6667777777666xx6677677677666x.........',
  '.........x6666666666666xx6666666666666x.........',
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'xeeeeeeeeeeeeeeaaaeeeeeeeeeeeeaaaeeeeeeeeeeeeeex',
  'xeeeeeeeeeeeaaaaaaaaaeeeeeeaaaaaaaaaeeeeeeeeeeex',
  'xeeeexxxxxxxxxeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeex6666666xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeex6777666xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeex',
  'xeeeex6666666xeeeexxxxxxxxxxxxxxxxxxxxeeeeeeeeex',
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

// 街灯 1×2 の上半分。笠(s・S)の下に灯り用の文字(9)のガラス。外周は輪郭(x)で、
// 昼の草地でも夜の濃紺でも形が潰れないようにする。柱の位置は lamp-b の上端と揃える
const lampTop: PixelArt = [
  '................',
  '................',
  '.......xx.......',
  '......xssx......',
  '.....xsssSx.....',
  '....xssssSSx....',
  '...xSSSSSSSSx...',
  '...xx999999xx...',
  '....x999999x....',
  '....x999999x....',
  '....x999999x....',
  '....x999999x....',
  '....xx9999xx....',
  '.....xSSSSx.....',
  '......xsSx......',
  '......xsSx......',
]

// 街灯 1×2 の下半分。柱が地面まで続き、足元だけ台座が広がる。周りは草を見せるため透明
const lampBottom: PixelArt = [
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '......xsSx......',
  '.....xsSSSx.....',
  '.....xsSSSx.....',
  '....xsSSSSSx....',
  '....xSSSSSSx....',
  '....xxxxxxxx....',
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
  'lamp-t': lampTop,
  'lamp-b': lampBottom,
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

// ここから下は夜だけ使う差し替え。昼の絵へ灯りを重ねるだけなので、昼のドットは 1 つも変わらない
const CLEAR = '.'

// 型紙の CLEAR は元の絵をそのまま残す。絵のドットへ重ねてしまったら、黙って消さず組み立て時に落とす
const overlay = (art: PixelArt, patch: PixelArt): PixelArt =>
  art.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (patch[y][x] === CLEAR) return ch
        if (ch !== CLEAR) throw new Error(`灯りが絵と重なっています(${x}列${y}行)`)
        return patch[y][x]
      })
      .join('')
  )

// ロボットが右腕から提げる手提げランタン。主人公が夜に持つものと同じ作り・同じ大きさ・同じ灯り色に
// して、同じ道具だと分かるようにする。ガラス 2 列 × 4 行は光源文字の '9'(夜は #fff0a0)、笠は h、
// 台は S。腕(7・8 行)の真下に笠が来るよう 10 行目から吊るし、
// 体側のふちは胴の輪郭(12 列)と 13 列に足した x でつなぐ
const robotLantern: PixelArt = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............hh',
  '..............99',
  '.............x99',
  '.............x99',
  '.............x99',
  '.............SSS',
]

// 夜だけ差し替える絵。structureArt にすでにあるキーしか持てない型にする。
// ここへ新しいキーを足すと 4 段階のシートでマスの並びがずれ、昼と夜で別のマスが出てしまう
export const structureNightArt: Partial<Record<StructureKey, PixelArt>> = {
  robot: overlay(robot, robotLantern),
}
