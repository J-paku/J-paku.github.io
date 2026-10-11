// 主人公: 深緑のキャップにゴーグル、茶髪、緑のジャケットと斜め掛けの革ストラップ(参照画像を 15×20 で写した二頭身)
// タイルは幅 16・高さ 24。足元をマスの下辺に揃え、頭はマスの上へ半マス(8 行)はみ出す。
// 静止コマは 4〜23 行、歩行コマは全体が一段下がって 5〜23 行に収まり、最下行だけ脚を振る
// シートへ焼くときはこの体を32×32の画布へ置き、傘と飛行のコマは余白も使う(compose-player.tsのPLAYER_BODY_*)
// 輪郭は x(#181818)で描き、白い縁取りは scene.module.css の drop-shadow が付ける
// ここは絵のデータと、それを組み立てる呼び出しだけを置く。組み立ての手順(頭をずらす・型紙を重ねる・画布へ置く)は compose-player.ts
import type { PixelArt } from './art'
import {
  alternateFoot,
  coverAt,
  framed2,
  framed3,
  hangLantern,
  litFishing,
  mirrorBack,
  mirrorFront,
  overlayRod,
  partAt,
  pose,
  stand,
  STAND_LANTERN_TOP,
  standLit,
  swapCanopy,
  toFrame,
  walk,
  walkLit,
} from './compose-player'
import type { Hang, Swap, Triple } from './compose-player'
import { flightArt } from './flight-art'
import { backLantern, frontLantern, sideLantern } from './lantern'
import {
  umbrellaDownOriginal,
  umbrellaLeftOriginal,
  umbrellaRightOriginal,
  umbrellaUpOriginal,
} from './umbrella-original'

// コマの寸法の正本は compose-player.ts。シートを焼く側(sprites.ts)とテストは今までどおりここから読む
export {
  PLAYER_BODY_LEFT,
  PLAYER_BODY_TOP,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  PLAYER_HEIGHT,
} from './compose-player'

// 釣りの 1 場面ぶんのコマ。並びは上・下・右(左は右の反転)
type FishingFrames = [PixelArt, PixelArt, PixelArt]

type PlayerFrames = {
  // 飛行の2コマ。既に32×32の画布へ描かれている
  flyDown: [PixelArt, PixelArt]
  flyUp: [PixelArt, PixelArt]
  flyRight: [PixelArt, PixelArt]
  up: [PixelArt, PixelArt, PixelArt]
  down: [PixelArt, PixelArt, PixelArt]
  right: [PixelArt, PixelArt]
  // 糸を垂らして待つ静止コマ
  fish: FishingFrames
  // 投げる動き。windup → backswing → cast → follow → fish の順に送る
  windup: FishingFrames
  backswing: FishingFrames
  cast: FishingFrames
  follow: FishingFrames
  // 当たり。浮きが沈むのに合わせて tense と bite を行き来する(糸が見えている間のコマ)
  tense: FishingFrames
  bite: FishingFrames
  // 釣り上げ。pull で竿を起こし、結果の窓が出ている間は hoist のまま
  pull: FishingFrames
  hoist: FishingFrames
  // 雨の外で傘を差したコマ。並びは up・down・right と同じ(静止・歩行 1・歩行 2、横向きは静止・歩行)。
  // 原画に左向きの行があるので、傘を差したコマだけは左向きも反転で作らず持つ
  umbrellaUp: [PixelArt, PixelArt, PixelArt]
  umbrellaDown: [PixelArt, PixelArt, PixelArt]
  umbrellaRight: [PixelArt, PixelArt]
  umbrellaLeft: [PixelArt, PixelArt]
  // 外へ出た直後に傘を出して開く動き(正面)。reach → draw → extend → half → raise の順に送り、
  // umbrellaDown の静止コマで締める
  umbrellaOpen: {
    reach: PixelArt
    draw: PixelArt
    extend: PixelArt
    half: PixelArt
    raise: PixelArt
  }
  // 中へ入る前に傘を閉じてしまう動き(背面)。umbrellaUp の静止コマから lower → half → closed →
  // compact → stow の順に送り、傘を持たない up の静止コマで締める
  umbrellaClose: {
    lower: PixelArt
    half: PixelArt
    closed: PixelArt
    compact: PixelArt
    stow: PixelArt
  }
}

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

// 静止コマ(頭上 4 行の余白 + 体 18 行 + 足 2 行)。釣りのコマはこれを元に組む
const upStand = stand(upBody, upFeet)
const downStand = stand(downBody, downFeet)
const rightStand = stand(rightBody, rightFeet)

// ここから下は釣り竿。静止コマへ竿だけを重ねて「竿を持って立っている」コマを作る(重ね方は compose-player.ts の overlayRod)。
// 夜は同じコマへランタンを重ねるので、ランタンの居場所(正面は右下、背面は左下、
// 横向きは前下)へ竿を伸ばすと overlayLantern が落ちる。向きごとの逃げ道は下の各型紙に書く

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

// ここから下は釣りの体の動き。静止コマへ竿だけを重ねていた頃は、振りかぶっても当たりが来ても
// 体が 1 ドットも動かず、竿の棒だけが入れ替わって見えた。そこで頭と手を竿と一緒に動かす。
// 腰から下と足元(21〜23 行)の体のドットは静止コマのまま触らない(竿が前を横切るだけ)。釣りの間は
// 主人公の位置をロジック側で動かさないので、足の接地点がそのまま村の座標になる — ここがずれると竿を振るたびに滑って見える。
//
// 上体の傾きは頭の上下で表す。首から下が 5 行しかない二頭身で胴を傾ける余地が無く、
// 頭もほぼマスの幅いっぱい(正面 0〜14 列・背面 0〜15 列・横向き 1〜14 列)なので横へはずらせない。
// 上下の向きは見下ろしの画面の奥行きに合わせる:
//  - 正面: 手前の水へ乗り出すと頭が下がって顎が襟に埋まり、反ると頭が上がって首が覗く
//  - 背面: 奥の水へ乗り出すと頭が上がって襟足が覗き、反ると頭が手前へ来て肩に沈む
//  - 横向き: 前はマスの端とランタンで塞がっているので、うつむきは頭を下げて顎を引き、反ると頭が上がる

// 頭の上下・部品の型紙(partAt)・型紙を重ねる順は compose-player.ts の pose。
// 部品の型紙の '-' は「そこを透明へ戻す」印(腰に下ろしていた手、ランタンの席へはみ出す顎や頬を消す)

// ---- 正面 ----
// 竿を握る手は待機コマ(downRod)と同じ画面の右側に描き、投げも当たりもそこを支点に竿を回す。
// 右下はランタンの席(16〜20 行の 14・15 列と 21 行の 13〜15 列)なので、手も竿もそこへは入れない。
// 灯りを提げる手(20 行 12 列)は触らない — 夜に灯りが手に提がって見えるのはこの手があるから。
// その上の腕(17・18 行の 11〜13 列)は守らない。頭を 1 行下げると顎が 17 行に、2 行下げると頭の輪郭が 18 行まで掛かり、
// 竿を握る手や竿も 17 行 11 列を通る

// 反ると顎と襟の間に 1 行空くので、そこを首で埋める
const downNeck = partAt({ 16: '.....xKKKx......' })
// 空いている左腕を横へ上げる(振りかぶるときの釣り合いと、釣り上げたときの万歳)。
// 腰に下ろしていた手は消し、胴の左端を輪郭で閉じる
const downFreeArmUp = partAt({
  16: 'xVx.............',
  17: '.xMx............',
  18: '.-xQ............',
  19: '.-xq............',
  20: '.-xq............',
})
// 頭を 2 行下げると頬の輪郭(16 行 14 列)がランタンの笠に掛かるので、そこだけ削る
const downCheekClear = partAt({ 16: '..............-.' })

// 振りかぶりの準備。竿を右肩の上へ真っすぐ立て、手を頬の横まで上げる
const downWindupRod: PixelArt = [
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
  '.............VE.',
  '.............VS.',
  '..............E.',
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
// 振りかぶり。手をこめかみまで上げ、竿は頭の上を越えて後ろへしなる。糸の先の浮き(R)が左に揺れる
const downBackswingRod: PixelArt = [
  '......eeeee.....',
  '....ee.....e....',
  '...e........e...',
  '..e..........e..',
  '..h...........e.',
  '..h...........e.',
  '.xRx.........VE.',
  '..x..........VS.',
  '..............E.',
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
  '................',
  '................',
  '................',
]
// 投げ。頭の上から前へ振り下ろす途中で、竿は帽子の上を斜めに渡り、先で糸(h)が伸びる
const downCastRod: PixelArt = [
  '..hhh...........',
  '.h...e..........',
  '......e.........',
  '.......e........',
  '........e.......',
  '.........e......',
  '..........e.....',
  '...........e....',
  '............e...',
  '............e...',
  '.............e..',
  '.............VE.',
  '.............VS.',
  '..............E.',
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
// 振り抜き。竿は左下まで下り切り、体も深く前へ倒れる。糸はまだ隠れているので穂先の位置は自由
const downFollowRod: PixelArt = [
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
  '................',
  '............E...',
  '............E...',
  '...........V....',
  '..........eS....',
  '.........eV.....',
  '........e.......',
  '.......e........',
  '......e.........',
  '.....e..........',
  '....e...........',
  '...e............',
]
// 当たりで身構える。握りを 1 行下げて竿をたわませるが、18 行から下は待機コマと同じ座標に残す。
// 22・23 行の穂先がずれると、浮きへ下ろした糸(fishing-art.ts)と途切れる
const downTenseRod: PixelArt = [
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
  '................',
  '.............E..',
  '.............E..',
  '............V...',
  '............eS..',
  '...........V....',
  '..........e.....',
  '..........e.....',
  '.........e......',
  '........e.......',
  '.......e........',
  '.......e........',
]
// 引き込まれる。うつむいた頭と逆に握りを頬の上まで引き寄せ、竿は穂先を残して大きく曲がる
const downBiteRod: PixelArt = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............E.',
  '.............VE.',
  '.............VS.',
  '.............e..',
  '.............e..',
  '.............e..',
  '............e...',
  '............e...',
  '...........e....',
  '..........e.....',
  '..........e.....',
  '.........e......',
  '........e.......',
  '.......e........',
  '.......e........',
]
// 釣り上げ。反りながら竿を斜めに起こす。糸はもう外してあるので穂先は自由
const downPullRod: PixelArt = [
  '.......e........',
  '........e.......',
  '........e.......',
  '.........e......',
  '.........e......',
  '..........e.....',
  '..........e.....',
  '...........e....',
  '...........e....',
  '............e...',
  '............VE..',
  '............VSE.',
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
]
// 掲げる。握りをこめかみまで上げて竿を真上へ立てる。結果の窓が出ている間はこのコマのまま
const downHoistRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '.............VE.',
  '.............VS.',
  '..............E.',
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
  '................',
  '................',
  '................',
]

// ---- 背面 ----
// 竿は待機コマ(upRod)と同じ画面の右の手。背中越しなので上げた腕は頭の右脇に袖(M)として見え、
// そのぶん腰に下ろしていた手(19・20 行の 13 列)を消す。ランタンを提げる左腕(画面の左)は触らない

// 水へ乗り出すと頭が上がり、頭と襟の間に襟足が覗く
const upNeck = partAt({ 16: '.....xKKKKx.....' })
// 大きく乗り出して 2 行上がったとき。2 行とも首にすると首が伸びて見えるので、下の 1 行は背中の襟にする
const upStretch = partAt({ 15: '.....xKKKKx.....', 16: '....xQQQQQQx....' })
// 反ると頭が手前へ来て肩に沈む。沈めた後ろ髪の裾(16 行)の左端はランタンの笠(16 行 0〜3 列)に
// 掛かるので、左右とも 1 列ずつ細くして裾の形を揃える
const upSink = partAt({ 16: '...-x......x-...' })
// 腕を上げたら腰の手を消す
const upArmUp = partAt({ 19: '.............--.', 20: '.............--.' })

// 振りかぶりの準備。腕を上げて竿を頭の右脇に立てる
const upWindupRod: PixelArt = [
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
  '.............VE.',
  '.............Mx.',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 振りかぶり。手を頭の高さまで上げ、竿は頭の上を越えて手前へしなる。浮き(R)が左に揺れる
const upBackswingRod: PixelArt = [
  '................',
  '....eeeee.......',
  '..ee.....ee.....',
  '.e.........e....',
  '.h..........e...',
  '.h...........e..',
  '.h...........e..',
  'xRx..........e..',
  '.x...........VE.',
  '.............VS.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 投げ。竿は頭の上を斜めに渡って奥へ振られ、先で糸(h)が伸びる
const upCastRod: PixelArt = [
  '.hhh............',
  'h...e...........',
  '.....e..........',
  '......e.........',
  '.......e........',
  '........e.......',
  '.........e......',
  '..........e.....',
  '...........e....',
  '............e...',
  '.............VE.',
  '.............VS.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 振り抜き。竿を奥へ倒したまま手を下ろし、体は水の方へ伸び切る
const upFollowRod: PixelArt = [
  '...........e....',
  '...........e....',
  '............e...',
  '............e...',
  '............e...',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............VE.',
  '.............VS.',
  '.............Mx.',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 当たりで身構える。手は腰の高さのままで、竿の中ほどを 1 列内へたわませる。
// 穂先(0 行 15 列)は待機コマと同じ所に残す — 浮きへの糸はここから斜めに上がっていく
const upTenseRod: PixelArt = [
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
  '...............e',
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
  '.............Se.',
  '.............VE.',
  '..............E.',
  '..............E.',
  '................',
  '................',
  '................',
]
// 引き込まれる。体が水の方へ持っていかれる一方で、手は腰の下まで引き戻し、竿は穂先を残して大きく曲がる
const upBiteRod: PixelArt = [
  '...............e',
  '...............e',
  '...............e',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '............SE..',
  '............VE..',
  '.............VE.',
  '................',
  '................',
  '................',
]
// 釣り上げ。反りながら竿を頭越しに斜めへ起こす
const upPullRod: PixelArt = [
  '................',
  '................',
  '.e..............',
  '..e.............',
  '...e............',
  '....e...........',
  '.....e..........',
  '......e.........',
  '.......e........',
  '........e.......',
  '.........e......',
  '..........e.....',
  '...........e....',
  '............e...',
  '.............VE.',
  '.............VSE',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 掲げる。腕を頭の高さまで上げて竿を真上へ立てる
const upHoistRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '.............VE.',
  '.............VS.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '.............Mx.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

// ---- 横向き ----
// 竿を握る手は待機コマ(rightRod)と同じく顔の前に浮かせ、腰に下ろした手前の腕はそのまま残す。
// 上げた腕を描くと二頭身では袖が顔を横切り、目鼻が読めなくなった(描いて試した)。
// 顔の前下はランタンの席(16 行 13・14 列、17 行 11〜14 列、18〜21 行 12〜14 列)なので、
// うつむいて頭を下げるときは顎を引いてその席を空ける。左向きは反転で作るので 0 列目と 15 列目は使わない

const rightNeck = partAt({ 16: '......xKKx......' })
// 頭を 1 行下げると顎の先と頬がランタンの吊り手と笠に掛かる。その分を削り、顎を引いた形に閉じる
const rightChinTuck = partAt({ 16: '............x--.', 17: '..........x--...' })
// 2 行下げたとき。削る範囲が一段広がり、顔を伏せた形になる(夜はちょうどランタンの陰に入る)
const rightChinTuckDeep = partAt({
  16: '.............--.',
  17: '..........x----.',
  18: '...........x-...',
})

// 振りかぶりの準備。手を顔の前まで上げ、竿を後ろへ倒し始める
const rightWindupRod: PixelArt = [
  '........e.......',
  '........e.......',
  '.........e......',
  '.........e......',
  '..........e.....',
  '..........e.....',
  '...........e....',
  '...........e....',
  '............e...',
  '............e...',
  '............VE..',
  '............VS..',
  '.............E..',
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
]
// 振りかぶり。手を帽子のつばより上へ上げ、竿は頭の上を越えて背中側へしなる。浮き(R)が後ろに揺れる
const rightBackswingRod: PixelArt = [
  '....eeeee.......',
  '...e.....ee.....',
  '..h........e....',
  '..h.........VE..',
  '..h.........VS..',
  '..R..........E..',
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
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 投げ。竿を前へ振り戻して真上に立て、糸(h)は頭の上を後ろから追ってくる
const rightCastRod: PixelArt = [
  '..hhhhh......e..',
  '.h.....hh....e..',
  '.h.......h...e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '............VE..',
  '............VS..',
  '.............E..',
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
  '................',
  '................',
  '................',
]
// 振り抜き。手を口元まで下ろし、竿は穂先を前(右)へ傾ける。前へは 14 列までしか出せない
const rightFollowRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '............e...',
  '............e...',
  '............e...',
  '............e...',
  '...........e....',
  '...........VE...',
  '...........VS...',
  '............E...',
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
// 当たりで身構える。穂先の 2 ドット(0・1 行の 14 列)は待機コマと同じに残し、その下を 1 列引いてたわませる。
// 1 行目の竿は糸の頭の 1 ドットを隠す役も持っている(fishing-art.ts の fishingLineRight)
const rightTenseRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '..............e.',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............VE.',
  '.............VS.',
  '............E...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 引き込まれる。顔を伏せて握りを顎の下まで引き寄せ、竿は穂先を残して弓なりに曲がる
const rightBiteRod: PixelArt = [
  '..............e.',
  '..............e.',
  '..............e.',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '............e...',
  '............e...',
  '............e...',
  '...........e....',
  '...........e....',
  '...........e....',
  '...........e....',
  '..........e.....',
  '..........e.....',
  '.........VE.....',
  '........VS......',
  '.......E........',
  '................',
  '................',
  '................',
  '................',
  '................',
]
// 釣り上げ。反りながら竿を後ろへ斜めに起こす
const rightPullRod: PixelArt = [
  '................',
  '...e............',
  '....e...........',
  '.....e..........',
  '......e.........',
  '.......e........',
  '........e.......',
  '.........e......',
  '..........e.....',
  '...........e....',
  '............VE..',
  '............VSE.',
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
]
// 掲げる。手を帽子の前まで上げて竿を真上へ立てる
const rightHoistRod: PixelArt = [
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '.............e..',
  '............VE..',
  '............VS..',
  '.............E..',
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
  '................',
  '................',
  '................',
  '................',
]

// ---- 画布 ----
// ここまでの絵はどれも16×24の体の上で組み、最後にcompose-player.tsのtoFrameで32×32の画布の下辺中央へ置く

// 素の立ち・歩きのコマ(16×24)
const upFrames: Triple = [
  stand(upBody, upFeet),
  walk(upBody, '...xAAx..xZx....'),
  alternateFoot(walk(upBody, '...xAAx..xZx....')),
]
const downFrames: Triple = [
  stand(downBody, downFeet),
  walk(downBody, '...xAAx..xZx....'),
  alternateFoot(walk(downBody, '...xAAx..xZx....')),
]
const rightFrames: [PixelArt, PixelArt] = [
  stand(rightBody, rightFeet),
  walk(rightBody, '....xAAx.xAAx...'),
]

// ここから下は雨の外で差す傘。差して立つ・歩くコマは、利用者から受け取った原画を写したumbrella-original.tsを
// そのまま使い、ここでは1ドットも手を入れない(ADR 0008。写し方はumbrella-original.tsの見出し)。
// 原画は正面・背面・右向き・左向きの4行を持ち、左向きの行は右向きの行を反転した絵と1ドットずつは一致しないので、
// 傘を差したコマだけは左向きを右向きの反転で作らず、原画の左向きの行を使う(sprites-art.test.tsが食い違いを数えている)。
// 夜は服と同じくphasePaletteで沈み、灯るのは重ねたランタンだけになる(夜専用の絵は無い)。
//
// ここで組むのは、原画に無い傘を出す・しまう途中のコマ(下の見出し)と、夜に重ねるランタンの位置だけ。
// 原画の立ち姿は、正面は画面の右の手・背面は画面の左の手・横向きは前の手で柄を頭の横に立て、反対の手に灯りを提げる

// ここから下の天蓋・畳んだ傘は、原画より前に実装が描いたもの。原画に無い出す・しまう途中のコマにだけ使う
// 開ききる手前・閉じ始め(幅21)
const canopyWide: PixelArt = [
  '..........^..........',
  '........xx^xx........',
  '.....xxx==][[xxx.....',
  '...xx[=[==][[]]]xx...',
  '.xx[[=[===][[[]]]]xx.',
  'x[[[=[====][[[[]]]]]x',
  'x[[[[[[===][[[[]]]]]x',
  'x]xx]][xx[]]xx]]]xx]x',
  '~x..x~x..x~x..x~x..x~',
]
// 半開き(幅11)。骨が立って細い釣鐘になる
const canopyNarrow: PixelArt = [
  '.....^.....',
  '....x^x....',
  '....x=]x...',
  '...x=][]x..',
  '...x=][]x..',
  '..x[=][[]x.',
  '..x[=][[]x.',
  '.x[[=][[]]x',
  '.x]x]x]x]]x',
  '.~.~.~.~.~.',
]
// 畳んで柄に沿って立てた傘。柄の傾きに合わせ、正面は上が右へ、背面は上が左へ寄る
const foldedFront: PixelArt = [
  '....^.',
  '...x^x',
  '..x=]x',
  '..x=]x',
  '.x=]]x',
  '.x=]]x',
  'x[=]]x',
  'x[=]]x',
  'x~~~x.',
]
const foldedBack: PixelArt = [
  '.^....',
  'x^x...',
  'x=]x..',
  'x=]x..',
  'x=]]x.',
  'x=]]x.',
  'x[=]]x',
  'x[=]]x',
  '.x~~~x',
]

// ---- 傘を出す・しまう途中のコマ。原画に無いので実装が描いたコマ ----
// 原画の立ち姿へそのままつながるよう、柄を扱う手は原画と同じ側(正面は画面の右、背面は画面の左)にそろえる。
//  - 手を懐へ入れる・傘を引き出す(正面)と、柄を縮める・懐へしまう(背面)は、原画より前に描いた素の体のコマを
//    左右に反転しただけのもの。傘が原画と同じ側の手へ移り、ドットは描き足していない
//  - 柄を伸ばす・半開き・開ききる手前(正面)と、下ろす・すぼめる・閉じる(背面)は、原画の立ち姿から天蓋を外して、
//    上の畳んだ傘・細い釣鐘・開ききる手前の天蓋に替えたもの。体・握った手・柄は原画の立ち姿のまま(13行目から下は同じ)。
//    描き足したのは、天蓋が隠していた帽子の天辺を閉じる輪郭1行と、替えた天蓋の縁から原画の柄の上端までの柄だけ
// 天蓋の差し替え(swapCanopy)と素の体の反転(mirrorFront・mirrorBack)は compose-player.ts

// 原画の立ち姿の柄は、正面が23列・背面が8列を縦に上る
const frontSwap: Swap = { capTop: '...........xxxxxxxxxx...........', shaft: 23 }
const backSwap: Swap = { capTop: '...........xxxxxxxxxxx..........', shaft: 8 }

// ---- 傘を出して開く(正面) ----
// 上着の内へ手を入れる
const umbrellaDownReach: PixelArt = [
  '................',
  '................',
  '................',
  '................',
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
  '.xQMMVKxYxMKQx..',
  '..xMxqxBxBxqKx..',
  '..xMxqYxBxBxVx..',
  '..xxzxzzxxBxx...',
  '...xAAxxzzZx....',
  '....xx..xxx.....',
]
// 短く畳んだ傘を取り出し、脇で斜めに下げる
const umbrellaDownDraw: PixelArt = [
  '................',
  '................',
  '................',
  '................',
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
  '.x=xxxBxYxMKQx..',
  'x=]VxqxBxBxqKx..',
  'x=]xxqYxBxBxVx..',
  'x=]xzxzzxxBxx...',
  '^x.xAAxxzzZx....',
  '....xx..xxx.....',
]

// 柄を伸ばし、畳んだまま頭の横に立てる。ここから差して立つコマまで、手と柄は原画の立ち姿と同じ所に留まる。
// 天蓋は開くにつれて石突きを柄の真上(23列)から原画の天蓋の石突き(16列)へ寄せていく
// (原画の柄は天蓋のまん中ではなく右寄りへ入っている)
const umbrellaDownExtend = swapCanopy(
  umbrellaDownOriginal[0],
  frontSwap,
  coverAt(foldedFront, 23, 4)
)
// 骨が立ち、細い釣鐘の形に半分開く
const umbrellaDownHalf = swapCanopy(
  umbrellaDownOriginal[0],
  frontSwap,
  coverAt(canopyNarrow, 21, 1)
)
// 開ききる手前。この次が差して立つコマ(原画の正面の立ち)
const umbrellaDownRaise = swapCanopy(umbrellaDownOriginal[0], frontSwap, coverAt(canopyWide, 18, 2))

// ---- 傘を閉じてしまう(背面) ----
// 差して立つコマ(原画の背面の立ち)から、天蓋を開いたときの逆の順にすぼめる。手と柄は原画の立ち姿のまま
const umbrellaUpLower = swapCanopy(umbrellaUpOriginal[0], backSwap, coverAt(canopyWide, 13, 2))
const umbrellaUpHalf = swapCanopy(umbrellaUpOriginal[0], backSwap, coverAt(canopyNarrow, 10, 1))
// 布を畳みきり、柄に沿って立てる。次のコマで柄を縮めて手元へ下ろす
const umbrellaUpClosed = swapCanopy(umbrellaUpOriginal[0], backSwap, coverAt(foldedBack, 8, 4))

// 柄を縮めて短くし、手元へ引き寄せる
const umbrellaUpCompact: PixelArt = [
  '................',
  '................',
  '................',
  '................',
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
  '.xKxMMxBjMMMxVx.',
  '.xKxMMMxBjBBx=]x',
  '...xQQQxBBBBx=]x',
  '...xZZx..xZZx.x^',
  '...xAAx..xAAx...',
]
// 上着の内へ押し込む。背中越しに懐は見えないので、手の下に紺の先と石突きだけが覗く。
// この後は傘を持たない up の静止コマへ戻る
const umbrellaUpStow: PixelArt = [
  '................',
  '................',
  '................',
  '................',
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
  '.xKxMMxBjMMMxVx.',
  '.xKxMMMxBjBBx]x.',
  '...xQQQxBBBBx^..',
  '...xZZx..xZZx...',
  '...xAAx..xAAx...',
]

export const playerArt: PlayerFrames = {
  flyDown: [flightArt['player-fly-down-0'], flightArt['player-fly-down-1']],
  flyUp: [flightArt['player-fly-up-0'], flightArt['player-fly-up-1']],
  flyRight: [flightArt['player-fly-right-0'], flightArt['player-fly-right-1']],
  up: framed3(upFrames),
  down: framed3(downFrames),
  right: framed2(rightFrames),
  fish: framed3([
    overlayRod(stand(upBody, upFeet), upRod),
    overlayRod(stand(downBody, downFeet), downRod),
    overlayRod(stand(rightBody, rightFeet), rightRod),
  ]),
  // 第 1 引数が頭の上下(負で上)。反る(windup・backswing・pull・hoist)と乗り出す(cast・follow・tense・bite)で
  // 正面・横向きと背面の符号が逆になるのは、背面だけ水が画面の奥(上)にあるため
  windup: framed3([
    pose(upStand, 1, upSink, upArmUp, upWindupRod),
    pose(downStand, -1, downNeck, downWindupRod),
    pose(rightStand, -1, rightNeck, rightWindupRod),
  ]),
  backswing: framed3([
    pose(upStand, 1, upSink, upArmUp, upBackswingRod),
    pose(downStand, -1, downNeck, downFreeArmUp, downBackswingRod),
    pose(rightStand, -1, rightNeck, rightBackswingRod),
  ]),
  cast: framed3([
    pose(upStand, -1, upNeck, upArmUp, upCastRod),
    pose(downStand, 1, downCastRod),
    pose(rightStand, 1, rightChinTuck, rightCastRod),
  ]),
  // 振り抜きがいちばん深く倒れるコマ。次の待機コマで体が起き上がる
  follow: framed3([
    pose(upStand, -2, upStretch, upArmUp, upFollowRod),
    pose(downStand, 2, downCheekClear, downFollowRod),
    pose(rightStand, 2, rightChinTuckDeep, rightFollowRod),
  ]),
  tense: framed3([
    pose(upStand, -1, upNeck, upTenseRod),
    pose(downStand, 1, downTenseRod),
    pose(rightStand, 1, rightChinTuck, rightTenseRod),
  ]),
  bite: framed3([
    pose(upStand, -2, upStretch, upBiteRod),
    pose(downStand, 2, downCheekClear, downBiteRod),
    pose(rightStand, 2, rightChinTuckDeep, rightBiteRod),
  ]),
  pull: framed3([
    pose(upStand, 1, upSink, upArmUp, upPullRod),
    pose(downStand, -1, downNeck, downPullRod),
    pose(rightStand, -1, rightNeck, rightPullRod),
  ]),
  hoist: framed3([
    pose(upStand, 1, upSink, upArmUp, upHoistRod),
    pose(downStand, -1, downNeck, downFreeArmUp, downHoistRod),
    pose(rightStand, -1, rightNeck, rightHoistRod),
  ]),
  // 傘を差して立つ・歩くコマは原画を写したまま(umbrella-original.ts)
  umbrellaUp: umbrellaUpOriginal,
  umbrellaDown: umbrellaDownOriginal,
  umbrellaRight: umbrellaRightOriginal,
  umbrellaLeft: umbrellaLeftOriginal,
  // 出す・しまう途中のコマは原画に無いので実装が描いたもの(上の見出し)
  umbrellaOpen: {
    reach: toFrame(mirrorFront(umbrellaDownReach)),
    draw: toFrame(mirrorFront(umbrellaDownDraw)),
    extend: umbrellaDownExtend,
    half: umbrellaDownHalf,
    raise: umbrellaDownRaise,
  },
  umbrellaClose: {
    lower: umbrellaUpLower,
    half: umbrellaUpHalf,
    closed: umbrellaUpClosed,
    compact: toFrame(mirrorBack(umbrellaUpCompact)),
    stow: toFrame(mirrorBack(umbrellaUpStow)),
  },
}

// ここから下は夜だけ使う差分。昼のコマへ灯りを重ねるだけなので、体と服のドットは昼と 1 ドットも変わらない。
// ランタンの絵そのものは lantern.ts が正本で、ロボット(structures.ts)も同じ 1 枚を提げる。
// 向きごとに違うのは「その向きで体のどちら側が空いているか」だけなので、
// ここでは面を選んで重ねる位置を決めるところまでしかしない(重ね方は compose-player.ts の standLit・walkLit・hangLantern)

// 傘を差したコマのランタン。原画はランタンを提げた姿で描かれていて、写すときにそのランタンは抜いたので、
// 抜いた所(原画のガラスがあった所)へlantern.tsの面を重ね直す。原画の灯りは柄を持たない方の手にあり、
// 正面は画面の左、背面と左向きは画面の右、右向きは背中側(画面の左)に提がる。
// 面は原画のランタンの見え方に近いものを選び(正面はfrontLantern、ほかは笠が張り出すsideLantern)、
// 体の側に柱が来るよう必要なら左右を反転する。dxは面を体の箱から右へずらす列数、topは面の最上行の画布の行。
// 灯りを体のドットへ重ねる位置は取れない(overlayLanternが落とす)ので、原画のガラスの中心にいちばん近い、
// 体に掛からない位置を選んだ(ずれは縦横とも2升以内)。原画のランタンはコマごとに少しずつ動くので、コマごとに持つ
// 原画の正面の立ち・歩き(1行目の3・2・5コマ目)は灯りを描いていないコマなので、
// 同じ行で灯りを提げている6コマ目のガラスの位置(画布の8列・25〜26行)に合わせた
const umbrellaHangs = {
  down: [
    { face: frontLantern, mirrored: true, dx: -1, top: 23 },
    { face: frontLantern, mirrored: true, dx: -1, top: 23 },
    { face: frontLantern, mirrored: true, dx: -2, top: 23 },
  ],
  up: [
    { face: sideLantern, mirrored: false, dx: 1, top: 21 },
    { face: sideLantern, mirrored: false, dx: 1, top: 23 },
    { face: sideLantern, mirrored: false, dx: 2, top: 22 },
  ],
  right: [
    { face: sideLantern, mirrored: true, dx: -1, top: 22 },
    { face: sideLantern, mirrored: true, dx: -2, top: 22 },
  ],
  left: [
    { face: sideLantern, mirrored: false, dx: 1, top: 22 },
    { face: sideLantern, mirrored: false, dx: 2, top: 21 },
  ],
} satisfies Record<'down' | 'up' | 'right' | 'left', Hang[]>
// 反転した素の体のコマ(手を懐へ入れる・引き出す・縮める・しまう)は、反転前と同じ面を同じ高さで、
// 体と一緒に反転した位置へ提げる。正面の体は0〜14列を反転したので、16列の面の反転からさらに1列左へずらす
const mirroredFrontHang: Hang = {
  face: frontLantern,
  mirrored: true,
  dx: -1,
  top: STAND_LANTERN_TOP,
}
const mirroredBackHang: Hang = { face: backLantern, mirrored: true, dx: 0, top: STAND_LANTERN_TOP }

// 夜のコマ。コマ数も並びも playerArt と同じで、違いは灯りのドットだけ
export const playerNightArt: PlayerFrames = {
  // 膝に置いた手の周りは雲で埋まっていて灯りを提げる隙間が無いので、手の外側にある雲の膨らみの上に受け皿を載せる。
  // 立ち姿と同じ側(正面は画面の右、背面は画面の左)、横向きは顔の前の膨らみ。顔と黒い輪郭には重ねず、頭とは1列空ける。
  // 受け皿は雲の上の輪郭のすぐ上に置くので、膨らみの高さが違うコマ(背面と横向きの1)は灯りも同じ列のまま2行下がる。
  // 横向きも笠が細い正面の面を使う — 横向きの面は笠が4列あり、顔の前に置くと顎の輪郭に接してしまう
  flyDown: [
    hangLantern(playerArt.flyDown[0], { face: frontLantern, mirrored: false, dx: 3, top: 10 }),
    hangLantern(playerArt.flyDown[1], { face: frontLantern, mirrored: false, dx: 3, top: 10 }),
  ],
  flyUp: [
    hangLantern(playerArt.flyUp[0], { face: frontLantern, mirrored: true, dx: -4, top: 10 }),
    hangLantern(playerArt.flyUp[1], { face: frontLantern, mirrored: true, dx: -4, top: 12 }),
  ],
  flyRight: [
    hangLantern(playerArt.flyRight[0], { face: frontLantern, mirrored: false, dx: 6, top: 12 }),
    hangLantern(playerArt.flyRight[1], { face: frontLantern, mirrored: false, dx: 6, top: 14 }),
  ],
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
  // 釣りのコマも静止コマと同じ高さにランタンを提げる。竿や動かした頭・腕がランタンの席へ入っていれば
  // overlayLantern がここで落ちるので、夜のコマを焼く前に気付ける
  fish: litFishing(playerArt.fish),
  windup: litFishing(playerArt.windup),
  backswing: litFishing(playerArt.backswing),
  cast: litFishing(playerArt.cast),
  follow: litFishing(playerArt.follow),
  tense: litFishing(playerArt.tense),
  bite: litFishing(playerArt.bite),
  pull: litFishing(playerArt.pull),
  hoist: litFishing(playerArt.hoist),
  // 傘のコマも昼の絵へ灯りを重ねるだけ。差して立つ・歩くコマは原画のランタンの位置(umbrellaHangs)、
  // 天蓋を替えた出す・しまう途中のコマはその元の立ち姿と同じ位置、反転した素の体のコマは体と一緒に反転した位置に提げる。
  // 傘や手がランタンの席へ入っていれば、釣りと同じく overlayLantern がここで落ちる
  umbrellaUp: [
    hangLantern(playerArt.umbrellaUp[0], umbrellaHangs.up[0]),
    hangLantern(playerArt.umbrellaUp[1], umbrellaHangs.up[1]),
    hangLantern(playerArt.umbrellaUp[2], umbrellaHangs.up[2]),
  ],
  umbrellaDown: [
    hangLantern(playerArt.umbrellaDown[0], umbrellaHangs.down[0]),
    hangLantern(playerArt.umbrellaDown[1], umbrellaHangs.down[1]),
    hangLantern(playerArt.umbrellaDown[2], umbrellaHangs.down[2]),
  ],
  umbrellaRight: [
    hangLantern(playerArt.umbrellaRight[0], umbrellaHangs.right[0]),
    hangLantern(playerArt.umbrellaRight[1], umbrellaHangs.right[1]),
  ],
  umbrellaLeft: [
    hangLantern(playerArt.umbrellaLeft[0], umbrellaHangs.left[0]),
    hangLantern(playerArt.umbrellaLeft[1], umbrellaHangs.left[1]),
  ],
  umbrellaOpen: {
    reach: hangLantern(playerArt.umbrellaOpen.reach, mirroredFrontHang),
    draw: hangLantern(playerArt.umbrellaOpen.draw, mirroredFrontHang),
    extend: hangLantern(playerArt.umbrellaOpen.extend, umbrellaHangs.down[0]),
    half: hangLantern(playerArt.umbrellaOpen.half, umbrellaHangs.down[0]),
    raise: hangLantern(playerArt.umbrellaOpen.raise, umbrellaHangs.down[0]),
  },
  umbrellaClose: {
    lower: hangLantern(playerArt.umbrellaClose.lower, umbrellaHangs.up[0]),
    half: hangLantern(playerArt.umbrellaClose.half, umbrellaHangs.up[0]),
    closed: hangLantern(playerArt.umbrellaClose.closed, umbrellaHangs.up[0]),
    compact: hangLantern(playerArt.umbrellaClose.compact, mirroredBackHang),
    stow: hangLantern(playerArt.umbrellaClose.stow, mirroredBackHang),
  },
}
