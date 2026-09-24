// out/ を静的配信して実際のクリック・キー操作で導線を検証する
import { defineConfig, devices } from '@playwright/test'

// 同じ機械で2つのセッション・worktree が同時に E2E を回すと、先にポートを握った側のビルドを
// 互いに検査してしまうので、E2E_PORT でポートを分けられるようにする
const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'tests',
  // 走り出す前に、既定 :4173(E2E_PORT で変えられる)を配っているのが「このチェックアウトの out/」かどうかを 1 回だけ照合する。
  // 下の reuseExistingServer は切らない(切ると他プロセスがポートを握っている間 E2E が走らない)代わりに、
  // 別の worktree・別セッションのビルドを検査して全部緑になる事故をここで止める
  globalSetup: './tests/global-setup.ts',
  timeout: 30_000,
  // 1 ファイルの中のテストも別々のワーカーへ配る。どのテストも自分の context で村を開き、
  // beforeAll・serial・テストをまたぐ可変状態を持たないので順番に依存しない。
  // 配らないと 5 分かかる journey.spec が 1 ワーカーで直列に走り、全体の所要がそこで決まる
  fullyParallel: true,
  // 手元の既定(論理コア数の半分)は 16 スレッドの機械で 8 本になる。村の E2E は歩く間合いを実時間で
  // 刻む(150ms 押して 256ms で 1 マス)ので、ブラウザを並べすぎて詰まらせないよう手元は 4 本で止める。
  // CI はランナーの既定のまま(同時に走る本数は配り方を変える前と同じ)
  workers: process.env.CI ? undefined : 4,
  // CI では test.only の混入を落とし、フレーキーな失敗は1回だけ再試行する
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: BASE_URL },
  webServer: {
    command: `npx serve out -l ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
