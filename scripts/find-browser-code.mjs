// 統合テストのカバレッジ(vitest.integration.config.ts の coverage)の分母にする「ブラウザで動くコード」を決める正本(ADR 0026)。
// 統合テストはコンテナ(src/components の index.tsx)をフック・子と一緒に実際の Chromium で描くので、ブラウザで読み込まれるのは、
// コンポーネントとフックから実行時の import でたどって届くファイルだけ。届かないファイル(src/app のルートと画面のローダー・content の読み出し・
// スプライトの合成・props の組み立てなど)は node でしか動かず(画面の props は index.fixture.ts が globalSetup で node で組む)、
// 統合テストのどの行も通れない。それを分母に入れたままだと、全体の床を100にできない。届かないファイルは単体の設定(vitest.config.ts)が測る
// (どちらでも測らないファイルが無いかは vitest.integration.config.ts が設定を読む時点で確かめる)。
//
// 決まり:
//   入口: src/components の下の index.tsx(hooks/ と __tests__/ の中は除く。判定は scripts/find-containers.mjs の isEntryCandidate)と、
//         src の下の hooks フォルダの中の use-*.ts・use-*.tsx(src/hooks/ を含む。__tests__/ の中とテストの名前は除く)。
//         コンテナも表示部品も入口に数える(表示部品もブラウザで描かれる)
//   たどる: 入口から、実行時に読み込まれる import(import・export … from・import x = require・文字列の import()。型だけの import は除く)で、
//         src と content の中のファイルへ。読み方は scripts/read-imports.mjs、先のファイルの決め方は scripts/resolve-import.mjs(tsconfig.json と同じ決まり)。
//         content の中のコードのファイルも通り道としてたどる(content から src を import していれば、その先も届く)。
//         import を読むのはコードのファイルだけで、ほか(CSS・JSON など)はたどった先で止まる
//   返す: 入口と、届いた src の .ts・.tsx。テストの側(*.test.*・*.fixture.ts・*.test-helper.ts・__tests__/ の中)を分母から外すのは使う側
//         (vitest.integration.config.ts の coverage の exclude と同じ名前で外し、名前の決まりを2か所に持たない)
// src・content の中を指すのに見つからない import、式で組んだ import()、src と content の外を指す相対パスが1つでもあれば投げる
// (届く先を取りこぼした集まりでは、分母から外したファイルが本当にブラウザで動かないとは言えない)。
// たどらないもの: パッケージの import。束ねるときにパッケージを src のファイルへ差し替える alias(next.config.ts の linkedom →
// src/utils/linkedom-browser-stub.ts)も import の文には現れないのでたどらない。統合テストの Vite の設定にはこの alias が無く、
// 差し替え先は統合テストでも読み込まれない(単体の設定が測る)。
//
// 判定(入口の選び方・型だけの import を飛ばす・content を通り道にする・取りこぼしの検出)が壊れていないかは、読み込むたびに偽のファイルで確かめる(下の「自己検査」)。
//
// 使い方: import { findBrowserCode } from './scripts/find-browser-code.mjs'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { inTestsDir } from './container-dirs.mjs'
import { isEntryCandidate } from './find-containers.mjs'
import { importsOf, parseSource } from './read-imports.mjs'
import { ALIAS_ROOTS, basePathOf, resolveImport } from './resolve-import.mjs'

// import の先になるフォルダ(resolve-import.mjs の別名と同じ src と content)
const SCAN_DIRS = ALIAS_ROOTS.map(([root]) => root.replace(/\/$/, ''))
const SKIP_DIRS = new Set(['node_modules', '.git'])
// import を読むファイル(fingerprint-tests.mjs と同じ)
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/
// 返すファイル(カバレッジで測る src のコードのファイル)
const SRC_CODE = /^src\/.+\.tsx?$/
// フックの入口の名前と、入口から外すテストの名前
const HOOK_FILE = /^use-[^/]+\.tsx?$/
const TEST_NAME = /\.(?:test|test-helper|fixture)\.tsx?$/

const toPosix = p => p.split(path.sep).join('/')

// src の下の hooks フォルダの中の use-*.ts(x) か(テストの側は除く)
const isHookEntry = file => {
  if (!file.startsWith('src/') || inTestsDir(file) || TEST_NAME.test(file)) return false
  const parts = file.split('/')
  return parts.slice(0, -1).includes('hooks') && HOOK_FILE.test(parts.at(-1))
}

// 入口か(リポジトリ直下からの '/' 区切りのパス)
export const isBrowserEntry = file => isEntryCandidate(file) || isHookEntry(file)

// known: 在るファイル(リポジトリ直下からのパス)の集まり。read: パス → 中身(コードのファイルだけを読む)。
// 返すのは、入口(entries)・入口と届いた src のコードのファイル(files)・たどれなかった import
// (unresolved: src・content の中を指すのに見つからない、unfollowed: 式で組んだ import()、outside: src・content の外を指す相対パス)。どれもパスの順
export const reachBrowserCode = (known, read) => {
  const entries = [...known].filter(isBrowserEntry).sort()
  const unresolved = []
  const unfollowed = []
  const outside = []
  const seen = new Set(entries)
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.shift()
    if (!CODE_FILE.test(file)) continue
    for (const { specifier, typeOnly } of importsOf(parseSource(file, read(file)))) {
      if (typeOnly) continue
      if (specifier === undefined) {
        unfollowed.push(file)
        continue
      }
      const target = resolveImport(file, specifier, known)
      if (target === undefined) unresolved.push(`${file}: ${specifier}`)
      else if (target === null) {
        if (basePathOf(file, specifier) !== null) outside.push(`${file}: ${specifier}`)
      } else if (!seen.has(target)) {
        seen.add(target)
        queue.push(target)
      }
    }
  }
  const files = [...seen].filter(file => SRC_CODE.test(file)).sort()
  return {
    entries,
    files,
    unresolved: unresolved.sort(),
    unfollowed: unfollowed.sort(),
    outside: outside.sort(),
  }
}

// 壊れたシンボリックリンクで statSync が例外を投げないよう、実体の無い入口は集める前に落とす(check-layers.mjs と同じ)
const walk = dir =>
  readdirSync(dir).flatMap(name => {
    if (SKIP_DIRS.has(name)) return []
    const p = path.join(dir, name)
    const stat = statSync(p, { throwIfNoEntry: false })
    if (stat === undefined) return []
    return stat.isDirectory() ? walk(p) : [p]
  })

// root(リポジトリ直下の絶対パス)の作業ツリーで、入口(entries)と、ブラウザで動く src のコードのファイル(files)を求める。
// たどれなかった import があれば投げる
export const findBrowserCode = root => {
  const dirs = SCAN_DIRS.filter(dir => existsSync(path.join(root, dir)))
  const known = new Set(
    dirs.flatMap(dir => walk(path.join(root, dir))).map(file => toPosix(path.relative(root, file)))
  )
  const result = reachBrowserCode(known, file => readFileSync(path.join(root, file), 'utf-8'))
  const problems = [
    ...result.unresolved.map(item => `src・content の中を指すのに見つからない import: ${item}`),
    ...result.unfollowed.map(file => `式で組んだ import(): ${file}`),
    ...result.outside.map(item => `src・content の外を指す相対パス: ${item}`),
  ]
  if (problems.length > 0) {
    throw new Error(
      [
        `find-browser-code: 入口から import をたどる途中に、たどれない import が ${problems.length} 件ある(届く先を取りこぼすので、ブラウザで動くコードを決められない)`,
        ...problems.map(problem => `  - ${problem}`),
      ].join('\n')
    )
  }
  return { entries: result.entries, files: result.files }
}

// ---- 自己検査 ----
// 入口の選び方・型だけの import を飛ばす所・content を通り道にする所・取りこぼしの検出が壊れると、ブラウザで動くファイルが分母から黙って外れる
// (外れたファイルは単体の設定が測るが、統合テストが通るはずの行が通らなくなっても気付けない)。
// そこで偽のファイルを、実際と同じ関数でメモリの上で判定し、期待とぴったり同じでなければ投げる
const FAKE_FILES = new Map(
  Object.entries({
    // コンテナの入口: 実行時の import・型だけの import 2形・CSS・隣のフック・再 export(値と型だけ)・文字列の import()
    'src/components/A/index.tsx': [
      `import { b } from './utils/b'`,
      `import type { T } from './utils/types'`,
      // verbatimModuleSyntax ではこの形が実行時に先を読むが、ここでは型だけとみなす。src・content では ESLint の @typescript-eslint/no-import-type-side-effects がこの形を落とす
      `import { type U } from './utils/types-named'`,
      `import styles from './a.module.css'`,
      `import { useA } from './hooks/use-a'`,
      `export { c } from '@/lib/c'`,
      `export type { D } from '@/lib/d'`,
      `export const lazy = () => import('@/utils/lazy')`,
    ].join('\n'),
    'src/components/A/a.module.css': '.a { color: inherit }',
    // content を通り道にして src へ戻る。e から b へ戻る輪(b → content/words → e → b)も作る
    'src/components/A/utils/b.ts': `import { w } from '@content/words'\nexport const b = w`,
    'content/words.ts': `import { e } from '@/utils/e'\nexport const w = e`,
    'src/utils/e.ts': `import '../components/A/utils/b'\nexport const e = 1`,
    'src/components/A/utils/types.ts': 'export type T = number',
    'src/components/A/utils/types-named.ts': 'export type U = string',
    'src/lib/c.ts': 'export const c = 1',
    'src/lib/d.ts': 'export type D = number\nexport const d = 1',
    'src/utils/lazy.ts': 'export const lazy = 1',
    'src/components/A/hooks/use-a.ts': 'export const useA = () => 0',
    // フックの入口(src/hooks/ の下)。どの部品からも import されていなくても入口
    'src/hooks/use-f.ts': `import { f } from '@/lib/f'\nexport const useF = () => f`,
    'src/lib/f.ts': 'export const f = 1',
    // 表示部品の入口(フックを使わない index.tsx)
    'src/components/ui/G/index.tsx': `import { g } from '@/utils/g'\nexport const G = () => g`,
    'src/utils/g.ts': 'export const g = 1',
    // 入口でないもの: src/app・__tests__ の中・hooks の中の index.tsx・hooks の中のテストの名前・フィクスチャ・名前の前の方が同じだけのフォルダ
    'src/app/page.tsx': `import { h } from '@/lib/h'\nexport default h`,
    'src/lib/h.ts': 'export const h = 1',
    'src/components/A/__tests__/index.tsx': `import { i } from '@/utils/i'`,
    'src/components/A/hooks/index.tsx': `import { i } from '@/utils/i'`,
    'src/components/A/hooks/use-a.test.ts': `import { i } from '@/utils/i'`,
    'src/components/A/__tests__/hooks/use-z.ts': `import { i } from '@/utils/i'`,
    'src/components/A/index.fixture.ts': `import { i } from '@/utils/i'`,
    'src/hooksX/use-x.ts': `import { i } from '@/utils/i'`,
    'src/utils/i.ts': 'export const i = 1',
    // たどれない import(見つからない・式で組んだ import()・src と content の外)
    'src/components/B/index.tsx': [
      `import { x } from './missing'`,
      `export const load = (name: string) => import(name)`,
      `import '../../../scripts/tool.mjs'`,
      `import { useState } from 'react'`,
    ].join('\n'),
  })
)
const EXPECTED = {
  entries: [
    'src/components/A/hooks/use-a.ts',
    'src/components/A/index.tsx',
    'src/components/B/index.tsx',
    'src/components/ui/G/index.tsx',
    'src/hooks/use-f.ts',
  ],
  files: [
    'src/components/A/hooks/use-a.ts',
    'src/components/A/index.tsx',
    'src/components/A/utils/b.ts',
    'src/components/B/index.tsx',
    'src/components/ui/G/index.tsx',
    'src/hooks/use-f.ts',
    'src/lib/c.ts',
    'src/lib/f.ts',
    'src/utils/e.ts',
    'src/utils/g.ts',
    'src/utils/lazy.ts',
  ],
  unresolved: ['src/components/B/index.tsx: ./missing'],
  unfollowed: ['src/components/B/index.tsx'],
  outside: ['src/components/B/index.tsx: ../../../scripts/tool.mjs'],
}
const fakeResult = reachBrowserCode(new Set(FAKE_FILES.keys()), file => FAKE_FILES.get(file))
const selfCheckFailures = Object.entries(EXPECTED)
  .filter(([key, expected]) => JSON.stringify(fakeResult[key]) !== JSON.stringify(expected))
  .map(
    ([key, expected]) =>
      `${key}: ${JSON.stringify(fakeResult[key])} → 期待 ${JSON.stringify(expected)}`
  )
if (selfCheckFailures.length > 0) {
  throw new Error(
    `find-browser-code: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}
