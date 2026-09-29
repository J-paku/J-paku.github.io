// @vitest-environment happy-dom
// 初回描画の前にVillageの根のdata-phaseを実際の段階へ直すインラインスクリプト(PHASE_INIT)のテスト。
// 本文は文字列なので、happy-domの文書に<script>を置き、実行中のスクリプトをその要素に差し替えて走らせる
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHASE_INIT } from './phase-init'

// 焼き込んだ「UTCの時(0〜23)→段階」の表。村は大阪(JST=UTC+9)なので、JSTの5・7・17・19時が境目になる。
// dayPhaseAtから作ると焼いた側と同じ関数で期待値も作ることになるので、手で書き写す
const EXPECTED_TABLE = [
  // UTC0〜7時 = JST9〜16時
  ...Array<string>(8).fill('day'),
  // UTC8〜9時 = JST17〜18時
  'dusk',
  'dusk',
  // UTC10〜19時 = JST19〜翌4時
  ...Array<string>(10).fill('night'),
  // UTC20〜21時 = JST5〜6時
  'dawn',
  'dawn',
  // UTC22〜23時 = JST7〜8時
  'day',
  'day',
]

const tableOf = (script: string): string[] => {
  const match = script.match(/var p='([^']*)'/)
  if (match === null) throw new Error('スクリプトに段階の表が見つからない')
  return match[1].split(',')
}

// 本文を差し込んだ文書を作り、置いた<script>を返す
const mount = (html: string): HTMLScriptElement => {
  document.body.innerHTML = html
  const script = document.querySelector('script')
  if (script === null) throw new Error('文書に<script>が無い')
  return script
}

// 実行中のスクリプト(document.currentScript)をscriptに差し替えて本文を走らせる
const run = (script: HTMLScriptElement | null) => {
  vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
  new Function(PHASE_INIT)()
}

const phaseOf = (id: string): string | null =>
  document.getElementById(id)?.getAttribute('data-phase') ?? null

const setUtc = (hour: number, minute = 0) => {
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, hour, minute)))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('PHASE_INIT', () => {
  it('24時間ぶんの段階の表をUTCの時の順に焼き込んでいる', () => {
    expect(tableOf(PHASE_INIT)).toEqual(EXPECTED_TABLE)
  })

  // 書き換えたことが分かるよう、どの段階でもない空の値から始める
  it.each([
    [21, 'dawn'],
    [3, 'day'],
    [9, 'dusk'],
    [13, 'night'],
  ] as const)('UTC%i時には直前の根のdata-phaseを%sへ書き換える', (utcHour, expected) => {
    setUtc(utcHour)
    run(mount(`<div id='root' data-phase=''></div><script></script>`))
    expect(phaseOf('root')).toBe(expected)
  })

  // 段階は時だけで決まる。境目の直前(59分)と境目ちょうどを対で並べる
  it.each([
    [19, 59, 'night'],
    [20, 0, 'dawn'],
    [21, 59, 'dawn'],
    [22, 0, 'day'],
    [7, 59, 'day'],
    [8, 0, 'dusk'],
    [9, 59, 'dusk'],
    [10, 0, 'night'],
  ] as const)('UTC%i時%i分は%s', (utcHour, minute, expected) => {
    setUtc(utcHour, minute)
    run(mount(`<div id='root' data-phase='day'></div><script></script>`))
    expect(phaseOf('root')).toBe(expected)
  })

  // 静的HTMLでは<Village>と<script>の間に改行や空白のテキストが挟まり得る
  it('間に空白のテキストがあっても直前の要素を根として書き換える', () => {
    setUtc(13)
    run(mount(`<div id='root' data-phase='day'></div>\n  <script></script>`))
    expect(phaseOf('root')).toBe('night')
  })

  it('直前の要素がdata-phaseを持たなければ何も書かず、それより前の要素にも触らない', () => {
    setUtc(13)
    run(
      mount(`<div id='earlier' data-phase='day'></div><div id='previous'></div><script></script>`)
    )
    expect(document.getElementById('previous')?.hasAttribute('data-phase')).toBe(false)
    expect(phaseOf('earlier')).toBe('day')
  })

  it('直前に要素が無ければ例外を投げずに何もしない', () => {
    setUtc(13)
    const script = mount(`<script></script><div id='after' data-phase='day'></div>`)
    expect(() => run(script)).not.toThrow()
    expect(phaseOf('after')).toBe('day')
  })

  it('実行中のスクリプトが取れなければ例外を投げない', () => {
    setUtc(13)
    mount(`<div id='root' data-phase='day'></div><script></script>`)
    expect(() => run(null)).not.toThrow()
    expect(phaseOf('root')).toBe('day')
  })

  // 描画の前に走るので、ここで投げると後続の描画まで止まる
  it('書き換えの途中で投げた例外は外へ漏らさない', () => {
    setUtc(13)
    const script = mount(`<div id='root' data-phase='day'></div><script></script>`)
    const root = document.getElementById('root')
    if (root === null) throw new Error('根が無い')
    vi.spyOn(root, 'setAttribute').mockImplementation(() => {
      throw new Error('書き込めない')
    })
    expect(() => run(script)).not.toThrow()
  })
})
