// 配信するシートのファイル名・置き場・指紋と、名前を決めるのに焼いた 1 枚の使い回し
import { createHash } from 'node:crypto'
import type { Sheet } from './art'
import { buildPlayerSprites, buildSprites } from './sprites'
import type { DayPhase } from '@/utils/day-phase'

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
