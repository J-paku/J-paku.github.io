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
