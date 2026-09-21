// 夜だけ灯す偽の照明の光源表。座標も半径もすべて「マス」単位で持ち、画面の px は
// Lighting の CSS が --cell を掛けて出す。ここは純粋なデータで、光の計算は一切しない
// (にじみの絵は放射グラデーション 1 本が描く)。
// スプライトの絵(src/lib/pixel/)はここから読まない — このファイルはクライアントの束に入るので、
// sprites.ts を実行時に取り込むと node:crypto まで一緒に引きずり込まれる。
// 「発光する絵を持つのに後光が無い」の突き合わせは lights.test.ts の中だけでやる
import type { Cell, Structure, World } from '@content/types/world'
import { facadeCells } from './facade'

// 灯りの種類。描画側はこの値をそのまま data 属性へ載せる
export type LightKind = 'lamp' | 'campfire' | 'window' | 'mailbox'

// 光源 1 つ。x・y は灯そのものの中心(マスの真ん中なら整数 + 0.5)
export type LightSource = {
  id: string
  kind: LightKind
  x: number
  y: number
  radius: number // マス単位
  intensity: number // 0~1
  color: string // #rrggbb
  flicker?: boolean
}

// 灯りの色はドット絵と同じ「データとしての色」なのでここに置く。
// CSS 側は var(--light-color) を受け取るだけで、色リテラルを持たない
const WARM = '#ffe8a8' // 電球色。街灯と、主人公が提げるランタン
const FIRE = '#ffb464' // 焚き火の橙
const WINDOW = '#ffeec8' // 室内から窓越しに漏れる白熱色
// ポストの前面に点く LED。赤・緑・紫の 3 色が混ざるので、こぼれる光はほぼ白。
// 紫へわずかに寄せて、電球色の街灯と並んだときに別物だと分かるようにする
const LED = '#f2e8ff'

// マスの中のどこが灯なのかを dx・dy で持つ。街灯なら上のマスの少し下寄りが灯になる
type Glow = {
  kind: LightKind
  dx: number
  dy: number
  radius: number
  intensity: number
  color: string
  flicker?: boolean
}

// 後光を持つ構造物の種類。綴りを書き写さず Structure の union から絞り込む。
// こうしておくと union 側で kind を改名・削除したときにこの型からその綴りが消え、
// 下の表が「union に無い鍵を持っている」として型検査で落ちる。
// 文字列で書き写すと union が変わっても表は古い綴りのまま通り、実行時の結び付きだけが
// 黙って切れて「夜に灯りだけが点かない」になる(FURNITURE・SHEET_BUILDERS と同じ作り)
type GlowKind = Extract<Structure['kind'], 'lamp' | 'campfire' | 'mailbox'>

// 灯りを持つ構造物の表(種類を増やすときはここへ 1 行足す)
const GLOW: Record<GlowKind, Glow> = {
  lamp: { kind: 'lamp', dx: 0.5, dy: 0.6, radius: 2.6, intensity: 0.3, color: WARM },
  // ポストの LED は前面の上辺に横一列なので、灯は横の真ん中。にじみは 1 本きりなので縦は
  // 粒の高さまで上げず、胴まで掛かるマスの中ほどに置く。街灯より弱く狭い
  mailbox: { kind: 'mailbox', dx: 0.5, dy: 0.55, radius: 1.8, intensity: 0.22, color: LED },
  campfire: {
    kind: 'campfire',
    dx: 0.5,
    dy: 0.55,
    radius: 3,
    intensity: 0.34,
    color: FIRE,
    flicker: true,
  },
}

// 後光をあえて付けない種類。灯り用の文字(パレットの 4~9)を使う絵を持ちながら周りが暗いままの
// ものは、そう決めたのか付け忘れたのかが外から見分けられない。ここに綴りがあれば「決めた」と読める。
// 経歴碑の星と机のモニターは、その絵自身が光って見えればよい小さな灯り。地面まで照らすと夜の
// 暗がりが薄れ、村を照らす 4 つ(街灯・焚き火・家の窓・ポストの LED)との区別も付かなくなる。
// ロボットはゴーグルのレンズが光るが、後光はすぐ隣の焚き火が受け持つ。同じ場所を 2 つの光源で
// 照らすと、そこだけ二重に明るくなって焚き火の存在が読めなくなる。
// 卓上時計も液晶の数字だけが光る小さな灯りで、置き場は屋外の光源を持たない自室。ここへ後光を敷くと
// 屋内だけ夜の暗がりが崩れる。
// 灯りと無縁な種類(ポスト・ベッド・テーブルなど)は書かない — 発光する絵を持つものだけを並べる表。
// この表と GLOW の両方から漏れた発光素材は lights.test.ts の不変条件が落として知らせる
export const NO_GLOW: readonly Extract<
  Structure['kind'],
  'monument' | 'desk' | 'robot' | 'clock'
>[] = ['monument', 'desk', 'robot', 'clock']

// 種類から表を引けるかの判定。灯りを持たない種類(机・ロボットなど)では false になる。
// in ではなく Object.hasOwn を使う — in は継承した性質にも当たるので、'constructor' や
// 'toString' のような綴りがこの見張りを素通りしてしまう
const isGlowKind = (kind: Structure['kind']): kind is GlowKind => Object.hasOwn(GLOW, kind)

// 窓は構造物の種類ではなく facadeCells が返すマスなので、表とは別に持つ
const WINDOW_GLOW: Glow = {
  kind: 'window',
  dx: 0.5,
  dy: 0.55,
  radius: 1.6,
  intensity: 0.18,
  color: WINDOW,
}

// 灯りの無いものは flicker を持たせない(属性ごと落とす)
const toLight = (id: string, cell: Cell, glow: Glow): LightSource => {
  const light: LightSource = {
    id,
    kind: glow.kind,
    x: cell.x + glow.dx,
    y: cell.y + glow.dy,
    radius: glow.radius,
    intensity: glow.intensity,
    color: glow.color,
  }
  return glow.flicker === true ? { ...light, flicker: true } : light
}

// 窓の灯り。どのマスが窓かは facadeCells が唯一の正本で、ここで判定を作り直さない
const windowLights = (house: Structure): LightSource[] =>
  facadeCells(house)
    .filter(({ key }) => key === 'window')
    .map(({ cell }) => toLight(`${house.id}:win:${cell.x},${cell.y}`, cell, WINDOW_GLOW))

// 構造物 1 つぶんの灯り。窓を出すのは家だけなので、家以外を facadeCells へ通さない
// (通すと、まだ絵の表に載っていない種類が来たときに facadeCells 側で落ちる)
const structureLights = (structure: Structure): LightSource[] => {
  if (structure.kind === 'house') return windowLights(structure)
  const { kind } = structure
  if (!isGlowKind(kind)) return []
  return [toLight(structure.id, structure.cell, GLOW[kind])]
}

// ワールドの光源を並べる。同じワールドを何度渡しても同じ並びになる純粋関数
export const worldLights = (world: World): LightSource[] =>
  world.structures.flatMap(structureLights)

// 主人公が提げるランタン。位置は毎フレーム動くのでここでは持たず、大きさと色だけを決める
export const PLAYER_LIGHT: { radius: number; intensity: number; color: string } = {
  radius: 2.5,
  intensity: 0.3,
  color: WARM,
}
