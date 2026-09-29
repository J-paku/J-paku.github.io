import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// 既定の環境は node(純粋関数と src/lib の入口)。DOM が要るコンポーネントのテスト(*.test.tsx)だけが
// ファイル先頭の `// @vitest-environment happy-dom` で自分の環境を切り替える。
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
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.fixture.ts', 'src/**/*.test-helper.ts'],
      reporter: ['text-summary'],
      reportsDirectory: 'coverage',
      // 2026-09-29の実測(statements 57.34%・branches 61.11%・functions 56.62%・lines 57.14%)から2pt引いて切り捨てた値。
      // 目標値ではなく、テストを消したり使われないコードを増やしたりしたときに落とすための床
      thresholds: { statements: 55, branches: 59, functions: 54, lines: 55 },
    },
  },
})
