import { defineConfig, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { globSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import nextConfig from './next.config'

// 画面(コンテナ)の props は node でしか組めない(fs・zlib・crypto を使う)ので、各コンテナの隣の container.fixture.ts が
// テストの前に node で組んで provide する。コンテナを足すたびにここを直さずに済むよう、src の下から全部拾う。
// 置けるのはコンテナの一覧(scripts/container-dirs.mjs)のフォルダだけで、ほかに置くと npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とす(ここは全部拾うので、黙って走らせないため)。
// 探す起点はこのファイルの場所にする(走らせた場所で拾う物が変わらないように)。順は名前で並べて、走るたびに揃える
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const CONTAINER_FIXTURES = globSync('src/**/container.fixture.ts', { cwd: ROOT })
  .sort()
  .map(file => fileURLToPath(new URL(file, import.meta.url)))
// 1 つも拾えないと globalSetup が空のまま進み、テストの inject が undefined を受けて分かりにくい所で落ちる。
// パターンや起点の誤りで黙って 0 個になるのを、設定を読む時点で止める
if (CONTAINER_FIXTURES.length === 0) {
  throw new Error(`src の下に container.fixture.ts が 1 つも見つからない(探した起点: ${ROOT})`)
}

// 統合テスト(Vitest Browser Mode)の設定。画面単位のコンポーネントを実際の Chromium で、ビルド無しで描く
// (docs/decisions/0016-testing-trophy-browser-integration.md)。
// 単体の vitest.config.ts と別のファイルにするのは、変異テスト(stryker.config.mjs)が vitest.config.ts を読むため。
// Stryker の Browser Mode 対応は未実測なので、変異テストは node と happy-dom の単体だけで回す(ADR 0016)。
// 単体の設定は *.browser.test.{ts,tsx} を exclude で外し、ここはコンテナの隣の container.browser.test.tsx だけを拾う(ADR 0017 の D5)。
// ほかの名前の *.browser.test.ts・*.browser.test.tsx はどちらの設定にも拾われないが、npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とすので、走らないまま黙って残ることは無い
export default defineConfig({
  // next/link などは Next のビルドが process.env.X を値へ置き換える前提で書かれていて、ブラウザには process が無い。
  // ここで process.env の中身を決める。中身は Next のビルドが next.config から入れる値のうち、テストの結果に表れるものだけ:
  //   __NEXT_TRAILING_SLASH: next.config の trailingSlash(next/dist/build/define-env.js と同じ元)。無いと next/link が
  //   href の末尾のスラッシュを落とし、配信物と違う href になる
  // 先に束ねた依存(next/link)の中の process.env.X はこの置き換えを受けない。それでも効くのは、Vite がブラウザで最初に読む
  // /@vite/env(vite/dist/client/env.mjs)が define の値を globalThis.process.env へ書き、束の中の process.env.X が
  // 実行時にそれを読むため(2026-10-14 の実測。テストごとに process を差し替えなくてよい)
  define: {
    'process.env': JSON.stringify({ __NEXT_TRAILING_SLASH: nextConfig.trailingSlash }),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
      // 下の globalSetup が node で content を読む(src/lib/content/read.ts)。server-only は react-server 以外の
      // 条件では import しただけで投げるので、中身の無い版(パッケージ同梱の empty.js)へ向ける。単体テストの vi.mock と同じ扱い
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['src/**/container.browser.test.tsx'],
    exclude: [...configDefaults.exclude, '**/.claude/**', 'tests/**'],
    // 上で拾った container.fixture.ts を、テストの前に node で走らせる
    globalSetup: CONTAINER_FIXTURES,
    // 落ちた時の画面の写しは、既定だとテストの隣(src の中)とリポジトリ直下に出る。git が無視する test-results/ へ寄せる
    attachmentsDir: 'test-results/vitest-attachments',
    browser: {
      enabled: true,
      // 既定は process.env.CI なので、手元(WSL)で窓を開こうとしないよう明示する
      headless: true,
      // TZ=UTC(package.json の scripts と vitest.config.ts の env)は node のプロセスにしか効かない。
      // ブラウザの時間帯は context で別に固定し、機器の時間帯に結果を左右させない
      provider: playwright({ contextOptions: { timezoneId: 'UTC' } }),
      instances: [{ browser: 'chromium' }],
      screenshotDirectory: 'test-results/vitest-screenshots',
    },
    // 測るのは --coverage を付けたときだけ。フックもここで測る(単体の設定はフックを外す)。
    // フックのファイル別100%はまだ掛けない。統合テストへ移し終えたフォルダから掛ける(ADR 0016)
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.fixture.ts', 'src/**/*.test-helper.ts'],
      reporter: ['text-summary'],
      reportsDirectory: 'coverage/integration',
      // 2026-10-14の実測(statements 42.72%・branches 31.8%・functions 45.09%・lines 45.61%)から2pt引いて切り捨てた値。
      // 測る対象は src の全部で、統合テストが通らない純粋モジュール(単体の門で100%に固めている)も分母に入るので低く見える。
      // 目標値ではなく、統合テストを消したり使われないコードを増やしたりしたときに落とすための床(ADR 0017)
      thresholds: {
        statements: 40,
        branches: 29,
        functions: 43,
        lines: 43,
      },
    },
  },
})
