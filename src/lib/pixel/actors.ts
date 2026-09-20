// 主人公: 深緑のキャップにゴーグル、茶髪、緑のジャケットと斜め掛けの革ストラップ(参照画像を 15×20 で写した二頭身)
// タイルは幅 16・高さ 24。足元をマスの下辺に揃え、頭はマスの上へ半マス(8 行)はみ出す。
// 静止コマは 4〜23 行、歩行コマは全体が一段下がって 5〜23 行に収まり、最下行だけ脚を振る
// 輪郭は x(#181818)で描き、白い縁取りは scene.module.css の drop-shadow が付ける
import type { PixelArt } from './art'

export const PLAYER_HEIGHT = 24

type PlayerFrames = {
  up: [PixelArt, PixelArt, PixelArt]
  down: [PixelArt, PixelArt, PixelArt]
  right: [PixelArt, PixelArt]
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
}

// ここから下は夜だけ使う差分。昼のコマへ灯りを重ねるだけなので、体と服のドットは昼と 1 ドットも変わらない
const CLEAR = '.'

// 型紙の CLEAR は元の絵をそのまま残す。体のドットへ重ねてしまったら、黙って体を削らず組み立て時に落とす
const overlayRow = (row: string, patch: string): string =>
  [...row]
    .map((ch, x) => {
      if (patch[x] === CLEAR) return ch
      if (ch !== CLEAR) throw new Error(`灯りが体と重なっています(${x}列)`)
      return patch[x]
    })
    .join('')

// 灯りの型紙は「体 18 行 + その 1 行下」の 19 行。静止コマは体が 4 行目から、歩行コマは 5 行目から始まるので、
// 型紙も同じだけ下げる。こうすると手からの位置がどのコマでも同じになり、コマ送りで灯りだけが跳ねない
const LANTERN_ROWS = 19

const lanternArt = (rows: Record<number, string>): PixelArt =>
  Array.from({ length: LANTERN_ROWS }, (_, y) => rows[y] ?? BLANK)

const overlayLantern = (art: PixelArt, lantern: PixelArt, top: number): PixelArt =>
  art.map((row, y) => {
    const at = y - top
    return at < 0 || at >= LANTERN_ROWS ? row : overlayRow(row, lantern[at])
  })

const standLit = (art: PixelArt, lantern: PixelArt): PixelArt => overlayLantern(art, lantern, 4)
const walkLit = (art: PixelArt, lantern: PixelArt): PixelArt => overlayLantern(art, lantern, 5)

// 手提げランタン。街灯と同じ作りにする — 明るいガラスの塊を、上の笠・下の台・両脇の暗いふちで囲う。
// ガラスは光源文字の '9'(夜は #fff0a0)で街灯・経歴碑の星と同じ灯り色。笠は h、台は S の金物。
// 夜は色調が深く沈むので、笠には夜でもいちばん明るく残る h を使い、腕から灯りへ渡る金具として読ませる。
//
// 置く高さは手の行(正面・背面は 16、横向きは 12)に合わせる。足元の行(18)へ下ろすと
// 地面に置いた物に見え、4 倍では持ち物として読めない。そのため灯りは体の行 12〜17 に収め、
// 足元の行には一切かからない。ガラスは 2 列 × 4 行の塊にする — 1〜2 ドットの細片では 4 倍で消える。
// 体側のふちは体の輪郭をそのまま使う。外側は、タイルの端まで 2 列しか空いていない向き
// (正面・背面)ではふちを省いて塊の幅を優先する。夜の地面は暗く、主人公には白い drop-shadow が
// 付くので、ふちが無くても地面とは切れて見える

// 正面。手(12列)の外側 2 列がガラス。笠と台は 3 列で体の輪郭までせり出し、腕から吊るした金具に見せる
const downLantern = lanternArt({
  12: '.............hhh',
  13: '..............99',
  14: '..............99',
  15: '..............99',
  16: '..............99',
  17: '.............SSS',
})

// 背面。胴が広く、手の行(15・16)は体の脇が 1 列しか空いていないので、灯りはほとんど胴に隠れる。
// 見えるのは上半分の 2 列と、手の高さで 1 列ぶんの帯だけ。笠(4列)と台(3列)は幅が取れるので、
// そこで灯りの形と、体から吊るしている金具を示す
const upLantern = lanternArt({
  12: 'hhhh............',
  13: '99x.............',
  14: '99..............',
  15: '9...............',
  16: '9...............',
  17: 'SSS.............',
})

// 横向き。体の脇が 4 列空くので灯り全体が見え、外側のふち(14列)も置ける。
// 手は 12 行の 10・11 列。その真下(13 行)から笠が伸び、ガラス 2×4 を
// 体の輪郭(11列)と外側のふちで挟む。反転して左向きを作るため、昼のコマと同じく 1〜14 列に収める
const rightLantern = lanternArt({
  13: '...........hhhx.',
  14: '............99x.',
  15: '............99x.',
  16: '............99x.',
  17: '............99x.',
})

// 夜のコマ。コマ数も並びも playerArt と同じで、違いは灯りのドットだけ
export const playerNightArt: PlayerFrames = {
  up: [
    standLit(playerArt.up[0], upLantern),
    walkLit(playerArt.up[1], upLantern),
    walkLit(playerArt.up[2], upLantern),
  ],
  down: [
    standLit(playerArt.down[0], downLantern),
    walkLit(playerArt.down[1], downLantern),
    walkLit(playerArt.down[2], downLantern),
  ],
  right: [standLit(playerArt.right[0], rightLantern), walkLit(playerArt.right[1], rightLantern)],
}
