// 主人公のコマを組み立てる合成の部品と、コマの寸法の正本。絵のドット(体・竿・傘の型紙)は actors.ts が持ち、
// ここは文字の行列を受けて新しい行列を返す純粋関数だけを置く。絵のデータと分けたのは、合成の手順を
// 門(ファイル別100%・変異テスト)で固めるため(絵のデータは門の外。scripts/gate-targets.mjs の OUTSIDE_GATES)
import { mirrorX, TILE } from './art'
import type { PixelArt } from './art'
import { backLantern, frontLantern, LANTERN_BODY_TOP, overlayLantern, sideLantern } from './lantern'

export const PLAYER_HEIGHT = 24

// シートの1コマは32×32の画布。16×24の体を左右8列・上8行の余白の下辺中央へ置き、足元は画布の下辺のまま。
// 傘と飛行以外は余白を空けたまま、体のドットも立つ位置も16×24の頃と変わらない。
// 画面ではscene.module.cssの.playerが体の箱(1×1.5マス)のまま立ち、::beforeがこの画布を左右と上へ半マスずつはみ出させて描く
export const PLAYER_BODY_LEFT = 8
export const PLAYER_BODY_TOP = 8
export const PLAYER_FRAME_WIDTH = TILE + PLAYER_BODY_LEFT * 2
export const PLAYER_FRAME_HEIGHT = PLAYER_HEIGHT + PLAYER_BODY_TOP

export type Triple = [PixelArt, PixelArt, PixelArt]

// 描画の空行。頭上の余白に使う
const BLANK = '................'

// 静止: 頭上 4 行の余白 + 体 18 行 + 足 2 行
export const stand = (body: PixelArt, feet: PixelArt): PixelArt => [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  ...body,
  ...feet,
]

// 歩行: 全体を一段下げ、足は 1 行に縮めて片脚を後ろへ引く(細く描く)
export const walk = (body: PixelArt, feet: string): PixelArt => [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  ...body,
  feet,
]

// 絵は 0〜14 列に描いているので、軸足の交代はその 15 列だけを反転する(16 列目は空のまま)
export const mirrorArt = (row: string): string =>
  [...row.slice(0, 15)].reverse().join('') + row.slice(15)
export const alternateFoot = (art: PixelArt): PixelArt => [
  ...art.slice(0, -1),
  mirrorArt(art[art.length - 1]),
]

// 静止コマへ竿だけを重ねて「竿を持って立っている」コマを作る。
// 型紙の '.' は元の絵を残し、それ以外は体のドットを塗り替える — ランタン(lantern.ts)と違って
// 竿は体の手前にあり、握った手や上着の上を通るため、重なりを禁じると竿が描けない
export const overlayRod = (art: PixelArt, rod: PixelArt): PixelArt =>
  art.map((row, y) => [...row].map((ch, x) => (rod[y][x] === '.' ? ch : rod[y][x])).join(''))

// 頭はコマの 4 行目から 13 行(3 面とも体の 0〜12 行)。その下の 5 行が胴と脚
const HEAD_TOP = 4
const HEAD_ROWS = 13

// 頭だけを dy 行ずらす(負で上)。首から下は元の位置に残す。
// 下げた頭は襟や肩の手前に重ね(うつむくと顎が襟に埋まる)、上げた頭の下に空く行は首の型紙で埋める
export const moveHead = (art: PixelArt, dy: number): PixelArt =>
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
export const overlayPose = (art: PixelArt, patch: PixelArt): PixelArt =>
  art.map((row, y) =>
    [...row]
      .map((ch, x) => (patch[y][x] === '.' ? ch : patch[y][x] === ERASE ? '.' : patch[y][x]))
      .join('')
  )

// 数行しか描かない部品(首・顎・腕)の型紙。行番号 → 行 の表を 24 行へ広げ、残りは元の絵を残す
export const partAt = (rows: Partial<Record<number, string>>): PixelArt =>
  Array.from({ length: PLAYER_HEIGHT }, (_, y) => rows[y] ?? BLANK)

// 釣りの 1 コマ。静止コマの頭を dy 行ずらし、体の部品と竿の型紙をこの順に重ねる
export const pose = (base: PixelArt, dy: number, ...patches: PixelArt[]): PixelArt =>
  patches.reduce(overlayPose, moveHead(base, dy))

// シートへ焼く1コマは32×32の画布(PLAYER_FRAME_*)。絵はどれも16×24の体の上で組み、
// 最後にtoFrameで画布の下辺中央へ置く。傘の無いコマは余白を空けたままなので、体のドットも立つ位置も変わらない
const FRAME_BLANK = '.'.repeat(PLAYER_FRAME_WIDTH)
const SIDE_PAD = '.'.repeat(PLAYER_BODY_LEFT)
export const toFrame = (art: PixelArt): PixelArt => [
  ...Array.from({ length: PLAYER_BODY_TOP }, () => FRAME_BLANK),
  ...art.map(row => SIDE_PAD + row + SIDE_PAD),
]
export const framed3 = ([a, b, c]: Triple): Triple => [toFrame(a), toFrame(b), toFrame(c)]
export const framed2 = ([a, b]: [PixelArt, PixelArt]): [PixelArt, PixelArt] => [
  toFrame(a),
  toFrame(b),
]

// ---- 傘を出す・しまう途中のコマ ----
// 型紙の(x, y)の文字。型紙の外は'.'(元の絵を残す)として読む
const cellOf = (patch: PixelArt, x: number, y: number): string =>
  y >= 0 && y < patch.length && x >= 0 && x < patch[y].length ? patch[y][x] : '.'
// 元の絵が透明な升にだけ描く。体の後ろへ回る天蓋と柄に使う
export const paintBehind = (art: PixelArt, patch: PixelArt, left: number, top: number): PixelArt =>
  art.map((row, y) =>
    [...row].map((ch, x) => (ch === '.' ? cellOf(patch, x - left, y - top) : ch)).join('')
  )

// 傘の木の部分(天蓋の石突き)の文字(palette.ts)
const UMBRELLA_WOOD = '^'
// 原画の立ち姿で天蓋と縁の房が占める行(0〜12行)。13行目から下は帽子・体・柄
const CANOPY_ROWS = 13
// 置く天蓋。left・topは画布の列・行
export type Cover = { art: PixelArt; left: number; top: number }
// 天蓋の石突き(最上行の^)を画布のcolumn列へ合わせて置く
export const coverAt = (art: PixelArt, column: number, top: number): Cover => ({
  art,
  left: column - art[0].indexOf(UMBRELLA_WOOD),
  top,
})
// 原画の柄の文字(palette.ts)
const UMBRELLA_SHAFT = '|'
// 天蓋を差し替えた立ち姿。capTopは天蓋に隠れていた帽子の天辺を閉じる輪郭の行(12行目)、
// shaftは原画の柄の列で、替えた天蓋の縁の下から12行目まで柄を足す(体の後ろへ回るので透明な升にだけ描く)
export type Swap = { capTop: string; shaft: number }
export const swapCanopy = (base: PixelArt, { capTop, shaft }: Swap, cover: Cover): PixelArt => {
  const bare = [
    ...Array.from({ length: CANOPY_ROWS - 1 }, () => FRAME_BLANK),
    capTop,
    ...base.slice(CANOPY_ROWS),
  ]
  const covered = paintBehind(bare, cover.art, cover.left, cover.top)
  const rim = cover.top + cover.art.length
  return covered.map((row, y) =>
    y >= rim && y < CANOPY_ROWS && row[shaft] === '.'
      ? row.slice(0, shaft) + UMBRELLA_SHAFT + row.slice(shaft + 1)
      : row
  )
}

// 素の体のコマを左右に反転する。正面の体は0〜14列に描いてあるのでその15列だけ(軸足の交代と同じ)、
// 背面の体は16列いっぱいに左右対称に描いてあるので16列ごと反転する。どちらも体の中心の列は動かない
export const mirrorFront = (art: PixelArt): PixelArt => art.map(mirrorArt)
export const mirrorBack = (art: PixelArt): PixelArt => mirrorX(art)

// ---- 夜に提げるランタン ----
// 体のドットは静止コマが 4 行目、歩行コマが 5 行目から始まる。ランタンも同じだけ下げると、
// 手からの位置がどのコマでも同じになり、コマ送りで灯りだけが跳ねない。
// コマは画布へ置いてあるので、型紙も行も体の箱の位置(PLAYER_BODY_*)だけずらして重ねる
const onFrame = (lantern: PixelArt): PixelArt => lantern.map(row => SIDE_PAD + row + SIDE_PAD)
// 静止コマでランタンの型紙の最上行を置く画布の行
export const STAND_LANTERN_TOP = PLAYER_BODY_TOP + 4 + LANTERN_BODY_TOP
export const standLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, onFrame(lantern), STAND_LANTERN_TOP)
export const walkLit = (art: PixelArt, lantern: PixelArt): PixelArt =>
  overlayLantern(art, onFrame(lantern), PLAYER_BODY_TOP + 5 + LANTERN_BODY_TOP)

// 面(lantern.tsの型紙)を、必要なら左右を反転して、体の箱から右へdx列ずらした位置の画布のtop行目から重ねる
export type Hang = { face: PixelArt; mirrored: boolean; dx: number; top: number }
export const hangLantern = (art: PixelArt, { face, mirrored, dx, top }: Hang): PixelArt =>
  overlayLantern(
    art,
    (mirrored ? mirrorX(face) : face).map(
      row => '.'.repeat(PLAYER_BODY_LEFT + dx) + row + '.'.repeat(PLAYER_BODY_LEFT - dx)
    ),
    top
  )

// 釣りのコマは静止コマと同じ高さに、並び(上・下・右)どおりの面を提げる。場面が 9 つあるので
// 向きとランタンの組をここ 1 箇所に置き、場面ごとに書き並べて面を取り違える余地を無くす
export const litFishing = ([up, down, right]: Triple): Triple => [
  standLit(up, backLantern),
  standLit(down, frontLantern),
  standLit(right, sideLantern),
]
