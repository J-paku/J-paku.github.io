// 村の統合テストで、自動移動の直線飛行を毎フレーム写し取り、後から調べる道具。
// 飛ぶ間は通り過ぎるマスで到着しない(保存位置が変わらない)ので、歩くように保存の変化では進み具合を測れない。
// フレームを進めた直後(そのフレームの rAF を全部呼んだ後、React が確定する前)に、影([data-flight-shadow])・主人公・
// ワールドの層の transform と箱、コマ・吹き出しと窓の数・保存位置を写す。飛行の検査を E2E からこの統合テストへ移した時に、
// E2E の記録と同じ項目と読み方(線分・枠・保存の並び)をそのまま写した
import { onTestFinished } from 'vitest'
import type { Cell, World } from '@content/types/world'
import { readPosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { VIEW_COLS } from '@/components/VillagePage/components/Village/utils/stage-scale'
import { onEachFrame, stepFrame, villageFrame } from './village-walk.test-helper'

// 飛ぶコマの頭。続きは向き(down / up / right。左は right の反転)と、雲の縁だけが変わる 0 / 1
export const FLY_PREFIX = 'player-fly-'
// 箱が枠の中に収まるかを見る時に、小数 px の丸めとして許すはみ出し(px)
const EDGE_PX = 1

// transform を行列にした時の平行移動(px)・縦の倍率・左右反転。落ちた時に何が書かれていたか読めるよう文字列も残す
export type Placement = { transform: string; x: number; y: number; scale: number; flipped: boolean }

// 画面上の箱(getBoundingClientRect の px)
export type Box = { left: number; top: number; right: number; bottom: number }

// 1 フレーム分の写し。at は偽の時計の performance.now()(歩行ループの経過と同じ時計)。
// camera はワールドの層の transform で、カメラ原点を負にした px。
// 行列にできなかった transform(ワールドを替えた直後に React が書く calc 入り)は placement を null にし、文字列を unparsed に残す
export type FrameSample = {
  at: number
  world: string | null
  loop: string | null
  sprite: string | null
  flying: string | null
  shadow: Placement | null
  player: Placement | null
  camera: Placement | null
  frameBox: Box | null
  playerBox: Box | null
  shadowBox: Box | null
  bubbles: number
  dialogs: number
  unparsed: string[]
  saved: string | null
}

// cell は記録を始めた時の 1 マスの px
export type Recording = { cell: number; samples: FrameSample[] }

const placementOf = (
  name: string,
  element: HTMLElement | null,
  unparsed: string[]
): Placement | null => {
  if (element === null || element.style.transform === '') return null
  const transform = element.style.transform
  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return { transform, x: matrix.e, y: matrix.f, scale: matrix.d, flipped: matrix.a < 0 }
  } catch {
    unparsed.push(`${name}: ${transform}`)
    return null
  }
}

const boxOf = (element: Element | null): Box | null => {
  if (element === null) return null
  const { left, top, right, bottom } = element.getBoundingClientRect()
  return { left, top, right, bottom }
}

const sampleOf = (setId: string): FrameSample => {
  const frame = villageFrame()
  const shadow = document.querySelector<HTMLElement>('[data-flight-shadow]')
  const player = document.querySelector<HTMLElement>('[data-village-player]')
  const layer = document.querySelector<HTMLElement>('[data-world]')
  const unparsed: string[] = []
  const saved = readPosition(setId)
  return {
    at: performance.now(),
    world: layer?.getAttribute('data-world') ?? null,
    loop: frame.dataset.villageLoop ?? null,
    sprite: player?.dataset.sprite ?? null,
    flying: shadow?.dataset.flying ?? null,
    shadow: placementOf('shadow', shadow, unparsed),
    player: placementOf('player', player, unparsed),
    camera: placementOf('camera', layer, unparsed),
    frameBox: boxOf(frame),
    playerBox: boxOf(player),
    shadowBox: boxOf(shadow),
    bubbles: document.querySelectorAll('[data-village-bubble]').length,
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    unparsed,
    saved: saved === null ? null : JSON.stringify({ worldId: saved.worldId, cell: saved.cell }),
  }
}

// 毎フレームの写し取りを始める。最初の 1 枚を今写すので、この後の操作は必ず記録の中に入る
export const startRecording = (setId: string): Recording => {
  const recording: Recording = {
    cell: villageFrame().clientWidth / VIEW_COLS,
    samples: [sampleOf(setId)],
  }
  onEachFrame(() => recording.samples.push(sampleOf(setId)))
  onTestFinished(() => onEachFrame(null))
  return recording
}

// 写し取りを止めて記録を返す。歩行ループが最後に書いた値を写すフレームを 2 回挟んでから止める
export const stopRecording = async (recording: Recording): Promise<Recording> => {
  await stepFrame()
  await stepFrame()
  onEachFrame(null)
  return recording
}

// ---- 記録の読み方 ----

export type Point = { x: number; y: number }
export type Saved = { worldId: string; cell: Cell }

// 影の落ちる地上の位置(マス。マスの左上が整数)
export const groundOf = (sample: FrameSample, cell: number): Point => {
  if (sample.shadow === null) throw new Error('影の transform が書かれていないフレームがある')
  return { x: sample.shadow.x / cell, y: sample.shadow.y / cell }
}

// 主人公の描かれた位置(マス)。飛んでいる間は地上の位置より浮き上がりの分だけ上
export const drawnOf = (sample: FrameSample, cell: number): Point => {
  if (sample.player === null) throw new Error('主人公の transform が書かれていないフレームがある')
  return { x: sample.player.x / cell, y: sample.player.y / cell }
}

export const isFlyingSprite = (sample: FrameSample) => (sample.sprite ?? '').startsWith(FLY_PREFIX)

// 写したコマの名前を重複なしで並べる
export const distinct = (values: readonly (string | null)[]) =>
  [...new Set(values.map(value => value ?? ''))].sort()

// 影の中心が乗るマス。影の位置はマスの左上なので、半マス足して切り捨てる
export const cellUnder = (p: Point): Cell => ({
  x: Math.floor(p.x + 0.5),
  y: Math.floor(p.y + 0.5),
})

// 線分 from→to に対する p の位置。along は線分の向きの割合(0 が出発・1 が着地)、off は線分からの距離(マス)
export const onSegment = (p: Point, from: Point, to: Point) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const along = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx * dx + dy * dy)
  const t = Math.min(1, Math.max(0, along))
  return { along, off: Math.hypot(p.x - (from.x + dx * t), p.y - (from.y + dy * t)) }
}

export const distanceBetween = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// 前のフレームから平行移動した距離(px)。label は落ちた時にどの要素か分かるように付ける
export const stepOf = (from: Placement | null, to: Placement | null, label: string) => {
  if (from === null || to === null)
    throw new Error(`${label}の transform を行列で読めないフレームがある`)
  return Math.hypot(to.x - from.x, to.y - from.y)
}

// 主人公の絵(32×32 の画布)の箱。体の箱(1×1.5 マス)の左右と上へ半マスずつ広げた 2×2 マス
// (scene.module.css の .player::before)
export const spriteBoxOf = (sample: FrameSample, cell: number): Box => {
  if (sample.playerBox === null) throw new Error('主人公の箱を測れていないフレームがある')
  const { left, top, right, bottom } = sample.playerBox
  return { left: left - cell / 2, top: top - cell / 2, right: right + cell / 2, bottom }
}

const withinFrame = (box: Box, frame: Box) =>
  box.left >= frame.left - EDGE_PX &&
  box.top >= frame.top - EDGE_PX &&
  box.right <= frame.right + EDGE_PX &&
  box.bottom <= frame.bottom + EDGE_PX

// 主人公の絵か地上の影が村の枠からはみ出したフレーム。どちらがはみ出したかと、枠の上辺から絵の上端までのマス数を添える
export const outsideFrame = (frames: readonly FrameSample[], cell: number) =>
  frames.flatMap(sample => {
    const { frameBox, shadowBox } = sample
    if (frameBox === null || shadowBox === null)
      throw new Error('枠か影の箱を測れていないフレームがある')
    const sprite = spriteBoxOf(sample, cell)
    const spriteOut = !withinFrame(sprite, frameBox)
    const shadowOut = !withinFrame(shadowBox, frameBox)
    if (!spriteOut && !shadowOut) return []
    const spriteTop = Math.round(((sprite.top - frameBox.top) / cell) * 100) / 100
    return [{ at: sample.at, spriteOut, shadowOut, spriteTop }]
  })

// 町の上端の近くで、浮き上がりのせいで主人公の絵が村の枠の上辺より上へ出たフレーム。
// 上端の行では立っているだけで絵が枠の上辺を越えるので、上辺と「同じ地上の位置に立った時の絵の上端」の高い方までは許す。
// 立った時の絵の上端は、描かれた絵の上端を浮き上がり(影と主人公の transform の縦の差)だけ下ろした所。
// 絵の左右・下辺と地上の影は、ほかのテストと同じく枠の中に収まるかを見る
export const raisedPastTop = (frames: readonly FrameSample[], cell: number) =>
  frames.flatMap(sample => {
    const { frameBox, shadowBox, shadow, player } = sample
    if (frameBox === null || shadowBox === null)
      throw new Error('枠か影の箱を測れていないフレームがある')
    if (shadow === null || player === null)
      throw new Error('影か主人公の transform を行列で読めないフレームがある')
    const sprite = spriteBoxOf(sample, cell)
    const standingTop = sprite.top + (shadow.y - player.y)
    const topOut = sprite.top < Math.min(frameBox.top, standingTop) - EDGE_PX
    const sidesOut = !withinFrame({ ...sprite, top: frameBox.top }, frameBox)
    const shadowOut = !withinFrame(shadowBox, frameBox)
    if (!topOut && !sidesOut && !shadowOut) return []
    const cellsBelowTop = (top: number) => Math.round(((top - frameBox.top) / cell) * 100) / 100
    return [
      {
        at: sample.at,
        topOut,
        sidesOut,
        shadowOut,
        spriteTop: cellsBelowTop(sprite.top),
        standingTop: cellsBelowTop(standingTop),
      },
    ]
  })

// 立っているだけで絵が枠の上辺を越える所を飛んだフレーム(上の検査が本当にその所を見たかの対照)
export const overTopWhenStanding = (frames: readonly FrameSample[], cell: number) =>
  frames.filter(sample => {
    const { frameBox } = sample
    if (frameBox === null) throw new Error('枠の箱を測れていないフレームがある')
    const lifted = groundOf(sample, cell).y - drawnOf(sample, cell).y
    return spriteBoxOf(sample, cell).top + lifted * cell < frameBox.top - EDGE_PX
  })

// 直線 from→to が上を通る、歩いては立てないマス(ワールドの配置から求める)
export const blockedOnSegment = (world: World, from: Point, to: Point): Cell[] => {
  const steps = 256
  const found = new Map<string, Cell>()
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const cell = cellUnder({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    if (!isWalkable(world, cell)) found.set(`${cell.x},${cell.y}`, cell)
  }
  return [...found.values()]
}

// 保存位置が変わった順の (ワールド, マス)。保存は到着したマスとワープの先でだけ走るので、到着の並びになる
export const savedCells = (samples: readonly FrameSample[]): Saved[] => {
  const visited: Saved[] = []
  for (const { saved } of samples) {
    if (saved === null) continue
    const parsed = JSON.parse(saved) as Saved
    const last = visited.at(-1)
    const same =
      last !== undefined &&
      last.worldId === parsed.worldId &&
      last.cell.x === parsed.cell.x &&
      last.cell.y === parsed.cell.y
    if (same) continue
    visited.push({ worldId: parsed.worldId, cell: { x: parsed.cell.x, y: parsed.cell.y } })
  }
  return visited
}

// 同じワールドの中で 1 回飛んだ記録の区切り。before は飛ぶ直前、landed は降りた後の最初のフレーム
export type FlightFrames = { before: FrameSample; flying: FrameSample[]; landed: FrameSample }
export const flightOf = (samples: readonly FrameSample[]): FlightFrames => {
  const first = samples.findIndex(s => s.flying === 'true')
  const last = samples.findLastIndex(s => s.flying === 'true')
  expect(first, '飛ぶ前から記録し、飛ぶフレームを写せている').toBeGreaterThan(0)
  const flying = samples.slice(first, last + 1)
  const gaps = flying.filter(s => s.flying !== 'true')
  expect(gaps, '飛んでいる間が途切れずに 1 回だけ続く').toEqual([])
  const landed = samples[last + 1]
  if (landed === undefined) throw new Error('降りた後のフレームを記録していない')
  return { before: samples[first - 1], flying, landed }
}

// 飛ぶ間のフレームのうち hit に当たったもの。index は飛ぶ間の何枚目か(0 が飛び立った最初のフレーム)で、
// 落ちた時に「飛び立ち直後の 1 枚だけ残った」のか「途中からずっと出ていた」のかを読み分けられるように添える
export type FlyingHit = { index: number; at: number; bubbles: number; dialogs: number }
export const flyingHits = (flying: readonly FrameSample[], hit: (sample: FrameSample) => boolean) =>
  flying.flatMap((sample, index): FlyingHit[] => {
    if (!hit(sample)) return []
    return [{ index, at: sample.at, bubbles: sample.bubbles, dialogs: sample.dialogs }]
  })

// 当たったフレームの index と at をメッセージの後ろへ書き足す。当たりが無ければ label のまま
export const hitsNote = (
  label: string,
  flying: readonly FrameSample[],
  hits: readonly FlyingHit[]
) => {
  if (hits.length === 0) return label
  const where = hits.map(h => `index ${h.index} at ${h.at.toFixed(1)}ms`).join('・')
  return `${label}(飛ぶ ${flying.length} フレームのうち ${where})`
}
