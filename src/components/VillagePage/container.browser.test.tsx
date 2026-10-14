// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// happy-dom は配置を計算せず ResizeObserver.observe() も実装が無いので、寸法に頼る振る舞いはここで見る。
// 差し替えるのは天気の通信だけ。レイアウト・rAF・ResizeObserver は本物を使う
import { cleanup, render } from '@testing-library/react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import VillagePageContainer from './container'

// 晴れの応答(tests/village.helpers.ts の clear と同じ形)
const CLEAR_WEATHER = { current: { precipitation: 0, snowfall: 0 } }
// Open-Meteo の問い合わせ先の頭(tests/village.helpers.ts の route の OPEN_METEO と同じ範囲)
const OPEN_METEO = 'https://api.open-meteo.com/'

const villageJa = inject('villageJa')

// 利用者に見える枠の大きさ(px)。操作帯のスティックも role=application なので、枠の読み上げ名
// (use-village.ts の hintLabel。ポインタが細かい端末では text.hint)で枠だけを指す
const frameSize = () => {
  const { width, height } = page
    .getByRole('application', { name: villageJa.text.hint })
    .element()
    .getBoundingClientRect()
  return { width, height }
}

// 天気(Open-Meteo)にだけ晴れを返し、ほかの問い合わせは断る。テストが外へ出ていく道を残さない
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const { url } = new Request(input)
      if (url.startsWith(OPEN_METEO)) return Response.json(CLEAR_WEATHER)
      throw new TypeError(`統合テストから外への問い合わせは断る: ${url}`)
    })
  )
})

afterEach(() => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.unstubAllGlobals()
  // 村が本物の sessionStorage へ書いた位置と訪問を消し、何も保存していない状態へ戻す(消し方の正本は preferences.ts)。
  // 歩いた・話した後に残すと、同じページで後に描く村がその位置・訪問から始まる。
  // 今の画面の大きさのテストは歩かず何も書かない(2026-10-14 の実測で消す前から空)が、歩くテストを足したときに漏らさないよう置く
  clearVillageProgress(villageJa.worldSet.id)
})

test('画面の大きさを変えると、枠を新しい整数のマス寸法で 10×9 マスに描き直す', async () => {
  // 前提: ブラウザの時間帯は設定(vitest.integration.config.ts)どおり UTC。機器の時間帯に左右させない
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone, 'ブラウザの時間帯は UTC').toBe('UTC')

  await page.viewport(1280, 720)
  render(<VillagePageContainer {...villageJa} />)
  // 横長の PC: 幅なら 128px、高さなら 80px のマスが取れるが、原寸の上限 64px で止まる
  await expect
    .poll(frameSize, { message: '1280×720 では 64px のマスで 640×576' })
    .toEqual({ width: 640, height: 576 })

  await page.viewport(600, 900)
  // 縦長: 幅で決まり 600 / 10 列 = 60px。描き直さないと 64px のマスの 640×576 のまま残る
  await expect
    .poll(frameSize, { message: '600×900 では 60px のマスで 600×540' })
    .toEqual({ width: 600, height: 540 })
})
