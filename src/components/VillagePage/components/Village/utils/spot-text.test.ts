// 地点の文言の引き先(placeName・arriveSpeech・talkLabelOf・headToSpeech)のテスト。
// actionを持つ地点(時計・釣り場)はtext.stopsを持たないので、専用の欄から引けることを見る
import { describe, expect, it, vi } from 'vitest'
import type { Spot, StopText, VillageText } from '@content/types/world'
import { arriveSpeech, headToSpeech, placeName, talkLabelOf } from './spot-text'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const text = readVillageText('ja')
const spots = Object.values(readWorldSet().worlds).flatMap(world => world.spots)

const pick = (label: string, test: (spot: Spot) => boolean): Spot => {
  const spot = spots.find(test)
  if (spot === undefined) throw new Error(`条件に合う地点が無い: ${label}`)
  return spot
}

// actionの無い地点(text.stopsを持つ地点)から、文言が条件に合うものを選ぶ
const pickStop = (label: string, test: (stop: StopText) => boolean): Spot =>
  pick(label, s => s.action === undefined && test(text.stops[s.id]))

const clockSpot = pick('時計', s => s.action === 'clock')
const fishingSpot = pick('釣り場', s => s.action === 'fishing')
const withArrive = pickStop('到着の文言あり', stop => stop.arrive !== undefined)
const withoutArrive = pickStop('到着の文言なし', stop => stop.arrive === undefined)
const withTalk = pickStop('会話ボタンの文言あり', stop => stop.talk !== undefined)
const withoutTalk = pickStop('会話ボタンの文言なし', stop => stop.talk === undefined)

// 置換の結果を具体値で見るため、雛形だけを見分けやすい文字列に差し替える
const probe: VillageText = { ...text, arriveAt: '到着:{place}!', headTo: '次は{place}へ' }

// 雛形に{place}を2つ持たせた文言
const twice: VillageText = {
  ...text,
  arriveAt: '{place}です。{place}!',
  headTo: '次は{place}。{place}へ',
}

// 到着の文言を持たない地点の場所名だけを差し替えた文言。
// 場所名に置換の記法($&・$1・$$)が含まれても、そのまま入るかを見る
const withPlace = (place: string): VillageText => ({
  ...probe,
  stops: { ...text.stops, [withoutArrive.id]: { ...text.stops[withoutArrive.id], place } },
})

const specialPlaces = ['a$&b', 'a$1b', 'a$$b']

describe('placeName', () => {
  it('時計の地点は卓上時計の地点名を返す', () => {
    expect(placeName(text, clockSpot)).toBe(text.clock.place)
  })

  it('釣り場の地点はtext.stopsを引かず、釣りの地点名を返す', () => {
    expect(text.stops[fishingSpot.id]).toBeUndefined()
    expect(placeName(text, fishingSpot)).toBe(text.fishing.place)
  })

  it('actionの無い地点はtext.stopsの場所名を返す', () => {
    expect(placeName(text, withoutArrive)).toBe(text.stops[withoutArrive.id].place)
  })

  it('全地点で空でない地点名を引ける(ja・ko)', () => {
    for (const locale of ['ja', 'ko'] as const) {
      const localized = readVillageText(locale)
      for (const spot of spots) {
        expect(placeName(localized, spot)).not.toBe('')
      }
    }
  })
})

describe('arriveSpeech', () => {
  it('時計の地点は時計の前に立った時の吹き出しを返す', () => {
    expect(arriveSpeech(text, clockSpot)).toBe(text.clock.arrive)
  })

  it('地点ごとの到着の文言があれば、arriveAtより優先して返す', () => {
    expect(arriveSpeech(probe, withArrive)).toBe(text.stops[withArrive.id].arrive)
  })

  it('地点ごとの到着の文言が無ければ、arriveAtの{place}に場所名を入れる', () => {
    const place = text.stops[withoutArrive.id].place
    expect(arriveSpeech(probe, withoutArrive)).toBe(`到着:${place}!`)
  })

  it('実データのarriveAtでも{place}が残らない', () => {
    const speech = arriveSpeech(text, withoutArrive)
    expect(speech).toContain(text.stops[withoutArrive.id].place)
    expect(speech).not.toContain('{place}')
  })

  it('arriveAtに{place}が2つあれば、両方に場所名を入れる', () => {
    const place = text.stops[withoutArrive.id].place
    expect(arriveSpeech(twice, withoutArrive)).toBe(`${place}です。${place}!`)
  })

  it.each(specialPlaces)('場所名%sの$記法を置換の記法とみなさず、そのまま入れる', place => {
    expect(arriveSpeech(withPlace(place), withoutArrive)).toBe(`到着:${place}!`)
  })
})

describe('talkLabelOf', () => {
  it('時計の地点は時計の会話ボタンの文言を返す', () => {
    expect(talkLabelOf(text, clockSpot)).toBe(text.clock.talk)
  })

  it('地点ごとの会話ボタンの文言があれば、それを返す', () => {
    expect(talkLabelOf(text, withTalk)).toBe(text.stops[withTalk.id].talk)
    expect(talkLabelOf(text, withTalk)).not.toBe(text.talk)
  })

  it('地点ごとの会話ボタンの文言が無ければ、共通の「話を聞く」を返す', () => {
    expect(talkLabelOf(text, withoutTalk)).toBe(text.talk)
  })
})

describe('headToSpeech', () => {
  it('actionの無い地点はheadToの{place}に場所名を入れる', () => {
    expect(headToSpeech(probe, withArrive)).toBe(`次は${text.stops[withArrive.id].place}へ`)
  })

  it('時計の地点は卓上時計の地点名を入れる', () => {
    expect(headToSpeech(probe, clockSpot)).toBe(`次は${text.clock.place}へ`)
  })

  it('釣り場の地点も落ちずに釣りの地点名を入れる', () => {
    expect(headToSpeech(probe, fishingSpot)).toBe(`次は${text.fishing.place}へ`)
  })

  it('実データのheadToでも全地点で{place}が残らない', () => {
    for (const spot of spots) {
      expect(headToSpeech(text, spot)).not.toContain('{place}')
    }
  })

  it('headToに{place}が2つあれば、両方に場所名を入れる', () => {
    const place = text.stops[withoutArrive.id].place
    expect(headToSpeech(twice, withoutArrive)).toBe(`次は${place}。${place}へ`)
  })

  it.each(specialPlaces)('場所名%sの$記法を置換の記法とみなさず、そのまま入れる', place => {
    expect(headToSpeech(withPlace(place), withoutArrive)).toBe(`次は${place}へ`)
  })
})
