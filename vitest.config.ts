import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// S1 のテスト対象は純粋関数のみ。DOM 環境は持たない
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
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/.claude/**', 'src/_v1-pages/**', 'tests/**'],
  },
})
