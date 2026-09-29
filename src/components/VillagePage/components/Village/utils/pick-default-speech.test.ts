// 会話地点でも目的地でもない時の既定文(pickDefaultSpeech)のテスト。
// 屋内は出口案内、屋外は操作案内で、屋外だけがタッチかどうかで文言を替える
import { describe, expect, it, vi } from 'vitest'
import type { VillageText, World } from '@content/types/world'
import { pickDefaultSpeech } from './pick-default-speech'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const worlds = Object.values(readWorldSet().worlds)
const worldOf = (kind: World['kind']): World => {
  const world = worlds.find(w => w.kind === kind)
  if (world === undefined) throw new Error(`kindが${kind}のワールドが無い`)
  return world
}
const interior = worldOf('interior')
const exterior = worldOf('exterior')

// 3つの文言を互いに違う値へ置き換える。実データで偶然同じ文になっても取り違えを見逃さない
const text: VillageText = {
  ...readVillageText('ja'),
  hint: 'キーボードの操作案内',
  hintTouch: 'タッチの操作案内',
  exitHint: '出口の案内',
}

describe('pickDefaultSpeech', () => {
  it('屋外でタッチでなければキーボード向けの操作案内', () => {
    expect(pickDefaultSpeech(exterior, text, false)).toBe('キーボードの操作案内')
  })

  it('屋外でタッチならスティック・A向けの操作案内', () => {
    expect(pickDefaultSpeech(exterior, text, true)).toBe('タッチの操作案内')
  })

  it('屋内はタッチでなければ出口案内', () => {
    expect(pickDefaultSpeech(interior, text, false)).toBe('出口の案内')
  })

  it('屋内はタッチでも出口案内のまま(タッチの判定より屋内の判定が先)', () => {
    expect(pickDefaultSpeech(interior, text, true)).toBe('出口の案内')
  })

  it('置き換えない実データのja文言でも、3つの場合がそれぞれ別の文になる', () => {
    const ja = readVillageText('ja')
    const picked = [
      pickDefaultSpeech(interior, ja, false),
      pickDefaultSpeech(exterior, ja, false),
      pickDefaultSpeech(exterior, ja, true),
    ]
    expect(picked).toEqual([ja.exitHint, ja.hint, ja.hintTouch])
    expect(new Set(picked).size).toBe(3)
  })
})
