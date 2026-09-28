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
  },
})
