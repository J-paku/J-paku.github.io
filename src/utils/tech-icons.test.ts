// ブランドロゴの引き当て(getTechIconPath)の単体テスト。ラベル先頭の大小無視の前方一致でロゴを引き、
// 表に無い技術はundefinedを返す。パスデータは公開されていないので、どのロゴが返ったかはパスの先頭で見分ける
import { describe, expect, it } from 'vitest'
import { getTechIconPath } from './tech-icons'

// Simple Iconsの各ロゴのパス先頭
const PATH_HEAD = {
  claude: 'm4.7144 15.9555',
  openai: 'M22.2819 9.8211',
  nodedotjs: 'M11.998,24c',
  gnubash: 'M21.038,4.9l',
  github: 'M12 .297c',
  git: 'M23.546 10.93L',
  nextdotjs: 'M18.665 21.978C',
  react: 'M14.23 12.004a',
  typescript: 'M1.125 0C',
  tailwindcss: 'M12.001,4.8c',
  swr: 'M0 12.187a',
  tauri: 'M13.912 0a',
  rust: 'M23.8346 11.7033',
  swift: 'M7.508 0c',
} as const

type Slug = keyof typeof PATH_HEAD

const headOf = (label: string, slug: Slug): string | undefined =>
  getTechIconPath(label)?.slice(0, PATH_HEAD[slug].length)

// タプル: [ラベル, 引くロゴ]。表の接頭辞14個を1つずつ。
// GitHubは作品カードのリポジトリ導線とプロフィールの外部リンクも引き、引けなかった時の代わりを持たない
const canonical: Array<[string, Slug]> = [
  ['Claude', 'claude'],
  ['Codex', 'openai'],
  ['Node.js', 'nodedotjs'],
  ['Bash', 'gnubash'],
  ['GitHub', 'github'],
  ['Git', 'git'],
  ['Next.js', 'nextdotjs'],
  ['React', 'react'],
  ['TypeScript', 'typescript'],
  ['Tailwind CSS', 'tailwindcss'],
  ['SWR', 'swr'],
  ['Tauri', 'tauri'],
  ['Rust', 'rust'],
  ['Swift', 'swift'],
]

// 版付き・派生表記。先頭が一致すれば同じロゴを引く(作品のスタックに実際に並ぶ書き方)
const suffixed: Array<[string, Slug]> = [
  ['Next.js 16', 'nextdotjs'],
  ['React 19', 'react'],
  ['TypeScript 5.7', 'typescript'],
  ['Tailwind CSS 4', 'tailwindcss'],
  ['Git worktree', 'git'],
  ['GitHub Actions', 'github'],
]

// 大文字小文字だけが違う表記
const caseVariants: Array<[string, Slug]> = [
  ['react', 'react'],
  ['REACT', 'react'],
  ['gItHuB', 'github'],
  ['NEXT.JS', 'nextdotjs'],
]

// ロゴを持たない技術と、表の接頭辞を先頭以外に含むだけのラベル。
// 前方一致を部分一致へ緩めると、@use-gesture/react(作品のスタックにある)やPreactがReactのロゴを拾う
const noIcon: string[] = [
  'JSONL trace',
  '静的エクスポート',
  'AVFoundation',
  'Gemini',
  '@use-gesture/react',
  'Preact',
  'Vercel SWR',
]

describe('getTechIconPath', () => {
  it.each(canonical)('%sは%sのロゴを引く', (label, slug) => {
    expect(headOf(label, slug)).toBe(PATH_HEAD[slug])
  })

  it.each(suffixed)('版付き・派生表記の%sも%sのロゴを引く', (label, slug) => {
    expect(headOf(label, slug)).toBe(PATH_HEAD[slug])
  })

  it.each(caseVariants)('大文字小文字を区別しない: %sは%sのロゴを引く', (label, slug) => {
    expect(headOf(label, slug)).toBe(PATH_HEAD[slug])
  })

  // 表はgithubをgitより先に置いている。順が入れ替わると'github'が先に'git'へ一致してGitのロゴになる
  it('GitHubはGitのロゴにならない', () => {
    expect(getTechIconPath('GitHub')).not.toBe(getTechIconPath('Git'))
  })

  it.each(noIcon)('%sはロゴを持たずundefinedを返す', label => {
    expect(getTechIconPath(label)).toBeUndefined()
  })

  it('空文字列は例外を投げずundefinedを返す', () => {
    expect(getTechIconPath('')).toBeUndefined()
  })
})
