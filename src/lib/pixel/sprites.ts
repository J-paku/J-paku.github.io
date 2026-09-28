// 全スプライトを型付き辞書へまとめる。地形・建物は 16×16 の1枚、主人公は 16×24 の別シート
import { buildSheet } from './art'
import type { PixelArt, Sheet } from './art'
import { playerArt, playerNightArt, PLAYER_HEIGHT } from './actors'
import { fishingArt } from './fishing-art'
import { palette } from './palette'
import { phasePalette } from './palette-phase'
import { structureArt, structureNightArt } from './structures'
import { terrainArt } from './terrain'
import { weatherArt } from './weather-art'
import type { DayPhase } from '@/utils/day-phase'

// 糸を垂らして待つコマ(player-fish-{向き})の前後に使う釣りの動き。並びは使う時間の順。
// 鍵の型はこの組から導くので、場面を足して下の playerSpriteArts へ書き忘れると型検査で落ちる。
// テストも同じ組を回して、足した場面が足元・体の動き・糸の検査から漏れないようにする
export const FISHING_MOTIONS = [
  'windup',
  'backswing',
  'cast',
  'follow',
  'tense',
  'bite',
  'pull',
  'hoist',
] as const
type FishingMotion = (typeof FISHING_MOTIONS)[number]

// 雨の外で傘を出して開く動き(正面)と、閉じてしまう動き(背面)。並びは使う時間の順。
// FISHING_MOTIONS と同じく鍵の型をこの組から導くので、段階を足して playerSpriteArts へ書き忘れると型検査で落ちる
export const UMBRELLA_OPEN_STEPS = ['reach', 'draw', 'extend', 'half', 'raise'] as const
export const UMBRELLA_CLOSE_STEPS = ['lower', 'half', 'closed', 'compact', 'stow'] as const
type UmbrellaOpenStep = (typeof UMBRELLA_OPEN_STEPS)[number]
type UmbrellaCloseStep = (typeof UMBRELLA_CLOSE_STEPS)[number]

type PlayerSpriteKey =
  | 'player-up-0'
  | 'player-up-1'
  | 'player-up-2'
  | 'player-down-0'
  | 'player-down-1'
  | 'player-down-2'
  | 'player-right-0'
  | 'player-right-1'
  | 'player-fish-up'
  | 'player-fish-down'
  | 'player-fish-right'
  | `player-fish-${'up' | 'down' | 'right'}-${FishingMotion}`
  // 傘を差したコマ。番号は素のコマと同じく 0 が静止、1・2 が歩行(横向きは 1 だけ)
  | 'player-umbrella-up-0'
  | 'player-umbrella-up-1'
  | 'player-umbrella-up-2'
  | 'player-umbrella-down-0'
  | 'player-umbrella-down-1'
  | 'player-umbrella-down-2'
  | 'player-umbrella-right-0'
  | 'player-umbrella-right-1'
  | `player-umbrella-open-${UmbrellaOpenStep}`
  | `player-umbrella-close-${UmbrellaCloseStep}`

export type SpriteKey =
  keyof typeof terrainArt | keyof typeof structureArt | keyof typeof fishingArt

// 主人公のコマ表の型は actors.ts の値から導く。同じ形をここへ書き写すと正本が 2 つになり、
// 向きやコマを足したときに片方だけが古いまま通ってしまう
type PlayerFrames = typeof playerArt

// 夜だけ差し替える素材の表。鍵は基準の絵が決め、夜にできるのは「既にある鍵の中身を置き換える」ことだけで、
// 追加も削除もできない。Partial<Record<基準の鍵>> なので、基準に無い鍵を夜の表へ書けば
// その表を宣言した側がコンパイルエラーになる(黙って絵がずれるのではなく、型検査で落ちる)
type NightOverrides<Key extends string> = Partial<Record<Key, PixelArt>>

// 基準の絵へ夜の絵を上書きして返す。鍵の集合も並び順も基準のまま動かさない。
// 4 段階のシートは index も枚数も一致していなければならない — UI は画像の URI だけを差し替えて
// 昼夜を切り替え、配置情報(index・count)は昼のシートのものを 4 段階で使い回すため、
// 夜だけ鍵が増減・前後すると町中のマスが軒並み別の絵を描く。
// 展開は「既にある鍵へ代入しても並び順を変えない」ので、この書き方自体が差し替え専用を表している
const mergeNightArt = <Key extends string>(
  base: Record<Key, PixelArt>,
  overrides: NightOverrides<Key>
): Record<Key, PixelArt> => {
  for (const key of Object.keys(overrides)) {
    // 型を迂回して未知の鍵が紛れ込んだときの保険。黙って別のマスを描くくらいなら焼く前に落とす。
    // in ではなく自前の鍵だけを見る — in は継承した性質にも当たるので、'constructor' や
    // 'toString' のような鍵がこの見張りを素通りしてしまう
    if (!Object.hasOwn(base, key)) throw new Error(`夜の素材に基準へ無い鍵は足せません(${key})`)
  }
  return { ...base, ...overrides }
}

// 主人公のコマをシート用の平らな辞書へ並べる。昼と夜で同じ関数を通すので、
// 鍵の集合・並び順・コマ数は構造的に一致する(夜だけコマが増減することが起こり得ない)
const playerSpriteArts = (frames: PlayerFrames): Record<PlayerSpriteKey, PixelArt> => ({
  'player-up-0': frames.up[0],
  'player-up-1': frames.up[1],
  'player-up-2': frames.up[2],
  'player-down-0': frames.down[0],
  'player-down-1': frames.down[1],
  'player-down-2': frames.down[2],
  'player-right-0': frames.right[0],
  'player-right-1': frames.right[1],
  'player-fish-up': frames.fish[0],
  'player-fish-down': frames.fish[1],
  'player-fish-right': frames.fish[2],
  'player-fish-up-windup': frames.windup[0],
  'player-fish-down-windup': frames.windup[1],
  'player-fish-right-windup': frames.windup[2],
  'player-fish-up-backswing': frames.backswing[0],
  'player-fish-down-backswing': frames.backswing[1],
  'player-fish-right-backswing': frames.backswing[2],
  'player-fish-up-cast': frames.cast[0],
  'player-fish-down-cast': frames.cast[1],
  'player-fish-right-cast': frames.cast[2],
  'player-fish-up-follow': frames.follow[0],
  'player-fish-down-follow': frames.follow[1],
  'player-fish-right-follow': frames.follow[2],
  'player-fish-up-tense': frames.tense[0],
  'player-fish-down-tense': frames.tense[1],
  'player-fish-right-tense': frames.tense[2],
  'player-fish-up-bite': frames.bite[0],
  'player-fish-down-bite': frames.bite[1],
  'player-fish-right-bite': frames.bite[2],
  'player-fish-up-pull': frames.pull[0],
  'player-fish-down-pull': frames.pull[1],
  'player-fish-right-pull': frames.pull[2],
  'player-fish-up-hoist': frames.hoist[0],
  'player-fish-down-hoist': frames.hoist[1],
  'player-fish-right-hoist': frames.hoist[2],
  // 傘のコマは後から足したので末尾に並べる。前の鍵の index を動かさないため
  'player-umbrella-up-0': frames.umbrellaUp[0],
  'player-umbrella-up-1': frames.umbrellaUp[1],
  'player-umbrella-up-2': frames.umbrellaUp[2],
  'player-umbrella-down-0': frames.umbrellaDown[0],
  'player-umbrella-down-1': frames.umbrellaDown[1],
  'player-umbrella-down-2': frames.umbrellaDown[2],
  'player-umbrella-right-0': frames.umbrellaRight[0],
  'player-umbrella-right-1': frames.umbrellaRight[1],
  'player-umbrella-open-reach': frames.umbrellaOpen.reach,
  'player-umbrella-open-draw': frames.umbrellaOpen.draw,
  'player-umbrella-open-extend': frames.umbrellaOpen.extend,
  'player-umbrella-open-half': frames.umbrellaOpen.half,
  'player-umbrella-open-raise': frames.umbrellaOpen.raise,
  'player-umbrella-close-lower': frames.umbrellaClose.lower,
  'player-umbrella-close-half': frames.umbrellaClose.half,
  'player-umbrella-close-closed': frames.umbrellaClose.closed,
  'player-umbrella-close-compact': frames.umbrellaClose.compact,
  'player-umbrella-close-stow': frames.umbrellaClose.stow,
})

// 釣りの小物は昼夜で絵が変わらないので、地形・建物と同じ 16×16 のシートへ並べるだけでよい
export const SPRITE_ARTS: Record<SpriteKey, PixelArt> = {
  ...terrainArt,
  ...structureArt,
  ...fishingArt,
}

// 夜だけ絵そのものが変わる素材(灯したランタン)。色ではなく絵が違うのでパレットでは表せない。
// 明け方・夕方は製品判断で今までの見た目のままにするので、差し替えるのは夜の 1 段階だけ
// 型引数は必ず基準側の鍵(SpriteKey)で留める。省くと差し替え表(建物だけ)の狭い鍵から推論され、
// 戻り値の型から地形の鍵が丸ごと抜け落ちる — 中身は展開で揃っているのに型だけが嘘をつく状態になる
export const SPRITE_NIGHT_ARTS: Record<SpriteKey, PixelArt> = mergeNightArt<SpriteKey>(
  SPRITE_ARTS,
  structureNightArt
)

export const PLAYER_ARTS: Record<PlayerSpriteKey, PixelArt> = playerSpriteArts(playerArt)

export const PLAYER_NIGHT_ARTS: Record<PlayerSpriteKey, PixelArt> = playerSpriteArts(playerNightArt)

// 天気の 1 コマ = 1 枚。マス 1 つぶんだけを焼くので、そのまま repeat で敷き詰められる
const weatherSheet = (key: string, art: PixelArt): Sheet => buildSheet({ [key]: art }, palette)

// 段階ごとの素材を選ぶ。夜だけランタン入りの差し替え版、それ以外は今までの絵
const spriteArtsFor = (phase: DayPhase): Record<SpriteKey, PixelArt> =>
  phase === 'night' ? SPRITE_NIGHT_ARTS : SPRITE_ARTS

const playerArtsFor = (phase: DayPhase): Record<PlayerSpriteKey, PixelArt> =>
  phase === 'night' ? PLAYER_NIGHT_ARTS : PLAYER_ARTS

// 単段階ぶんのシート。どの段階も同じ順序で同じ枚数を焼くので index と count は 4 枚で共通になる。
// UI は画像の URI だけを差し替えて昼夜を切り替えるため、この不変条件が崩れるとマスの絵がずれる
export const buildSprites = (phase: DayPhase = 'day'): Sheet =>
  buildSheet(spriteArtsFor(phase), phasePalette(palette, phase))

// 主人公も同じ段階の色を通す(夜に主人公だけ昼の色だと浮くため)
export const buildPlayerSprites = (phase: DayPhase = 'day'): Sheet =>
  buildSheet(playerArtsFor(phase), phasePalette(palette, phase), PLAYER_HEIGHT)

// 雨・雪をコマごとに別シートで返す。時刻による色替えはしない(降る粒は地形ではない)。
// 2 コマを 1 枚へ横に並べると CSS の繰り返し単位が 2 マス幅になり、コマを送っても模様全体が
// 横へ 1 マスずれるだけで粒が落ちて見えない(ずらした合成が元の左 16px 平行移動と全画素一致)。
// 1 コマ 1 枚なら層ごとに repeat で敷けるので、2 層を重ねて交互に見せれば落ちて見える
export const buildWeatherSprites = (): Record<'rain' | 'snow', readonly [Sheet, Sheet]> => ({
  rain: [weatherSheet('rain-0', weatherArt.rain[0]), weatherSheet('rain-1', weatherArt.rain[1])],
  snow: [weatherSheet('snow-0', weatherArt.snow[0]), weatherSheet('snow-1', weatherArt.snow[1])],
})
