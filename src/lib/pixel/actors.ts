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

// 背面。ゴーグルのバンドがキャップの後ろを太く回り、その下に短い茶髪。ストラップは背中を斜めに渡り腰の鞄へ
const upBody: PixelArt = [
  '.....xxxxx......',
  '...xxqqqqqxx....',
  '..xqqqqqqqqqx...',
  '.xqqqqqqqqqqqx..',
  '.xQjjjjjjjjjQx..',
  '.xjjjjjjjjjjjx..',
  'xQqqqqqqqqqqqQx.',
  'xQQqqqqqqqqqQQx.',
  '.xxQQQQQQQQQxx..',
  '.xAAAAAAAAAAAx..',
  '.xZAAAAAAAAAZx..',
  '..xZAAAAAAAZx...',
  '..xxxAAAAAxxx...',
  '..xqxBMMMMxqx...',
  '.xqMxMBMMMMMqx..',
  '.xKqxMMBMMMqKx..',
  '.xKxxMMMBMMxKx..',
  '..xxQQQQBBQxx...',
]
const upFeet: PixelArt = ['...xAAxxxAAx....', '...xxx...xxx....']

// 右向き。つばとゴーグルのレンズは進行方向側だけ見え、後頭部に茶髪が残る。腰の鞄は背中側。
// 左向きは scaleX(-1) で作るので、絵は 1〜13 列に収めて反転してもずれないようにする
const rightBody: PixelArt = [
  '.....xxxxx......',
  '...xxqqqqqxx....',
  '..xqqqqqqqqqx...',
  '..xqqqqqqxIIx...',
  '.xqjjjjjjxLIJx..',
  '.xqjjjjjjjjJx...',
  '.xQqqqqqqqqQx...',
  '..xxQQQQQQxxx...',
  '..xAAAAAxKKKx...',
  '.xAAAAAAxKxKKx..',
  '.xAAAAAAxKKKKx..',
  '..xAAAAAxKVKx...',
  '...xxxxxxKKxx...',
  '.....xMMMMx.....',
  '....xBMMMMMx....',
  '....xBxMMMMx....',
  '....xBxYMMMx....',
  '....xKxMMMMx....',
]
const rightFeet: PixelArt = ['.....xQQQQx.....', '....xAAxAAx.....']

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
  right: [stand(rightBody, rightFeet), walk(rightBody, '...xAAx..xAAx...')],
}
