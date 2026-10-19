// import の指定子を、リポジトリ直下からのファイルのパスに解決する(check-layers.mjs が使う)。
// 決まりは tsconfig.json と同じ(paths の @/ は src、@content/ は content、相対パス、moduleResolution: bundler の拡張子と index の省略)。
// ほかのスクリプトも同じ決まりで import の先のファイルを求められるよう、check-layers.mjs から分けてある。
// 判定が壊れていないかは、使う側の自己検査が偽のファイルで確かめる。
//
// ファイルシステムは読まない。在るファイルの集まり(known)は呼ぶ側が渡す(作業ツリーを見るか、偽のファイルで確かめるかは呼ぶ側が決める)。
//
// 使い方: import { resolveImport } from './resolve-import.mjs'
import path from 'node:path'

// リポジトリ直下からのパスの前の方 → 別名(tsconfig.json の paths と同じ)
export const ALIAS_ROOTS = [
  ['src/', '@/'],
  ['content/', '@content/'],
]

// 拡張子と index を省いた指定子に、tsconfig.json(moduleResolution: bundler)と同じ順で足して探す
export const RESOLVE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.d.ts',
  '.js',
  '.jsx',
  '/index.ts',
  '/index.tsx',
  '/index.d.ts',
  '/index.js',
  '/index.jsx',
]

// 指定子が指す、リポジトリ直下からのパス(拡張子と index は省いたまま)。from は import するファイルのリポジトリ直下からのパス。
// @/・@content/・相対パスのほか(パッケージ)は null
export const basePathOf = (from, specifier) => {
  const alias = ALIAS_ROOTS.find(([, name]) => specifier.startsWith(name))
  if (alias !== undefined) return `${alias[0]}${specifier.slice(alias[1].length)}`
  if (/^\.\.?(?:\/|$)/.test(specifier)) return path.posix.join(path.posix.dirname(from), specifier)
  return null
}

// 拡張子と index を省いたパスを、在るファイル(known。リポジトリ直下からのパスの集まり)に当てる(当たらなければ undefined)
export const findFile = (base, known) =>
  RESOLVE_SUFFIXES.map(suffix => `${base}${suffix}`).find(candidate => known.has(candidate))

// import の先のファイル(src か content の中の、リポジトリ直下からのパス)。known は在るファイルの集まり。
// パッケージ・src と content の外・式で組んだ指定子(undefined)は null、src か content の中を指すのに見つからなければ undefined
export const resolveImport = (from, specifier, known) => {
  const base = specifier === undefined ? null : basePathOf(from, specifier)
  if (base === null || !ALIAS_ROOTS.some(([root]) => base.startsWith(root))) return null
  return findFile(base, known)
}
