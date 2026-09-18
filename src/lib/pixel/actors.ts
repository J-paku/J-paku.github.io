// 主人公: 深緑のキャップにゴーグル、茶髪、緑のジャケットと斜め掛けの革ストラップ
// 16×16 に頭(0〜7行: キャップ・ゴーグル・つば・顔)と体(8〜15行: ジャケット・ズボン・ブーツ)を収める
// 歩行コマは全体が一段下がるので、頭は1〜8行・体は9〜15行になる
// 輪郭は x(#181818)で描き、白い縁取りは scene.module.css の drop-shadow が付ける
import { mirrorX } from './art'
import type { PixelArt } from './art'

type PlayerFrames = {
  up: [PixelArt, PixelArt, PixelArt]
  down: [PixelArt, PixelArt, PixelArt]
  right: [PixelArt, PixelArt]
}

// 正面。つばの下に目が二つ、胸に生成りのインナーと左肩からの革ストラップ
const downStand: PixelArt = [
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjLLjjjjLLjx..',
  '..xjLLjjjjLLjx..',
  '.xQQQQQQQQQQQQx.',
  '..xAKxKKKKxKAx..',
  '...xAKKKKKKAx...',
  '...xMMMMMMMMx...',
  '..xNMBMYYMMMNx..',
  '..xNMMBYYMMMNx..',
  '..xNMMMBMMMMNx..',
  '..xKMMMMBMMMKx..',
  '...xzzzzzzzzx...',
  '...xzzzxxzzzx...',
  '..xzzzzxxzzzzx..',
]

// 正面の歩行。全体を一段下げて体を上下させ、脚を前後に振る
const downWalk: PixelArt = [
  '................',
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjLLjjjjLLjx..',
  '..xjLLjjjjLLjx..',
  '.xQQQQQQQQQQQQx.',
  '..xAKxKKKKxKAx..',
  '...xAKKKKKKAx...',
  '...xMMMMMMMMx...',
  '..xNMBMYYMMMNx..',
  '..xNMMBYYMMMNx..',
  '..xKMMMBMMMMKx..',
  '...xzzzzzzzzx...',
  '...xzzzxxzzx....',
  '..xzzzx..xzx....',
]

// 背面。ゴーグルのバンドがキャップの後ろを回り、襟足の茶髪が見える
const upStand: PixelArt = [
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjjjjjjjjjjx..',
  '..xjjjjjjjjjjx..',
  '.xQQQQQQQQQQQQx.',
  '..xAAAAAAAAAAx..',
  '...xAAAAAAAAx...',
  '...xMMMMMMMMx...',
  '..xNMMMMMMBMNx..',
  '..xNMMMMMBMMNx..',
  '..xNMMMMBMMMNx..',
  '..xKMMMBMMMMKx..',
  '...xzzzzzzzzx...',
  '...xzzzxxzzzx...',
  '..xzzzzxxzzzzx..',
]

// 背面の歩行。正面と同じく一段下げ、ストラップは背中側なので逆向きに掛かる
const upWalk: PixelArt = [
  '................',
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjjjjjjjjjjx..',
  '..xjjjjjjjjjjx..',
  '.xQQQQQQQQQQQQx.',
  '..xAAAAAAAAAAx..',
  '...xAAAAAAAAx...',
  '...xMMMMMMMMx...',
  '..xNMMMMMMBMNx..',
  '..xNMMMMMBMMNx..',
  '..xKMMMMBMMMKx..',
  '...xzzzzzzzzx...',
  '...xzzzxxzzx....',
  '..xzzzx..xzx....',
]

// 右向き。ゴーグルのレンズは進行方向側だけ見え、後頭部に茶髪が残る
const rightStand: PixelArt = [
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjjjjjjjLLjx..',
  '..xjjjjjjjLLjx..',
  '..xQQQQQQQQQQQx.',
  '..xAAAKKKxKx....',
  '...xAKKKKKx.....',
  '....xMMMMMMx....',
  '...xMMMBMMYx....',
  '...xMMBMMNMx....',
  '...xMBMMNKKx....',
  '...xBMMMMMx.....',
  '....xzzzzx......',
  '....xzzzzx......',
  '...xzzzzzx......',
]

// 右向きの歩行。前脚を進行方向へ出し、後脚を残す
const rightWalk: PixelArt = [
  '................',
  '....xxxxxxxx....',
  '...xqqqqqqqqx...',
  '..xqqqqqqqqqqx..',
  '..xjjjjjjjLLjx..',
  '..xjjjjjjjLLjx..',
  '..xQQQQQQQQQQQx.',
  '..xAAAKKKxKx....',
  '...xAKKKKKx.....',
  '....xMMMMMMx....',
  '...xMMMBMMYx....',
  '...xMMBMMNMx....',
  '...xMBMMNKKx....',
  '...xBMMMMMx.....',
  '...xzzxzzx......',
  '..xzzx.xzzzx....',
]

// 頭と胴は固定し、ブーツと脚の行だけを反転して軸足を交代する
const alternateFoot = (art: PixelArt): PixelArt => [...art.slice(0, 14), ...mirrorX(art.slice(14))]
export const playerArt: PlayerFrames = {
  up: [upStand, upWalk, alternateFoot(upWalk)],
  down: [downStand, downWalk, alternateFoot(downWalk)],
  right: [rightStand, rightWalk],
}
