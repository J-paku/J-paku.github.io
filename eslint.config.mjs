import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// バレル禁止(全ファイル共通)。レイヤー override でも rule 全体が置き換わるため毎回同梱する
const BARREL_PATHS = [
  {
    name: '.',
    message: "同一フォルダのバレルインポートは './index' を使用してください",
  },
  {
    name: '..',
    message: "親フォルダの暗黙バレルインポートは禁止。'@/<絶対パス>' を使用してください",
  },
]

// content の実データ(ja・ko・world)を指す指定子。型定義 content/types は対象外
const CONTENT_DATA_REGEX = '^@content/(?!types/)'

// レイヤー境界 rule を組み立てる。group は禁止する import 指定子の glob、
// gateContent=true なら content 実データの直接 import も併せて禁止する
const layerRule = (group, message, gateContent = false) => {
  const patterns = []
  if (group.length > 0) patterns.push({ group, message })
  if (gateContent) patterns.push({ regex: CONTENT_DATA_REGEX, message })
  return ['error', { paths: BARREL_PATHS, patterns }]
}

const eslintConfig = [
  {
    // ビルド成果物・生成ファイルを除外
    ignores: [
      '.next/**',
      'out/**',
      'dist/**',
      'node_modules/**',
      '.claude/**',
      'src/_v1-pages/**',
      'next-env.d.ts',
    ],
  },
  // parser・browser globals・@typescript-eslint plugin と recommended は 16 の next 設定が同梱するため個別指定を削除
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // 静的エクスポート（images.unoptimized）のため next/image は最適化されず利点なし。生 img を許可
      '@next/next/no-img-element': 'off',
      // App Router のルートレイアウトに置く Google Fonts の <link> を Pages Router 前提で誤検知するため無効化
      '@next/next/no-page-custom-font': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // バレルインポート禁止: from '.' → from './index' を強制
      'no-restricted-imports': ['error', { paths: BARREL_PATHS }],
      // 村の rAF ループ・入力フックは ref.current を直接書き換える設計(VillagePage/AGENTS.md 5番)のため無効化
      'react-hooks/immutability': 'off',
      // React Compiler は使わないため警告に留め、次の整理対象として残す
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // "react-hooks/exhaustive-deps": "off",
    },
  },
  // ---- レイヤー境界(下位→上位の逆参照を lint で落とす) ----
  // 許可方向: utils ← lib ← hooks ← components ← app / content は src を参照しない
  // 型定義(content/types)は全レイヤーから参照可。実データ(content/ja・ko・world)は src/lib/content だけが読む
  {
    files: ['src/utils/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/lib/**', '@/hooks/**', '@/components/**', '@/app/**'],
        'utils は純粋関数のみ。lib・hooks・components・content(型を除く) を import しない',
        true
      ),
    },
  },
  {
    // content の入口は src/lib/content の一箇所だけ(不変ルール2の機械化)。他の lib は @content 直接参照禁止
    files: ['src/lib/**'],
    ignores: ['src/lib/content/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/hooks/**', '@/components/**', '@/app/**'],
        "lib は hooks・components・app を import しない。content は '@/lib/content/read' 経由",
        true
      ),
    },
  },
  {
    files: ['src/lib/content/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/hooks/**', '@/components/**', '@/app/**'],
        'lib は hooks・components・app を import しない'
      ),
    },
  },
  {
    files: ['src/hooks/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/components/**', '@/app/**'],
        'hooks は components・app・content を import しない',
        true
      ),
    },
  },
  {
    files: ['src/components/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/app/**'],
        'components は app・content を import しない',
        true
      ),
    },
  },
  {
    files: ['src/app/**'],
    rules: {
      'no-restricted-imports': layerRule(
        [],
        "app は content を直接 import しない。'@/lib/content/read' 経由で読む",
        true
      ),
    },
  },
  {
    files: ['content/**'],
    rules: {
      'no-restricted-imports': layerRule(
        ['@/utils/**', '@/lib/**', '@/hooks/**', '@/components/**', '@/app/**'],
        'content はデータ。src を import しない(型は content/types に置く)'
      ),
    },
  },
]

export default eslintConfig
