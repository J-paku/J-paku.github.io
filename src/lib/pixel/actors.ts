// 主人公: 深緑のキャップにゴーグル、茶髪、緑のジャケットと斜め掛けの革ストラップ(参照画像を 15×20 で写した二頭身)
// タイルは幅 16・高さ 24。足元をマスの下辺に揃え、頭はマスの上へ半マス(8 行)はみ出す。
// 静止コマは 4〜23 行、歩行コマは全体が一段下がって 5〜23 行に収まり、最下行だけ脚を振る
// シートへ焼くときはこの体を32×32の画布へ置き、余白へ描くのは傘を差したコマだけ(下のPLAYER_BODY_*と傘の見出し)
// 輪郭は x(#181818)で描き、白い縁取りは scene.module.css の drop-shadow が付ける
import { TILE } from './art'
import type { PixelArt } from './art'
import { backLantern, frontLantern, LANTERN_BODY_TOP, overlayLantern, sideLantern } from './lantern'

export const PLAYER_HEIGHT = 24

// シートの1コマは32×32の画布。16×24の体を左右8列・上8行の余白の下辺中央へ置き、足元は画布の下辺のまま。
// 余白へ描くのは傘を差したコマだけで、傘の無いコマは余白を空けたまま、体のドットも立つ位置も16×24の頃と変わらない。
// 画面ではscene.module.cssの.playerが体の箱(1×1.5マス)のまま立ち、::beforeがこの画布を左右と上へ半マスずつはみ出させて描く
export const PLAYER_BODY_LEFT = 8
export const PLAYER_BODY_TOP = 8
export const PLAYER_FRAME_WIDTH = TILE + PLAYER_BODY_LEFT * 2
export const PLAYER_FRAME_HEIGHT = PLAYER_HEIGHT + PLAYER_BODY_TOP

// 釣りの 1 場面ぶんのコマ。並びは上・下・右(左は右の反転)
type FishingFrames = [PixelArt, PixelArt, PixelArt]

type PlayerFrames = {
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
  // 雨の外で傘を差したコマ。並びは up・down・right と同じ(静止・歩行 1・歩行 2、横向きは静止・歩行)
  umbrellaUp: [PixelArt, PixelArt, PixelArt]
  umbrellaDown: [PixelArt, PixelArt, PixelArt]
  umbrellaRight: [PixelArt, PixelArt]
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

// 頭はコマの 4 行目から 13 行(3 面とも体の 0〜12 行)。その下の 5 行が胴と脚
const HEAD_TOP = 4
const HEAD_ROWS = 13

// 頭だけを dy 行ずらす(負で上)。首から下は元の位置に残す。
// 下げた頭は襟や肩の手前に重ね(うつむくと顎が襟に埋まる)、上げた頭の下に空く行は首の型紙で埋める
const moveHead = (art: PixelArt, dy: number): PixelArt =>
  art.map((row, y) => {
    const below = y >= HEAD_TOP && y < HEAD_TOP + HEAD_ROWS ? BLANK : row
    const from = y - dy
    if (from < HEAD_TOP || from >= HEAD_TOP + HEAD_ROWS) return below
    return [...below].map((ch, x) => (art[from][x] === '.' ? ch : art[from][x])).join('')
  })

// 型紙で「そこを透明へ戻す」印。竿は塗り重ねるだけで済むが、体を動かすと元の場所に残る物を
// 消す必要がある(腰に下ろしていた手、ランタンの席へはみ出す顎や頬)。
// パレットに無い文字なので、overlayRod で重ねるなどして絵に残れば validateArt が落とす
const ERASE = '-'

// overlayRod と同じく '.' は元の絵を残し、ERASE は透明にし、それ以外は塗り替える
const overlayPose = (art: PixelArt, patch: PixelArt): PixelArt =>
  art.map((row, y) =>
    [...row]
      .map((ch, x) => (patch[y][x] === '.' ? ch : patch[y][x] === ERASE ? '.' : patch[y][x]))
      .join('')
  )

// 数行しか描かない部品(首・顎・腕)の型紙。行番号 → 行 の表を 24 行へ広げ、残りは元の絵を残す
const partAt = (rows: Partial<Record<number, string>>): PixelArt =>
  Array.from({ length: PLAYER_HEIGHT }, (_, y) => rows[y] ?? BLANK)

// 釣りの 1 コマ。静止コマの頭を dy 行ずらし、体の部品と竿の型紙をこの順に重ねる
const pose = (base: PixelArt, dy: number, ...patches: PixelArt[]): PixelArt =>
  patches.reduce(overlayPose, moveHead(base, dy))

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

const downPose = (dy: number, ...patches: PixelArt[]): PixelArt =>
  pose(stand(downBody, downFeet), dy, ...patches)

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

const upPose = (dy: number, ...patches: PixelArt[]): PixelArt =>
  pose(stand(upBody, upFeet), dy, ...patches)

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

const rightPose = (dy: number, ...patches: PixelArt[]): PixelArt =>
  pose(stand(rightBody, rightFeet), dy, ...patches)

// ---- 画布 ----
// シートへ焼く1コマは32×32の画布(PLAYER_FRAME_*)。ここまでの絵はどれも16×24の体の上で組み、
// 最後にtoFrameで画布の下辺中央へ置く。傘の無いコマは余白を空けたままなので、体のドットも立つ位置も変わらない
const FRAME_BLANK = '.'.repeat(PLAYER_FRAME_WIDTH)
const SIDE_PAD = '.'.repeat(PLAYER_BODY_LEFT)
const toFrame = (art: PixelArt): PixelArt => [
  ...Array.from({ length: PLAYER_BODY_TOP }, () => FRAME_BLANK),
  ...art.map(row => SIDE_PAD + row + SIDE_PAD),
]
type Triple = [PixelArt, PixelArt, PixelArt]
const framed3 = ([a, b, c]: Triple): Triple => [toFrame(a), toFrame(b), toFrame(c)]
const framed2 = ([a, b]: [PixelArt, PixelArt]): [PixelArt, PixelArt] => [toFrame(a), toFrame(b)]

// 素の立ち・歩きのコマ(16×24)。傘を差したコマも同じ体から組む
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

// ここから下は雨の外で差す傘。利用者の指示で描き直した(前の傘は参照画像を16×24へ写したもので、
// 頭に貼り付いた兜に見え、柄も手も見えなかった)。色は前の傘のまま、紺の布([)・陰と骨(])・光(=)、
// 縁の白い房(~)、木の石突きと柄(^)の5文字だけで描き、灯り用・段階で色を変えない文字は使わない。
// 夜は服と同じくphasePaletteで沈み、灯るのは重ねたランタンだけになる(夜専用の絵は無い)。
//
// 傘は体の箱に収まらないので、画布の余白へ描く。
//  - 開いた天蓋は幅25(正面の頭の幅15の約1.7倍)。石突きから骨が縁の5つの先へ下り、先ごとに白い房が付く。
//    左上から光が当たる向きで、左の面を明るく、右の面を陰にする。天蓋の縁と帽子の間は2行空け、そこに柄が見える
//  - 柄を握るのは右手だけ。左手は夜にランタンを提げる手なので、ランタンの席(正面は右下、背面は左下、
//    横向きは前下)へは腕も柄も入れない。握らない方の手は素のコマのまま下ろしておく
//  - 正面と背面は、拳を肩の高さで頭の外へ出し、柄を4行ごとに1列ずつ頭の側へ傾けて天蓋の石突きへ向ける。
//    柄は頭の輪郭の外側に沿って上り、顔の上を横切らない。天蓋はそのぶん握る手の側へ寄る
//  - 横向きは胸の前で柄を握る。前へ突き出す拳の席は夜のランタンが塞いでいるため。
//    柄は頭の後ろへ隠れ、拳と顎の間と、帽子と天蓋の間にだけ見える
// どのコマも、素の体を画布へ置き、腕の型紙→天蓋→柄の順に重ねて組む。天蓋と柄は体の後ろへ回り
// (元の絵が透明な升にだけ描く)、頭や顔のドットは1つも塗り替えない。
// 歩くコマは体と一緒に腕・天蓋・柄も1行下げるので、歩くと傘が1ドット揺れ、拳は柄から離れない
const UMBRELLA_WOOD = '^'

// 開いた天蓋(幅25・高さ10)。最上行が石突き、1〜7行が布、8行が縁の波(骨の先が下へ尖る)、9行が房
const canopyOpen: PixelArt = [
  '............^............',
  '..........xx^xx..........',
  '.......xxx==][[xxx.......',
  '.....xx[=[==][[]]]xx.....',
  '...xx[[=[===][[[]]]]xx...',
  '..x[[[=[====][[[[]]]]]x..',
  '.x[[[=[=====][[[[[]]]]]x.',
  'x[[[[[[[====][[[[[]]]]]]x',
  'x]xxx]][xxx[]]xxx]]]xxx]x',
  '~x...x~x...x~x...x~x...x~',
]
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

// 型紙の(x, y)の文字。型紙の外は'.'(元の絵を残す)として読む
const cellOf = (patch: PixelArt, x: number, y: number): string =>
  y >= 0 && y < patch.length && x >= 0 && x < patch[y].length ? patch[y][x] : '.'
// 画布の(left, top)から型紙を重ねる。'.'は元の絵を残し、ERASEは透明へ戻し、それ以外は塗る
const paintAt = (art: PixelArt, patch: PixelArt, left: number, top: number): PixelArt =>
  art.map((row, y) =>
    [...row]
      .map((ch, x) => {
        const cell = cellOf(patch, x - left, y - top)
        if (cell === '.') return ch
        return cell === ERASE ? '.' : cell
      })
      .join('')
  )
// 元の絵が透明な升にだけ描く。体の後ろへ回る天蓋と柄に使う
const paintBehind = (art: PixelArt, patch: PixelArt, left: number, top: number): PixelArt =>
  art.map((row, y) =>
    [...row].map((ch, x) => (ch === '.' ? cellOf(patch, x - left, y - top) : ch)).join('')
  )

// 天蓋の縁の直下の行。柄はここから拳まで描き、ここより上は天蓋が隠す
const SHAFT_TOP = 9
// 柄の1本の線。SHAFT_TOP〜to行の各行でat(y)列に木の色を置いた画布
const shaftLine = (at: (y: number) => number, to: number): PixelArt =>
  Array.from({ length: PLAYER_FRAME_HEIGHT }, (_, y) =>
    y < SHAFT_TOP || y > to
      ? FRAME_BLANK
      : FRAME_BLANK.slice(0, at(y)) + UMBRELLA_WOOD + FRAME_BLANK.slice(at(y) + 1)
  )

type Grip = {
  // 天蓋の縁の下から拳までの柄
  shaft: PixelArt
  // 柄を握る腕・拳と、拳の下へ出る柄の端(正面と背面は鉤に曲げる)。画布のarmTop行目から重ねる
  arm: PixelArt
  armTop: number
}
// 置く天蓋。left・topは画布の列・行
type Cover = { art: PixelArt; left: number; top: number }
// 天蓋の石突き(最上行の^)を画布のcolumn列へ合わせて置く
const coverAt = (art: PixelArt, column: number, top = 0): Cover => ({
  art,
  left: column - art[0].indexOf(UMBRELLA_WOOD),
  top,
})

// 正面。右手(画面の左)を肩の高さで頭の外へ出し、拳(24・25行の5・6列)で柄を握る。
// 柄は拳から4行ごとに1列ずつ右へ寄り、頭の輪郭の1列外を上って天蓋の石突き(12列)の下へ入る。
// 腰へ下ろしていた手と腕は消し、胴の左の輪郭を閉じる。拳の下の柄は左へ曲がって鉤になる
const frontGrip: Grip = {
  shaft: shaftLine(y => 6 + Math.floor((25 - y) / 4), 25),
  armTop: 23,
  arm: [
    '.....x.x........................',
    '....xVVxxx......................',
    '....xVVKQQq.....................',
    '.....x^xxxxQ....................',
    '....^.^..-xQ....................',
    '.....^...-xQ....................',
  ],
}
// 背面。正面と同じ形の握りで、右手は画面の右へ出る。拳は24・25行の25・26列で、柄は4行ごとに1列ずつ左へ寄る。
// 背面の頭は正面より左右へ1列ずつ広いので、そのぶん正面より外で握る。石突きは画布の右端に天蓋が収まる19列
const backGrip: Grip = {
  shaft: shaftLine(y => 26 - Math.floor((25 - y) / 4), 25),
  armTop: 23,
  arm: [
    '.........................x.x....',
    '......................xxxVVx....',
    '.....................MMMKVVx....',
    '......................xxxx^x....',
    '.....................--...^.^...',
    '.....................--....^....',
  ],
}
// 横向き。手前の腕を胸の高さへ上げ、胸の前の拳(26・27行の16・17列)で柄を握る。
// 柄は16列をまっすぐ上り、顎から帽子までは頭の後ろに隠れる。拳の下には柄の端が2行覗く。
// 前下(19列から先)はランタンの席なので、胴の前の輪郭(19列)は素のコマのまま触らず、
// 拳もランタンから1列離す(同じ手で灯りと傘を提げているように見せない)
const sideGrip: Grip = {
  shaft: shaftLine(() => 16, 25),
  armTop: 25,
  arm: [
    '................^...............',
    '...............xVVQ.............',
    '..............JYVVQ.............',
    '..............JM^qQ.............',
    '..............QM^...............',
  ],
}

// 素の体(16×24)に傘を持たせる。dyは歩行コマで体と一緒に1行下げるぶん
const holdUmbrella = (body: PixelArt, grip: Grip, cover: Cover, dy: number): PixelArt => {
  const armed = paintAt(toFrame(body), grip.arm, 0, grip.armTop + dy)
  const covered = paintBehind(armed, cover.art, cover.left, cover.top + dy)
  return paintBehind(covered, grip.shaft, 0, dy)
}

// ---- 傘を差して歩く ----
// 天蓋の石突きの列。正面は柄の線の上の12列、背面は柄の線の20列だと天蓋が画布の右端からはみ出すので19列、
// 横向きは柄と同じ16列(頭の真上)
const frontOpen = coverAt(canopyOpen, 12)
const backOpen = coverAt(canopyOpen, 19)
const sideOpen = coverAt(canopyOpen, 16)

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

// 柄を伸ばし、畳んだまま頭の横に立てる。ここから差して立つコマまで、拳と柄は同じ所に留まる
const umbrellaDownExtend = holdUmbrella(downFrames[0], frontGrip, coverAt(foldedFront, 12, 1), 0)
// 骨が立ち、細い釣鐘の形に半分開く
const umbrellaDownHalf = holdUmbrella(downFrames[0], frontGrip, coverAt(canopyNarrow, 12), 0)
// 開ききる手前。この次が差して立つコマ(umbrellaDownの静止)
const umbrellaDownRaise = holdUmbrella(downFrames[0], frontGrip, coverAt(canopyWide, 12), 0)

// ---- 傘を閉じてしまう(背面) ----
// 差して立つコマ(umbrellaUpの静止)から、天蓋を開いたときの逆の順にすぼめる。拳と柄は同じ所に留まる
const umbrellaUpLower = holdUmbrella(upFrames[0], backGrip, coverAt(canopyWide, 19), 0)
const umbrellaUpHalf = holdUmbrella(upFrames[0], backGrip, coverAt(canopyNarrow, 19), 0)
// 布を畳みきり、柄に沿って立てる。次のコマで柄を縮めて手元へ下ろす
const umbrellaUpClosed = holdUmbrella(upFrames[0], backGrip, coverAt(foldedBack, 20, 1), 0)

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
    upPose(1, upSink, upArmUp, upWindupRod),
    downPose(-1, downNeck, downWindupRod),
    rightPose(-1, rightNeck, rightWindupRod),
  ]),
  backswing: framed3([
    upPose(1, upSink, upArmUp, upBackswingRod),
    downPose(-1, downNeck, downFreeArmUp, downBackswingRod),
    rightPose(-1, rightNeck, rightBackswingRod),
  ]),
  cast: framed3([
    upPose(-1, upNeck, upArmUp, upCastRod),
    downPose(1, downCastRod),
    rightPose(1, rightChinTuck, rightCastRod),
  ]),
  // 振り抜きがいちばん深く倒れるコマ。次の待機コマで体が起き上がる
  follow: framed3([
    upPose(-2, upStretch, upArmUp, upFollowRod),
    downPose(2, downCheekClear, downFollowRod),
    rightPose(2, rightChinTuckDeep, rightFollowRod),
  ]),
  tense: framed3([
    upPose(-1, upNeck, upTenseRod),
    downPose(1, downTenseRod),
    rightPose(1, rightChinTuck, rightTenseRod),
  ]),
  bite: framed3([
    upPose(-2, upStretch, upBiteRod),
    downPose(2, downCheekClear, downBiteRod),
    rightPose(2, rightChinTuckDeep, rightBiteRod),
  ]),
  pull: framed3([
    upPose(1, upSink, upArmUp, upPullRod),
    downPose(-1, downNeck, downPullRod),
    rightPose(-1, rightNeck, rightPullRod),
  ]),
  hoist: framed3([
    upPose(1, upSink, upArmUp, upHoistRod),
    downPose(-1, downNeck, downFreeArmUp, downHoistRod),
    rightPose(-1, rightNeck, rightHoistRod),
  ]),
  // 傘を差したコマは素の立ち・歩きのコマに傘を持たせる。歩行コマ(1・2)は体と一緒に傘も1行下がる
  umbrellaUp: [
    holdUmbrella(upFrames[0], backGrip, backOpen, 0),
    holdUmbrella(upFrames[1], backGrip, backOpen, 1),
    holdUmbrella(upFrames[2], backGrip, backOpen, 1),
  ],
  umbrellaDown: [
    holdUmbrella(downFrames[0], frontGrip, frontOpen, 0),
    holdUmbrella(downFrames[1], frontGrip, frontOpen, 1),
    holdUmbrella(downFrames[2], frontGrip, frontOpen, 1),
  ],
  umbrellaRight: [
    holdUmbrella(rightFrames[0], sideGrip, sideOpen, 0),
    holdUmbrella(rightFrames[1], sideGrip, sideOpen, 1),
  ],
  umbrellaOpen: {
    reach: toFrame(umbrellaDownReach),
    draw: toFrame(umbrellaDownDraw),
    extend: umbrellaDownExtend,
    half: umbrellaDownHalf,
    raise: umbrellaDownRaise,
  },
  umbrellaClose: {
    lower: umbrellaUpLower,
    half: umbrellaUpHalf,
    closed: umbrellaUpClosed,
    compact: toFrame(umbrellaUpCompact),
    stow: toFrame(umbrellaUpStow),
  },
}

// ここから下は夜だけ使う差分。昼のコマへ灯りを重ねるだけなので、体と服のドットは昼と 1 ドットも変わらない。
// ランタンの絵そのものは lantern.ts が正本で、ロボット(structures.ts)も同じ 1 枚を提げる。
// 向きごとに違うのは「その向きで体のどちら側が空いているか」だけなので、
// ここでは面を選んで重ねる位置を決めるところまでしかしない

// 体のドットは静止コマが 4 行目、歩行コマが 5 行目から始まる。ランタンも同じだけ下げると、
// 手からの位置がどのコマでも同じになり、コマ送りで灯りだけが跳ねない。
// コマは画布へ置いてあるので、型紙も行も体の箱の位置(PLAYER_BODY_*)だけずらして重ねる
const onFrame = (lantern: PixelArt): PixelArt => lantern.map(row => SIDE_PAD + row + SIDE_PAD)
const standLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, onFrame(lantern), PLAYER_BODY_TOP + 4 + LANTERN_BODY_TOP)
const walkLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, onFrame(lantern), PLAYER_BODY_TOP + 5 + LANTERN_BODY_TOP)

// 釣りのコマは静止コマと同じ高さに、並び(上・下・右)どおりの面を提げる。場面が 9 つあるので
// 向きとランタンの組をここ 1 箇所に置き、場面ごとに書き並べて面を取り違える余地を無くす
const litFishing = ([up, down, right]: FishingFrames): FishingFrames => [
  standLit(up, backLantern),
  standLit(down, frontLantern),
  standLit(right, sideLantern),
]

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
  // 傘のコマも昼の絵へ灯りを重ねるだけ。差して立つ・歩くコマは素のコマと同じ面と高さ、
  // 出す動きは正面の静止、しまう動きは背面の静止と同じ高さに提げる。
  // 傘や上げた腕がランタンの席へ入っていれば、釣りと同じく overlayLantern がここで落ちる
  umbrellaUp: [
    standLit(playerArt.umbrellaUp[0], backLantern),
    walkLit(playerArt.umbrellaUp[1], backLantern),
    walkLit(playerArt.umbrellaUp[2], backLantern),
  ],
  umbrellaDown: [
    standLit(playerArt.umbrellaDown[0], frontLantern),
    walkLit(playerArt.umbrellaDown[1], frontLantern),
    walkLit(playerArt.umbrellaDown[2], frontLantern),
  ],
  umbrellaRight: [
    standLit(playerArt.umbrellaRight[0], sideLantern),
    walkLit(playerArt.umbrellaRight[1], sideLantern),
  ],
  umbrellaOpen: {
    reach: standLit(playerArt.umbrellaOpen.reach, frontLantern),
    draw: standLit(playerArt.umbrellaOpen.draw, frontLantern),
    extend: standLit(playerArt.umbrellaOpen.extend, frontLantern),
    half: standLit(playerArt.umbrellaOpen.half, frontLantern),
    raise: standLit(playerArt.umbrellaOpen.raise, frontLantern),
  },
  umbrellaClose: {
    lower: standLit(playerArt.umbrellaClose.lower, backLantern),
    half: standLit(playerArt.umbrellaClose.half, backLantern),
    closed: standLit(playerArt.umbrellaClose.closed, backLantern),
    compact: standLit(playerArt.umbrellaClose.compact, backLantern),
    stow: standLit(playerArt.umbrellaClose.stow, backLantern),
  },
}
