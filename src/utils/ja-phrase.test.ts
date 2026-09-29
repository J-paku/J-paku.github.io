// 日本語の文節分割(segmentJapanese)の単体テスト。区切り位置はBudouXのモデルが決めるので、
// ここでは結果の形(繋ぎ直すと元の文へ戻る・空文字列)と、同じ文字列を分割し直さない覚えを見る
import { afterEach, describe, expect, it, vi } from 'vitest'
// BudouXの初回読み込みは重く(WSLの/mnt/c上で4〜6秒)、最初のテストの中で払うと5秒の時間枠を越えて落ちる。
// ファイルの読み込み時に1回済ませ、各テストの動的importは読み込み済みのものを受け取るだけにする
import 'budoux'

// 分割の覚えはモジュール変数のMapにある。テストごとに読み込み直し、空の覚えから始める。
// budouxも読み込み直した後の同じものを掴み、Parserのparseが呼ばれた回数を数えられるようにする
const loadFresh = async () => {
  vi.resetModules()
  const { Parser } = await import('budoux')
  const parse = vi.spyOn(Parser.prototype, 'parse')
  const { segmentJapanese } = await import('./ja-phrase')
  return { segmentJapanese, parse }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('segmentJapanese', () => {
  it('文を文節に区切る(BudouXの説明にある例文)', async () => {
    const { segmentJapanese } = await loadFresh()
    expect(segmentJapanese('今日は天気です。')).toEqual(['今日は', '天気です。'])
  })

  it('空文字列は例外を投げず空の配列を返す', async () => {
    const { segmentJapanese } = await loadFresh()
    expect(segmentJapanese('')).toEqual([])
  })

  // PhraseTextは文節の間に<wbr>を挟んで描くだけなので、繋ぎ直して元へ戻らなければ画面の文字が欠ける。
  // utilsのテストはlintの層境界でcontentを読めないため、紹介文に実際に出る書き方(英数字・記号・空白の混在)を写して使う
  it('英数字や記号の混ざる文も、文節を繋ぎ直すと元の文へ戻り空の文節を含まない', async () => {
    const { segmentJapanese } = await loadFresh()
    const texts = [
      'オフィスの座席とチーム配置を、指の操作でそのまま扱う',
      'Next.js 16で作った静的サイトを、GitHub Pagesへ配る',
      '導入から2か月、月間コミットは60件から169件(2.8倍)になった。',
    ]
    for (const text of texts) {
      const chunks = segmentJapanese(text)
      expect(chunks.join('')).toBe(text)
      expect(chunks.every(chunk => chunk.length > 0)).toBe(true)
    }
  })

  it('同じ文字列の2回目は分割し直さず、1回目と同じ配列を返す', async () => {
    const { segmentJapanese, parse } = await loadFresh()
    const first = segmentJapanese('今日は天気です。')
    const second = segmentJapanese('今日は天気です。')
    expect(second).toBe(first)
    expect(parse).toHaveBeenCalledTimes(1)
  })

  // 覚えの鍵を取り違えると(鍵を固定・最後の結果を返す等)、別の文に前の文の文節が出る
  it('違う文字列は前の結果を使い回さずに分割する', async () => {
    const { segmentJapanese, parse } = await loadFresh()
    segmentJapanese('今日は天気です。')
    const other = segmentJapanese('明日は雨です。')
    expect(other.join('')).toBe('明日は雨です。')
    expect(parse).toHaveBeenCalledTimes(2)
  })

  // ブラウザ向けの束ではlinkedomの代わりにlinkedom-browser-stubが入り、そこは「文節分割はDOMを使わない」
  // ことを前提にしている。DOMParserの無いnode環境で分割できることで、その前提を押さえる
  it('DOMParserの無い環境でも分割できる', async () => {
    expect(globalThis.DOMParser).toBeUndefined()
    const { segmentJapanese } = await loadFresh()
    expect(segmentJapanese('今日は天気です。')).toEqual(['今日は', '天気です。'])
  })
})
