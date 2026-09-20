// 夜に灯る手提げランタンの正本。主人公(actors.ts)の 3 面ぶんの絵と重ね方をここに集める。
// 2 箇所に描くと「同じ道具」のはずが、片方だけ描き直されて黙って別物になる
// (ロボットも以前はここから提げていたが、すぐ隣の焚き火と灯りが重なるので外した)
//
// 意匠は上から吊り手・笠・縦長のガラス・受け皿の順。縦の枠は暗いスレート、笠と受け皿は
// 灯りを受けて白く光る金属で、夜にこの明暗が付くことが「手に提げた灯り」の読みを支える。
// ただし 16 ドットのマスでは全部を並べると 1 ドットずつの線になり、4 倍表示では消えてしまう。
// そこで面ごとに「その向きで見える部品」だけを描き、色と大きさは下の定数で揃える。
//
// 大きさの掟(過去に外して作り直した):
//  - ガラスは 2 列 × 4 行の塊を保つ。1〜2 ドットの細片は 4 倍で消え、灯りに見えない
//    (胴が灯りを隠す背面だけは例外。下半分は枠になる — backLantern に理由を書いた)
//  - 足元の行(18)へ下ろさない。地面に置いた物に見え、持ち物として読めなくなる
import { TILE } from './art'
import type { PixelArt } from './art'

// 型紙で「元の絵をそのまま残す」印。透明と同じ文字を使う
const CLEAR = '.'

// ランタンの部品。面ごとに見える幅は違っても、色はこの 3 文字だけで決まる
// ガラスは光源用に予約した文字なので、夜だけ palette-phase.ts が発光色(#fff0a0)へ差し替える。
// 街灯・経歴碑の星と同じ灯り色になり、村の中で灯りの色がばらつかない
const GLASS = '9'
// 縦の枠の金物。昼の色は #55575b だが、ランタンは夜のコマにしか出ないので、
// 実際に見えるのは夜の色調を通した暗い紺鼠(#262f43)だけになる。ここは影の側なので暗いままでよい
const FRAME = 'i'
// 笠と受け皿の明るい金属。ガラスと同じく光源用に予約した文字で、昼の色(#f0e8d0)は
// 前に使っていた h と 1 バイトも違わないまま、夜だけ #ffffff へ差し替わる。
// 灯り自身の光を受けた金属という意味なので、物としても筋が通る。
//
// ここを暗い金物(h・i・s)にしてはいけない。夜は光源以外の全色が #101c38 へ 0.68 混ざるので、
// h は #585d69・i は #262f43 まで落ちて体と夜の地面の闇に溶け、笠も受け皿も消える。
// 残るのはガラスの塊だけで、手提げランタンではなく体に付いた黄色い長方形に見える(4 倍の夜で実測)。
// 明るい笠・暖かいガラス・明るい受け皿の 3 段になって初めて「手に提げた灯り」として読める
const SHINE = '7'

// ランタンが使う灯り用の文字。この 2 文字がすべてで、どちらも palette-phase.ts の予約文字。
// テストから参照して「正本が決めた色だけで描かれているか」を機械で確かめる
export const LANTERN_GLASS = GLASS
export const LANTERN_SHINE = SHINE

// ガラスの塊の大きさ。これを下回ると 4 倍表示で灯りが消える(上の掟)
const GLASS_WIDTH = 2
const GLASS_HEIGHT = 4

// 左端の列を指定して 1 行ぶんの型紙を作る。残りは元の絵を残す CLEAR
const place = (left: number, chars: string): string =>
  CLEAR.repeat(left) + chars + CLEAR.repeat(TILE - left - chars.length)

// 吊り手。細い線は 4 倍で消えるので 2 ドット以上の塊にする
const bail = (width: number): string => FRAME.repeat(width)

// 笠。幅いっぱいを明るい金属で取る。両肩を暗い金物のふちにすると昼なら台形に見えるが、
// ランタンは夜のコマにしか出ず、その枠は夜の闇に沈んで見えない。つまりふちを付けた分だけ
// 「見えている笠」が細くなり、ガラスと同じ幅になって灯り全体が 1 本の棒に潰れる
const cap = (width: number): string => SHINE.repeat(width)

// 受け皿。ガラスより広く張り出させて、下すぼまりの輪郭を作る。笠と同じ明るい金属にするのは、
// 灯りの下側にも縁を作るため — 暗い金物だと夜に下辺が消え、ガラスが宙に浮いて見える
const base = (width: number): string => SHINE.repeat(width)

// ガラスの縦 4 行。post を立てると体側に枠の柱が 1 列付く(柱のぶん左へ 1 列ずれる)
const glassBlock = (left: number, post: boolean): PixelArt =>
  Array.from({ length: GLASS_HEIGHT }, () =>
    post
      ? place(left - 1, FRAME + GLASS.repeat(GLASS_WIDTH))
      : place(left, GLASS.repeat(GLASS_WIDTH))
  )

// 正面。手の外側はタイルの端まで 2 列しか空いていないので、その 2 列をガラスへ全部使い、
// 笠も同じ 2 列に収める。受け皿だけは 1 列下の行で体側へ張り出せるので、そこで幅を出す
export const frontLantern: PixelArt = [
  place(14, cap(GLASS_WIDTH)),
  ...glassBlock(14, false),
  place(13, base(GLASS_WIDTH + 1)),
]

// 背面。胴が広く、手の高さでは体の脇が 1 列しか空かない。ガラスが 2 列で並ぶのは笠の直下の
// 2 行だけで、その下は縦の枠が胴の陰から覗く形になる。ここを 4 行にしようとすると胴へ食い込む。
// 灯りを全部枠に置き換えると、夜に上を向いて歩く間だけ手元が消えて別の物に見えるので、
// 笠の下の 2 行はガラスのまま残す
export const backLantern: PixelArt = [
  place(0, cap(4)),
  place(0, GLASS.repeat(GLASS_WIDTH) + FRAME),
  place(0, GLASS.repeat(GLASS_WIDTH)),
  place(0, FRAME),
  place(0, FRAME),
  place(0, base(3)),
]

// 横向き。体の脇が 3〜4 列空くので、この向きだけは吊り手と笠の張り出しまで描ける。
// ガラスは外側へ寄せ、体側に枠の柱を立てる。左向きは scaleX(-1) で作るので 1〜14 列に収める
export const sideLantern: PixelArt = [
  place(13, bail(2)),
  place(11, cap(4)),
  ...glassBlock(13, true),
]

// 体のドットの何行目から吊るすか。手の行(正面・背面は 16、横向きは 12)に合わせてある。
// 足元の行(18)まで下ろすと地面に置いた物に見えるので、灯りは体の行 12〜17 に収める
export const LANTERN_BODY_TOP = 12

// 型紙の CLEAR は元の絵をそのまま残す。元の絵にドットがある所へ重ねてしまったら、
// 黙って絵を削らずに組み立て時に落とす
const overlayRow = (row: string, patch: string, y: number): string =>
  [...row]
    .map((ch, x) => {
      if (patch[x] === CLEAR) return ch
      if (ch !== CLEAR) throw new Error(`ランタンが絵と重なっています(${x}列${y}行)`)
      return patch[x]
    })
    .join('')

// 絵の top 行目からランタンの型紙を重ねる。型紙の外の行はそのまま返す
export const overlayLantern = (art: PixelArt, lantern: PixelArt, top: number): PixelArt =>
  art.map((row, y) => {
    const at = y - top
    return at < 0 || at >= lantern.length ? row : overlayRow(row, lantern[at], y)
  })
