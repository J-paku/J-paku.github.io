// 全スプライトを型付き辞書へまとめる。地形・建物は 16×16 の1枚、主人公は 16×24 の別シート
import { createHash } from 'node:crypto'
import { buildSheet } from './art'
import type { PixelArt, Sheet } from './art'
import { playerArt, playerNightArt, PLAYER_HEIGHT } from './actors'
import { palette } from './palette'
import { phasePalette } from './palette-phase'
import { structureArt, structureNightArt } from './structures'
import { terrainArt } from './terrain'
import { weatherArt } from './weather-art'
import type { DayPhase } from '@/utils/day-phase'

type PlayerSpriteKey =
  | 'player-up-0'
  | 'player-up-1'
  | 'player-up-2'
  | 'player-down-0'
  | 'player-down-1'
  | 'player-down-2'
  | 'player-right-0'
  | 'player-right-1'

export type SpriteKey = keyof typeof terrainArt | keyof typeof structureArt

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

// 主人公の 8 コマをシート用の平らな辞書へ並べる。昼と夜で同じ関数を通すので、
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
})

export const SPRITE_ARTS: Record<SpriteKey, PixelArt> = {
  ...terrainArt,
  ...structureArt,
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

// ---- 配信するシートの名前 ----
// 画像を data URI から実ファイルへ出したことで、配置情報(index・count)を載せた HTML と
// 絵そのものの PNG は、別々に期限を持つ 2 つの成果物になった。1 枚の HTML の中に同居していた
// 間は中身がずれようが無かったが、今は「配信直前に来た人が持ち帰った古い PNG」と
// 「再読み込みで届いた新しい HTML」が出会える。その配信で素材を 1 つ足す・並べ替えるだけで
// index が丸ごとずれ、町中のマスが軒並み別の絵を描く。
// 名前を中身から導くとこの組み合わせは作れない — 中身が変われば URL も変わるので、
// 古い PNG はもう誰からも参照されない。
// 名前の作り方はここ 1 本だけに置く。URL を組む側(VillagePage)と焼く側
// (scripts/build-sprites.mjs)が別々に綴りを知っていると、両者は黙ってすれ違える

// 焼く種類の一覧はこの組が唯一の正本。綴りは scene.module.css のクラス名と揃えてある
export const SHEET_KINDS = ['sprite', 'player'] as const
export type SheetKind = (typeof SHEET_KINDS)[number]

// 置き場。public/<SHEET_DIR>/ へ焼いて /<SHEET_DIR>/ で配る
export const SHEET_DIR = 'sprites'

// 種類 → 焼き方。Record なので SHEET_KINDS へ足して焼き方を書き忘れると型検査で落ちる
const SHEET_BUILDERS: Record<SheetKind, (phase: DayPhase) => Sheet> = {
  sprite: buildSprites,
  player: buildPlayerSprites,
}

// 同じ組み合わせを二度焼かない。名前を決めるにも中身が要るので、名前を聞かれて焼いた 1 枚と
// 配置情報に使う 1 枚を同じ実体にする(焼き直して別物になる余地を残さない)
const sheetCache = new Map<string, Sheet>()

export const sheetOf = (kind: SheetKind, phase: DayPhase): Sheet => {
  const cacheKey = `${kind}-${phase}`
  const cached = sheetCache.get(cacheKey)
  if (cached !== undefined) return cached
  const sheet = SHEET_BUILDERS[kind](phase)
  sheetCache.set(cacheKey, sheet)
  return sheet
}

// 指紋の桁数。狙いはキャッシュの破棄であって改竄の検知ではないので、
// 16^8 通りあれば「中身を変えたのに名前が同じ」は実務上起こらない
const FINGERPRINT_LENGTH = 8

// data URI は PNG のバイト列そのものなので、絵・パレット・並び順のどれが動いても指紋が変わる
const fingerprint = (uri: string): string =>
  createHash('sha256').update(uri).digest('hex').slice(0, FINGERPRINT_LENGTH)

// 例: sprite-day-1a2b3c4d.png。verify-export.mjs は /sprites/[a-z0-9-]+\.png で参照を拾うので、
// 16 進の小文字とハイフンだけで組む
export const sheetFileName = (kind: SheetKind, phase: DayPhase): string =>
  `${kind}-${phase}-${fingerprint(sheetOf(kind, phase).uri)}.png`
