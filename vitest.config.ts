import { existsSync } from 'node:fs'
import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// 1ファイルを文・分岐・関数・行のすべてで100%に固定するしきい値(glob ごとのしきい値では `100: true` と同じ意味)
const FULL_COVERAGE = { statements: 100, branches: 100, functions: 100, lines: 100 }

// 新しい純粋モジュールはファイルごとに100%で固定する。人がコードを読まない代わりに、
// テストが一度も通らない行・分岐を残さない。変異テストの対象(stryker.config.mjs の mutate)を
// 足したらここにも並べる。flight-art.ts はドット絵のデータなので変異テストから外し、ここだけで固定する
const FULL_COVERAGE_FILES = [
  'src/lib/village/flight.ts',
  'src/lib/village/flight-curve.ts',
  'src/lib/village/is-moving.ts',
  'src/lib/pixel/flight-art.ts',
  'src/components/VillagePage/components/Village/utils/collect-place-names.ts',
  'src/components/VillagePage/components/Village/utils/enter-world.ts',
  'src/components/VillagePage/components/Village/utils/set-clock-time.ts',
  'src/components/VillagePage/components/Village/utils/plan-travel.ts',
]

// 実在しないパスを並べても、v8 は当てるファイルが無いまま何も言わずに通す(2026-10-10 に実測)。
// 名前の打ち間違いや移動・削除で固定が外れたことに気付けるよう、設定を読む時点で落とす
const missingFullCoverage = FULL_COVERAGE_FILES.filter(
  file => !existsSync(fileURLToPath(new URL(file, import.meta.url)))
)
if (missingFullCoverage.length > 0) {
  throw new Error(
    `vitest.config.ts: ファイル別100%の対象が実在しない: ${missingFullCoverage.join(', ')}`
  )
}

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
      // 2026-10-10の実測(statements 83.73%・branches 83.71%・functions 77.07%・lines 83.34%)から2pt引いて切り捨てた値。
      // 目標値ではなく、テストを消したり使われないコードを増やしたりしたときに落とすための床
      thresholds: {
        statements: 81,
        branches: 81,
        functions: 75,
        lines: 81,
        // ファイル別100%(一覧は上の FULL_COVERAGE_FILES)
        ...Object.fromEntries(FULL_COVERAGE_FILES.map(file => [file, FULL_COVERAGE])),
      },
    },
  },
})
