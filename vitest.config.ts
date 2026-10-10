import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import { COVERAGE_TARGETS } from './scripts/gate-targets.mjs'

// 1ファイルを文・分岐・関数・行のすべてで100%に固定するしきい値(glob ごとのしきい値では `100: true` と同じ意味)
const FULL_COVERAGE = { statements: 100, branches: 100, functions: 100, lines: 100 }

// 純粋モジュールはファイルごとに100%で固定する。人がコードを読まない代わりに、テストが一度も通らない行・分岐を残さない。
// 対象は一覧を手で並べず、scripts/gate-targets.mjs の COVERAGE_TARGETS(純粋モジュールの置き場の全部 = 変異テストの対象と、
// 変異テストから外したデータの flight-art.ts・palette.ts)を使う。新しい純粋モジュールは置いた時点で対象になる
// (docs/decisions/0014-gate-all-pure-modules.md)。
// 一覧は src をたどって作るので実在しないパスは入らない。名指しで外したパスが実在しないときは、gate-targets.mjs を読み込む時点で落ちる

// 既定の環境は node(純粋関数と src/lib の入口)。ファイル先頭に `// @vitest-environment happy-dom` を書いたテスト
// (コンポーネントの *.test.tsx と、DOM を読む・書く/DOMParser を使う *.test.ts)だけが happy-dom で走る。
// 既定を替えないのは、単体テストを書かれたとおり DOM の無い node で走らせ続けるため
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    // 実行する機器のタイムゾーンに結果を左右させない。JST の機器では (getUTCHours() + 9) % 24 を
    // getHours() に置き換えても(+9 を落として機器の時刻を使っても)同じ時刻になり気づけないため、
    // ここで UTC に固定する。なお getUTCHours() → getHours() の取り違えだけ(+9 は残す)は
    // UTC 固定下では値が変わらず検出できない(実測)
    // (package.json 側の TZ=UTC は npm 経由の入口、こちらは npx vitest を直接叩く入口を塞ぐ)
    env: { TZ: 'UTC' },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, '**/.claude/**', 'src/_v1-pages/**', 'tests/**'],
    // 測るのは--coverageを付けたとき(npm run test:coverage、CIはこちら)だけ。npm run testは今までどおり速く回す
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['src/**/*.{ts,tsx}'],
      // hooks/ 配下は単体テストを置かない層なので測らない。フックの動きは E2E が見る
      // (hooks/ にテストを置いていないかは scripts/check-test-boundary.mjs が検査する)
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.fixture.ts',
        'src/**/*.test-helper.ts',
        'src/**/hooks/**',
      ],
      reporter: ['text-summary'],
      reportsDirectory: 'coverage',
      // 2026-10-11の実測(statements 85.28%・branches 85.62%・functions 79.24%・lines 84.49%)から2pt引いて切り捨てた値。
      // 目標値ではなく、テストを消したり使われないコードを増やしたりしたときに落とすための床
      thresholds: {
        statements: 83,
        branches: 83,
        functions: 77,
        lines: 82,
        // ファイル別100%(一覧は scripts/gate-targets.mjs の COVERAGE_TARGETS)
        ...Object.fromEntries(COVERAGE_TARGETS.map(file => [file, FULL_COVERAGE])),
      },
    },
  },
})
