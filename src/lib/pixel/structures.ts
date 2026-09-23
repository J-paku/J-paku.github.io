// 村の建物と設置物を文字マトリクスで描く
import { compose, mirrorX, recolor, TILE } from './art'
import type { PixelArt } from './art'
import { mailboxWithLeds } from './mailbox-led'

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
  | 'campfire'
  | 'clock'
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

// 焚き火(1 マス)。下から石の輪・交差させた薪 2 本・炎、上へ弾ける火の粉。
// 夜用の差し替えは作らない — 昼も燃えている絵 1 枚で足り、発光は palette-phase.ts が夜に効かせる。
//
// 炎の身は灯り用の文字(9)で、外側の縁だけが橙(r)と根元の濃い赤(R)。9 の昼の色は黄(F)と
// 完全に同じ #f8e060 なので、この置き換えで昼の絵は 1 ドットも変わらない(sprites.test.ts が固定)。
// 逆に F のままだと、夜は光源以外が #101c38 へ 0.68 混ざるので F は暗い黄土(#5a5b45)、
// r は #532d38 まで落ち、炎が「黄色い塊に暗い縁が付いたもの」にしか見えない(4 倍の夜で実測)。
// 身を発光させて縁だけ暗く残すと、夜でも炎の形が立つ。
// 光る身は 5〜11 行(幅 2・2・4・4・6・6・4)。1〜2 ドットの細片は 4 倍表示で消えるので、
// 横幅はどの行も 2 ドット以上を保つ。上へ飛ぶ火の粉(1・3・5 行の 1 ドット)も熾火なので光らせる
const campfire: PixelArt = [
  '................',
  '..........9.....',
  '................',
  '.....9..........',
  '.......rr.......',
  '......r99r..9...',
  '......r99r......',
  '.....r9999r.....',
  '.....r9999r.....',
  '....r999999r....',
  '....r999999r....',
  '....Rr9999rR....',
  '..bkkkRrrREEEb..',
  '....bkkkEEEb....',
  'xssxbEEEkkkbxssx',
  'xSSxxssxxssxxSSx',
]

// 卓上時計(1 マス)。下 2/3 が木の小机(天板 e・前縁 E・脚)で、その上に 8×6 の時計を載せる。
// 時計の身はクリーム(h・H)、液晶は黒(a)で、表示の数字だけ灯り用の文字(6・7)にする。
// 夜用の差し替えは作らない — 数字が palette-phase.ts で発光色へ変わり、机と身は闇に沈む。
// 背景は透明('.')のまま。床の色(p)で塗ると部屋の床の縞模様がこのマスだけ消える(机 desk と同じ扱い)
const clock: PixelArt = [
  '....xxxxxxxx....',
  '....xhhhhhhx....',
  '....xaaaaaax....',
  '....x67aa67x....',
  '....xhhhhhhx....',
  '....xHHHHHHx....',
  '.xxxxxxxxxxxxxx.',
  '.xeeeeeeeeeeeex.',
  '.xeeeeeeeeeeeex.',
  '.xEEEEEEEEEEEEx.',
  '.xxxxxxxxxxxxxx.',
  '..xeEx....xeEx..',
  '..xeEx....xeEx..',
  '..xeEx....xeEx..',
  '..xeEx....xeEx..',
  '..xxxx....xxxx..',
]

// 経歴碑 2×2(32×32)。石の二段台座に木の額を立て、頭に金の星、背に月桂樹と白い花を添える。
// 額の中は人物・仕事・成果の印と碑文の行で、読める文字は入れない(16ドットでは潰れるため)。
// 星だけは灯り用の文字(9)にして、夜は palette-phase.ts が発光色へ差し替える
const monument: PixelArt = [
  '................................',
  '...............xx...............',
  '..............x99x..............',
  '.............x9999x.............',
  '.........x999999999999x.........',
  '..........x9999999999x..........',
  '.....xtG...x99999999x...Gtx.....',
  '....xttG...x99x..x99x...Gttx....',
  '...xttGG...x99x..x99x...GGttx...',
  '..xttGtGxxxxxxxxxxxxxxxxGtGttx..',
  '...xGttGxEeeeeeeeeeeeeExGttGx...',
  '..xttttGxePEPPPPPPPPPPexGttttx..',
  '.xtthttGxeEEEPEEEEEEEEexGtthttx.',
  '.xthFhtGxePPPPPPPPPPPPexGthFhtx.',
  '.xtthttGxePEPPPPPPPPPPexGtthttx.',
  '..xttttGxeEEEPEEEEEEEPexGttttx..',
  '...xGttGxePPPPPPPPPPPPexGttGx...',
  '..xttGtGxePPEPPPPPPPPPexGtGttx..',
  '...xttGGxePEEPEEEEEEPPexGGttx...',
  '....xttGxeEEEPPPPPPPPPexGttx....',
  '.....xtGxEeeeeeeeeeeeeExGtx.....',
  '........xxxxxxxxxxxxxxxx........',
  '....xssssssssssssssssssssssx....',
  '....xssssssssssssssssssssssx....',
  '....xHHHHHHHHHHHHHHHHHHHHHHx....',
  '....xHHHHHHHHHHHHHHHHHHHHHHx....',
  '....xSSSSSSSSSSSSSSSSSSSSSSx....',
  '.xssssssssssssssssssssssssssssx.',
  '.xssssssssssssssssssssssssssssx.',
  '.xHHHHHHHHHHHHHHHHHHHHHHHHHHHHx.',
  '.xSSSSSSSSSSSSSSSSSSSSSSSSSSSSx.',
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
// 昼の草地でも夜の濃紺でも形が潰れないようにする。
// 絵は 1 マスの上辺から描き始め、笠・ガラス・柱の順に上のマスへ寄せる。
// 下 4 行は柱で、最終行がそのまま lamp-b の上端につながる(継ぎ目は sprites-art.test.ts が固定)
const lampTop: PixelArt = [
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
  '......xsSx......',
  '......xsSx......',
]

// 街灯 1×2 の下半分。上のマスから降りてきた柱が 2 行続き、台座で終わる。
// 下のマスは歩いて通る場所なので、台座から下の 10 行は透明にして草を見せる
const lampBottom: PixelArt = [
  '......xsSx......',
  '......xsSx......',
  '.....xsSSSx.....',
  '....xsSSSSSx....',
  '....xSSSSSSx....',
  '....xxxxxxxx....',
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
  mailbox: mailboxWithLeds(mailbox, false),
  campfire,
  clock,
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

// ここから下は夜だけ使う差し替え。昼の絵のドットは 1 つも変わらない。
// 粒をどこへどの色で置くかは mailbox-led.ts の受け持ちで、ここは絵の表に徹する

// 夜だけ差し替える絵。structureArt にすでにあるキーしか持てない型にする。
// ここへ新しいキーを足すと 4 段階のシートでマスの並びがずれ、昼と夜で別のマスが出てしまう
export const structureNightArt: Partial<Record<StructureKey, PixelArt>> = {
  mailbox: mailboxWithLeds(mailbox, true),
}
