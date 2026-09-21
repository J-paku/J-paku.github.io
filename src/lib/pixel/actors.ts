// 主人公: 深緑のキャップにゴーグル、茶髪、緑のジャケットと斜め掛けの革ストラップ(参照画像を 15×20 で写した二頭身)
// タイルは幅 16・高さ 24。足元をマスの下辺に揃え、頭はマスの上へ半マス(8 行)はみ出す。
// 静止コマは 4〜23 行、歩行コマは全体が一段下がって 5〜23 行に収まり、最下行だけ脚を振る
// 輪郭は x(#181818)で描き、白い縁取りは scene.module.css の drop-shadow が付ける
import type { PixelArt } from './art'
import { backLantern, frontLantern, LANTERN_BODY_TOP, overlayLantern, sideLantern } from './lantern'

export const PLAYER_HEIGHT = 24

type PlayerFrames = {
  up: [PixelArt, PixelArt, PixelArt]
  down: [PixelArt, PixelArt, PixelArt]
  right: [PixelArt, PixelArt]
  // 釣っている間の静止コマ。並びは上・下・右(左は右の反転)
  fish: [PixelArt, PixelArt, PixelArt]
}

// 描画の空行。頭上の余白に使う
const BLANK = '................'

// 正面。キャップの上にゴーグル、つばの下に前髪と目、頬は桃色。胸に生成りのインナーと左肩からの革ストラップ
const downBody: PixelArt = [
  '.....xxxxx......',
  '...xxQqqqQxx....',
  '..xQqqqqqqqQx...',
  '.xQqZZZqZZZqQx..',
  '.xQxILJxJILxQx..',
  '.xxjLLJxJLLjxx..',
  'xQjxJJxQxJJxjQx.',
  'xxxQxxqqqxxQxxx.',
  '.xZxxxxxxxxxZx..',
  'xAxxAKxAZKAxxAx.',
  'xxKxKxKAKxKxKxx.',
  '.xxKKxKKKxKKxx..',
  '..xxVKKKKKVxx...',
  '..xqxBxqxxqqx...',
  '.xQKxxBxYxMKQx..',
  '.xKqxqxBxBxqKx..',
  '.xVxxqYxBxBxVx..',
  '..xxzxzzxxBxx...',
]
const downFeet: PixelArt = ['...xAAxxzzZx....', '....xx..xxx.....']

// 背面(4方向参照の2体目を 16×24 格子で採取し、胴を 20 行に詰めた)。
// キャップの後ろをゴーグルのバンドが太く回り、その下に短い茶髪。ストラップは左肩から右腰の鞄へ
const upBody: PixelArt = [
  '....xxxxxxxx....',
  '..xxqqqqqqqqxx..',
  '.xqqqqqqqqqqqqx.',
  '.xqqqqqqqqqqqqx.',
  'xqqqqqqqqqqqqqqx',
  'xQjjjjjjjjjjjjQx',
  'xQjjjjjjjjjjjjQx',
  '.xQqqqqqqqqqqQx.',
  '.xZAAAAAAAAAAZx.',
  '.xAAAAAAAAAAAAx.',
  '..xAAAAAAAAAAx..',
  '...xZAAAAAAZx...',
  '....xxxxxxxx....',
  '...xBjMMMMMMMx..',
  '..xMxBjMMMMMMMx.',
  '.xKxMMxBjMMMxKx.',
  '.xKxMMMxBjBBxKx.',
  '...xQQQxBBBBx...',
]
const upFeet: PixelArt = ['...xZZx..xZZx...', '...xAAx..xAAx...']

// 右向き(4方向参照の4体目)。ゴーグルのバンドが前のレンズから後頭部へ斜めに掛かり、顔は前側に一つ目。
// 腰の鞄は背中側(左)。左向きは scaleX(-1) で作るので、絵は 1〜14 列に収めて反転してもずれないようにする
const rightBody: PixelArt = [
  '......xxxxxx....',
  '....xxqqqqqqx...',
  '...xqqqqqxxZjjx.',
  '..xMqqqxAjZIILx.',
  '.xMMMMxAAjjILIx.',
  '.xMMQxAZAZjLIIx.',
  '.xZxxxxxxQQjjjx.',
  '.xMMMMMqMMAAjjx.',
  '.xMMMMMZjAAKKjx.',
  '..xxxxxxjAKYxKx.',
  '.xZAAAAjKjKYxKx.',
  '..xAAAjKKKKYjYx.',
  '....xAZxxKVVx...',
  '.....xQQQQx.....',
  '....xQMMMMQx....',
  '...xAxJYYqQx....',
  '...xBxJYYqQx....',
  '...xBxJKKxjx....',
]
const rightFeet: PixelArt = ['....xxxQQQx.....', '.....xjAAjx.....']

// 静止: 頭上 4 行の余白 + 体 18 行 + 足 2 行
const stand = (body: PixelArt, feet: PixelArt): PixelArt => [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  ...body,
  ...feet,
]

// 歩行: 全体を一段下げ、足は 1 行に縮めて片脚を後ろへ引く(細く描く)
const walk = (body: PixelArt, feet: string): PixelArt => [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  ...body,
  feet,
]

// 絵は 0〜14 列に描いているので、軸足の交代はその 15 列だけを反転する(16 列目は空のまま)
const mirrorArt = (row: string): string => [...row.slice(0, 15)].reverse().join('') + row.slice(15)
const alternateFoot = (art: PixelArt): PixelArt => [
  ...art.slice(0, -1),
  mirrorArt(art[art.length - 1]),
]

// ここから下は釣り竿。静止コマへ竿だけを重ねて「竿を持って立っている」コマを作る。
// 型紙の '.' は元の絵を残し、それ以外は体のドットを塗り替える — ランタン(lantern.ts)と違って
// 竿は体の手前にあり、握った手や上着の上を通るため、重なりを禁じると竿が描けない。
// ただし夜は同じコマへランタンを重ねるので、ランタンの居場所(正面は右下、背面は左下、
// 横向きは前下)へ竿を伸ばすと overlayLantern が落ちる。向きごとの逃げ道は下の各型紙に書く
const overlayRod = (art: PixelArt, rod: PixelArt): PixelArt =>
  art.map((row, y) => [...row].map((ch, x) => (rod[y][x] === '.' ? ch : rod[y][x])).join(''))

// 正面。竿は右肩から左下へ斜めに渡し、穂先をマスの下辺のまん中(7 列目)で止める。
// ここは向かい合う水のマスに置く浮きの糸と同じ列なので、竿と糸が 1 本につながって見える。
// 右下はランタンの席なので、斜めに下ろすことで避けている。V は竿を握る二つの手
const downRod: PixelArt = [
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
  '................',
  '................',
  '.............E..',
  '.............E..',
  '............V...',
  '............eSs.',
  '...........e....',
  '...........V....',
  '..........e.....',
  '..........e.....',
  '.........e......',
  '........e.......',
  '.......e........',
  '.......e........',
]

// 背面。竿は体の右脇を通して上へ立て、穂先をマスの上辺まで伸ばす。
// 頭の 3 行(8〜10 行)は絵が横いっぱいに詰まっていて逃げ場が無いので、そこだけ輪郭を竿で置き換える。
// 手前を通る竿として読めるよう、置き換える色は暗い輪郭ではなく明るい木(e)のままにする
const upRod: PixelArt = [
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '..............Se',
  '.............VE.',
  '..............E.',
  '..............E.',
  '................',
  '................',
  '................',
]

// 横向き。体の前(14 列目)に竿を立て、握りは手の高さで前へ渡す。
// 前下へ倒せないのはランタンがそこへ提がるためで、左向きは scaleX(-1) で作るので
// 0 列目と 15 列目は空けたまま — 竿を 15 列目へ出すと反転したとき体から 1 列ずれる
const rightRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '............VEE.',
  '............S...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export const playerArt: PlayerFrames = {
  up: [
    stand(upBody, upFeet),
    walk(upBody, '...xAAx..xZx....'),
    alternateFoot(walk(upBody, '...xAAx..xZx....')),
  ],
  down: [
    stand(downBody, downFeet),
    walk(downBody, '...xAAx..xZx....'),
    alternateFoot(walk(downBody, '...xAAx..xZx....')),
  ],
  right: [stand(rightBody, rightFeet), walk(rightBody, '....xAAx.xAAx...')],
  fish: [
    overlayRod(stand(upBody, upFeet), upRod),
    overlayRod(stand(downBody, downFeet), downRod),
    overlayRod(stand(rightBody, rightFeet), rightRod),
  ],
}

// ここから下は夜だけ使う差分。昼のコマへ灯りを重ねるだけなので、体と服のドットは昼と 1 ドットも変わらない。
// ランタンの絵そのものは lantern.ts が正本で、ロボット(structures.ts)も同じ 1 枚を提げる。
// 向きごとに違うのは「その向きで体のどちら側が空いているか」だけなので、
// ここでは面を選んで重ねる位置を決めるところまでしかしない

// 体のドットは静止コマが 4 行目、歩行コマが 5 行目から始まる。ランタンも同じだけ下げると、
// 手からの位置がどのコマでも同じになり、コマ送りで灯りだけが跳ねない
const standLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, lantern, 4 + LANTERN_BODY_TOP)
const walkLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, lantern, 5 + LANTERN_BODY_TOP)

// 夜のコマ。コマ数も並びも playerArt と同じで、違いは灯りのドットだけ
export const playerNightArt: PlayerFrames = {
  up: [
    standLit(playerArt.up[0], backLantern),
    walkLit(playerArt.up[1], backLantern),
    walkLit(playerArt.up[2], backLantern),
  ],
  down: [
    standLit(playerArt.down[0], frontLantern),
    walkLit(playerArt.down[1], frontLantern),
    walkLit(playerArt.down[2], frontLantern),
  ],
  right: [standLit(playerArt.right[0], sideLantern), walkLit(playerArt.right[1], sideLantern)],
  // 釣りのコマも静止コマと同じ高さにランタンを提げる。竿がランタンの席へ入っていれば
  // overlayLantern がここで落ちるので、夜のコマを焼く前に気付ける
  fish: [
    standLit(playerArt.fish[0], backLantern),
    standLit(playerArt.fish[1], frontLantern),
    standLit(playerArt.fish[2], sideLantern),
  ],
}
