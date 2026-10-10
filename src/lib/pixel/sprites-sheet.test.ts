// 天気のシートの鍵(buildWeatherSprites)と、夜の差し替え表を基準へ重ねる見張り(mergeNightArt)のテスト
import { vi } from 'vitest'

// sprites.ts は読み込む時に夜の差し替え表を基準の表へ重ね、合わない鍵があればその場で落とす。
// 読み込みの失敗をテストの失敗として拾えるよう、どのテストも sprites.ts をテストの中で読み込み直す
const loadSprites = async () => {
  vi.resetModules()
  return import('./sprites')
}

describe('buildWeatherSprites', () => {
  it('雨・雪とも 2 コマを 1 枚ずつ焼き、鍵は天気の名前とコマの番号', async () => {
    const { buildWeatherSprites } = await loadSprites()
    const { rain, snow } = buildWeatherSprites()
    expect([...rain, ...snow].map(sheet => sheet.index)).toEqual([
      { 'rain-0': 0 },
      { 'rain-1': 0 },
      { 'snow-0': 0 },
      { 'snow-1': 0 },
    ])
  })
})

describe('夜の差し替え表', () => {
  afterEach(() => {
    vi.doUnmock('./structures')
  })

  it('差し替える鍵がすべて基準にあれば読み込みは通り、夜の表は基準と同じ鍵を同じ順で持つ', async () => {
    const { SPRITE_ARTS, SPRITE_NIGHT_ARTS } = await loadSprites()
    expect(Object.keys(SPRITE_NIGHT_ARTS)).toEqual(Object.keys(SPRITE_ARTS))
  })
  it('基準に無い鍵が紛れ込んだら、焼く前に鍵の名前を添えて落とす', async () => {
    vi.resetModules()
    vi.doMock('./structures', async importOriginal => ({
      ...(await importOriginal<typeof import('./structures')>()),
      structureNightArt: { 'no-such-key': [] },
    }))
    await expect(import('./sprites')).rejects.toThrow(
      '夜の素材に基準へ無い鍵は足せません(no-such-key)'
    )
  })
})
