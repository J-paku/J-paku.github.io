// 変異テストの増分の実行(scripts/run-mutation.mjs)のために、テストファイルごとに「そのテストから import をたどって届くファイルの中身」の
// 指紋を取り、前回の指紋と比べて、測り直す変異体を選ぶ(docs/decisions/0025-remeasure-kills-on-test-deps.md)。
//
// なぜ要るか: Stryker 10.0.0 の incremental が前回の結果と比べるのは、変異体のあるファイルとテストファイルの中身だけ
// (@stryker-mutator/core の dist/src/mutants/mutant-test-planner.js の incrementalDiff が読むのは、今の変異体・今のテスト・前回の結果の
// files と testFiles に名前の出るファイルだけで、dist/src/mutants/incremental-differ.js の diff がその中身の差分で変異体とテストの同じさを決める)。
// 前回落とした(Killed)変異体は、落としたテストが同じなら使い回す(同じファイルの mutantCanBeReused)。そのため、テストが import する
// 別のファイル(*.test-helper.ts・*.fixture.ts・間に挟んで import するモジュール・content)だけが変わると、そのテストが前回落とした変異体は、
// 今は生き残るとしても落としたままと数えられる。
// そこで run-mutation.mjs が Stryker を呼ぶ前に、この指紋を前回の指紋と比べ、指紋が変わったテストファイルのテストが落とした変異体を
// 結果ファイルから取り除く(取り除いた変異体は Stryker から見て新しい変異体になり、その回に測り直される)。
//
// 指紋の取り方:
//   - テストファイルは Vitest に選ばせる(Stryker の設定の vitest.configFile を Vitest に渡し、Vitest がそのとき走らせるファイルを聞く。
//     include・exclude をここに書き写さないので、Vitest と食い違わない)
//   - テストファイルから import をたどる。import の読み方は scripts/read-imports.mjs、先のファイルの決め方は scripts/resolve-import.mjs
//     (@/・@content/・相対パスを src・content の中のファイルへ。tsconfig.json と同じ決まり)。型だけの import は実行時に読み込まれないのでたどらない。
//     import を読むのはコードのファイルだけで、ほか(CSS・JSON など)は中身だけを指紋に入れる
//   - テストファイル自身と、そこから届いたファイルのパスと中身の SHA-256 をパスの順に並べ、その並びの SHA-256 をそのテストファイルの指紋にする。
//     テストファイル自身も入れるのは、Stryker がテストファイルの中を比べるのが、テストごとの場所の範囲だけだから(同じ incremental-differ.js の
//     closeLocations と performFileDiff。場所のあるテストは、その始まりから次のテストの始まりまでを比べるので、最初のテストより前
//     (import・補助の関数・最上位の beforeEach)だけを変えても、どのテストも変わったと見ない)。今の @stryker-mutator/vitest-runner 10.0.0 は
//     テストの場所を出さない(2026-10-19 に、結果ファイルの testFiles の tests に location が1件も無いのを見た)ので、Stryker は場所の無い
//     テストをファイル全体にわたると見て、テストファイルが変わればそのファイルのテストを全部変わったと見る(そのファイルのテストだけが
//     落とした変異体は、同じファイルの mutantCanBeReused で Stryker も測り直す)。ランナーが場所を出し始めたときに、最初のテストより前
//     だけの変更を見落とさないために入れておく
//   - src・content の中を指すのに見つからない import があれば投げる(届く先を取りこぼした指紋は信じられない)
// 指紋に入らない(変わっても測り直さない)もの: 依存パッケージ・src と content の外のファイル・設定(stryker.config.mjs・vitest.config.ts)・
// 式で組んだ import() の先・vi.mock などに文字列で書くだけのパス・fs で読むファイル。依存と設定の変更は、週1回の --force に任せる
// (docs/decisions/0023-inherit-latest-mutation-result.md)
//
// 指紋のファイル: 結果ファイルの隣の、結果ファイルの名前から .json を除いて .test-deps.json を付けたもの(既定の結果ファイルなら
// reports/stryker-incremental.test-deps.json)。結果ファイルごとに名前が分かれるので、--incrementalFile で同じフォルダの別の結果ファイルを
// 名指ししても混ざらない。形は { version: 1, tests: { <テストファイルのリポジトリ直下からのパス>: <指紋(SHA-256 の16進)> } }。
// 版(version)が違う・JSON として読めないファイルは、無いのと同じに扱う(全部のテストファイルを変わったと見る)
//
// 判定(届くファイルのたどり方・指紋の比べ方・取り除く変異体の選び方)が壊れて取り除き漏れが出ていないかは、読み込むたびに最初に、
// 偽のファイルで確かめる(下の「自己検査」。check-layers.mjs と同じ形)
//
// 使い方: import { collectFingerprint } from './fingerprint-tests.mjs'(run-mutation.mjs が使う)。
// 単独で node scripts/fingerprint-tests.mjs [結果ファイル] と走らせると、何も書かずに、今の指紋の数とかかった時間・補助のファイルごとに届く
// テストファイル・前回の指紋と比べて測り直すテストファイル・次の npm run test:mutation が取り除く変異体の数を出す
// (結果ファイルはリポジトリ直下からの相対。渡さないときは stryker.config.mjs の incrementalFile)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importsOf, parseSource } from './read-imports.mjs'
import { ALIAS_ROOTS, basePathOf, resolveImport } from './resolve-import.mjs'

// 指紋のファイルの形の版。指紋の取り方を変えたら上げる(前の版の指紋は無いのと同じに扱われ、落とした変異体を全部測り直す)
const FINGERPRINT_VERSION = 1
// import の先になるフォルダ(resolve-import.mjs の別名と同じ src と content)
const SCAN_DIRS = ALIAS_ROOTS.map(([root]) => root.replace(/\/$/, ''))
const SKIP_DIRS = new Set(['node_modules', '.git'])
// import を読むファイル(check-layers.mjs と同じ)。ほか(CSS・JSON など)は中身だけを指紋に入れる
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/
// 補助のファイル(単独で走らせたときに、ファイルごとに届くテストファイルを出す)
const HELPER_FILE = /\.test-helper\.ts$|\.fixture\.ts$/
const EXPRESSION_SPECIFIER = '(式で組んだ指定子)'

const sha256 = content => createHash('sha256').update(content).digest('hex')
const toPosix = p => p.split(path.sep).join('/')

// 結果ファイル → その隣の指紋のファイル
export const fingerprintFileOf = incrementalFile =>
  `${incrementalFile.replace(/\.json$/, '')}.test-deps.json`

// testFiles: テストファイル(リポジトリ直下からのパス)の並び。known: 在るファイル(同じ形のパス)の集まりで、import の先はこの中から探す。
// read: パス → 中身(文字列か Buffer)。返すのは、指紋(tests: テストファイル → 指紋)と、テストファイル → 自身と届いたファイルの並び(depsOf)と、
// たどれなかった import(unresolved: src・content の中を指すのに見つからない、unfollowed: 式で組んだ import()、outside: src・content の外を指す相対パス)
const fingerprintOf = (testFiles, known, read) => {
  const contents = new Map()
  const contentOf = file => {
    if (!contents.has(file)) contents.set(file, read(file))
    return contents.get(file)
  }
  const hashes = new Map()
  const hashOf = file => {
    if (!hashes.has(file)) hashes.set(file, sha256(contentOf(file)))
    return hashes.get(file)
  }
  const unresolved = []
  const unfollowed = []
  const outside = []
  // ファイル → 実行時に読み込む import の先(src・content の中のファイル)。ファイルごとに1回だけ読む
  const edges = new Map()
  const edgesOf = file => {
    if (edges.has(file)) return edges.get(file)
    const code = CODE_FILE.test(file) ? String(contentOf(file)) : undefined
    const imports = code === undefined ? [] : importsOf(parseSource(file, code))
    const targets = []
    for (const { specifier } of imports.filter(found => !found.typeOnly)) {
      if (specifier === undefined) {
        unfollowed.push({ file, specifier: EXPRESSION_SPECIFIER })
      } else {
        const target = resolveImport(file, specifier, known)
        if (typeof target === 'string') targets.push(target)
        else if (target === undefined) unresolved.push({ file, specifier })
        else if (basePathOf(file, specifier) !== null) outside.push({ file, specifier })
      }
    }
    edges.set(file, targets)
    return targets
  }
  // テストファイル自身と、そこから import をたどって届くファイル。パスの順
  const reachedFrom = testFile => {
    const seen = new Set([testFile])
    const queue = [testFile]
    while (queue.length > 0) {
      for (const target of edgesOf(queue.shift())) {
        if (seen.has(target)) continue
        seen.add(target)
        queue.push(target)
      }
    }
    return [...seen].sort()
  }
  const digestOf = deps => sha256(deps.map(dep => `${dep}\n${hashOf(dep)}\n`).join(''))
  const sorted = [...testFiles].sort()
  const depsOf = new Map(sorted.map(testFile => [testFile, reachedFrom(testFile)]))
  const tests = Object.fromEntries([...depsOf].map(([file, deps]) => [file, digestOf(deps)]))
  return { tests, depsOf, unresolved, unfollowed, outside }
}

// 測り直すテストファイル。前回の結果ファイルの testFiles にあるテストファイルのうち、前回の指紋(stored。無ければ undefined)と
// 今の指紋(current)で指紋が違うか、どちらかに無いもの。前回の指紋が無いときは全部
export const changedTestFiles = (stored, current, reportTestFiles) =>
  Object.keys(reportTestFiles ?? {})
    .filter(
      file =>
        stored?.tests[file] === undefined ||
        current.tests[file] === undefined ||
        stored.tests[file] !== current.tests[file]
    )
    .sort()

// 結果ファイルの中身(report)の files から、changed のテストファイルのテストが落とした Killed の変異体
// (killedBy にそのテストの id が1つでも入るもの)を取り除いた files と、取り除いた数。ほかの状態の変異体には触れない
export const dropStaleKills = (report, changed) => {
  const staleIds = new Set(
    changed.flatMap(file => (report.testFiles?.[file]?.tests ?? []).map(test => test.id))
  )
  const isStale = mutant =>
    mutant.status === 'Killed' && (mutant.killedBy ?? []).some(id => staleIds.has(id))
  const entries = Object.entries(report.files)
  const files = Object.fromEntries(
    entries.map(([name, file]) => [
      name,
      { ...file, mutants: file.mutants.filter(mutant => !isStale(mutant)) },
    ])
  )
  const dropped = entries.reduce(
    (sum, [name, file]) => sum + file.mutants.length - files[name].mutants.length,
    0
  )
  return { files, dropped }
}

// 結果ファイルの中身(report)で Killed の変異体を落としたテストのファイルのうち、今の指紋(current)に無いもの。
// 走り終えた結果でこれがあると、Vitest に選ばせたテストファイルと Stryker が走らせたテストファイルが食い違っている
// (指紋に無いテストファイルは毎回「変わった」と見るので見落としにはならないが、そのテストの結果を毎回測り直して黙って遅くなる)
export const killersOutside = (report, current) => {
  const fileOfTest = new Map(
    Object.entries(report.testFiles ?? {}).flatMap(([file, { tests }]) =>
      tests.map(test => [test.id, file])
    )
  )
  const killers = Object.values(report.files)
    .flatMap(file => file.mutants)
    .filter(mutant => mutant.status === 'Killed')
    .flatMap(mutant => mutant.killedBy ?? [])
    .map(id => fileOfTest.get(id))
    .filter(file => file !== undefined)
  return [...new Set(killers)].filter(file => current.tests[file] === undefined).sort()
}

// 指紋のファイルを読む。無い・JSON として読めない・版が違うときは undefined(前回の指紋が無いのと同じ)
export const readFingerprint = file => {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'))
    const usable =
      parsed?.version === FINGERPRINT_VERSION &&
      parsed.tests !== null &&
      typeof parsed.tests === 'object'
    return usable ? parsed : undefined
  } catch {
    return undefined
  }
}

// 指紋のファイルを書く(Stryker が結果ファイルを書くときと同じ、2文字の字下げ)
export const writeFingerprint = (file, tests) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ version: FINGERPRINT_VERSION, tests }, null, 2), 'utf-8')
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

// saved(書き換わる前の環境変数の写し)と違う環境変数を元へ戻し、戻した名前を返す
const restoreEnv = saved => {
  const touched = [...new Set([...Object.keys(process.env), ...Object.keys(saved)])]
    .filter(name => process.env[name] !== saved[name])
    .sort()
  for (const name of touched) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
  return touched
}

// Vitest が走らせるテストファイル(root からのパス)。configFile は Stryker の設定の vitest.configFile で、Stryker の vitest-runner と同じく
// Vitest にそのまま渡す(無ければ Vitest が自分で探す)。Vitest を作ると環境変数が書き換わるので、閉じた後に元へ戻し、
// この後の Stryker を前と同じ環境で走らせる。写しは vitest/node を読み込む前に取る(読み込むときの書き換えも戻すため)。
// 戻した名前も返す(単独で走らせたときに出す)
const listTestFiles = async (root, configFile) => {
  const saved = { ...process.env }
  const { createVitest } = await import('vitest/node')
  const vitest = await createVitest('test', {
    root,
    config: configFile === undefined ? undefined : path.resolve(root, configFile),
    watch: false,
  })
  const specifications = await vitest.globTestSpecifications().finally(() => vitest.close())
  const envTouched = restoreEnv(saved)
  const names = specifications.map(spec => toPosix(path.relative(root, spec.moduleId)))
  return { testFiles: [...new Set(names)].sort(), envTouched }
}

// root(リポジトリ直下)の今の指紋。configFile は Stryker の設定の vitest.configFile。
// テストファイルが1件も無いとき(見る場所を間違えている)と、src・content の中を指すのに見つからない import があるときは投げる
export const collectFingerprint = async (root, configFile) => {
  const startedAt = performance.now()
  const { testFiles, envTouched } = await listTestFiles(root, configFile)
  const listedAt = performance.now()
  if (testFiles.length === 0) {
    throw new Error(
      `fingerprint-tests: Vitest が走らせるテストファイルが1件も無い(設定 ${configFile ?? '名指し無し'}・${root})。見る場所を疑うこと`
    )
  }
  const dirs = SCAN_DIRS.filter(dir => existsSync(path.join(root, dir)))
  const files = dirs.flatMap(dir => walk(path.join(root, dir)))
  const known = new Set(files.map(file => toPosix(path.relative(root, file))))
  const result = fingerprintOf(testFiles, known, file => readFileSync(path.join(root, file)))
  if (result.unresolved.length > 0) {
    throw new Error(
      [
        `fingerprint-tests: テストから import をたどる途中に、src・content の中を指すのに見つからない import が ${result.unresolved.length} 件ある(届く先を取りこぼすので指紋を取れない)`,
        ...result.unresolved.map(({ file, specifier }) => `  - ${file}: ${specifier}`),
      ].join('\n')
    )
  }
  const timings = { listMs: listedAt - startedAt, graphMs: performance.now() - listedAt }
  return { ...result, testFiles, knownCount: known.size, envTouched, timings }
}

// ---- 自己検査 ----
// たどり方(型だけの import を飛ばす・再 export・import = require・文字列の import()・別名・JSON と CSS・輪になった import・
// テストファイル自身も入れる・2つのテストファイルが同じファイルに届く)、指紋の比べ方、取り除く変異体の選び方が壊れると、
// 測り直すべき変異体を黙って使い回す。
// そこで偽のファイルと偽の結果ファイルを、実際と同じ関数でメモリの上で判定し、期待とぴったり同じでなければ投げる
const FAKE_FILES = new Map(
  Object.entries({
    'src/utils/a.ts': [
      `import { b } from './b'`,
      `import type { T } from './types'`,
      `import { type U } from './types-named'`,
      `export const a = () => b()`,
    ].join('\n'),
    'src/utils/b.ts': `import { c } from '@/lib/c'\nexport const b = () => c`,
    // 輪になった import(a → b → c → a)
    'src/lib/c.ts': `import { a } from '../utils/a'\nimport data from '@content/data.json'\nexport const c = [a, data]`,
    'src/utils/types.ts': 'export type T = number',
    'src/utils/types-named.ts': 'export type U = string',
    'content/data.json': JSON.stringify({ x: 1 }),
    'src/utils/a.test.ts': [
      `import { a } from './a'`,
      `import { setup } from './a.test-helper'`,
      `import { it } from 'vitest'`,
      `it('a', () => a(setup))`,
    ].join('\n'),
    'src/utils/a.test-helper.ts': `export { fixture } from './a.fixture'\nexport const setup = 0`,
    // 補助のファイルからテストファイル自身へ戻る輪(テストファイルは1回だけ入る)
    'src/utils/a.fixture.ts': `import './a.test'\nexport const fixture = 1`,
    'src/utils/d.ts': `export const d = () => import('./e')`,
    'src/utils/e.ts': 'export const e = 1',
    // b.ts は a.test.ts からも届く(2つのテストファイルが同じファイルに届く)
    'src/utils/d.test.ts': [
      `import { b } from './b'`,
      `import d = require('./d')`,
      `import '../../scripts/tool.mjs'`,
      `export const load = name => import(name)`,
    ].join('\n'),
    'src/utils/style.test.ts': `import styles from './x.module.css'`,
    'src/utils/x.module.css': '.a { color: inherit }',
    'src/utils/lone.test.ts': 'export {}',
    'src/utils/unused.ts': 'export const unused = 0',
  })
)
const FAKE_TESTS = [
  'src/utils/a.test.ts',
  'src/utils/d.test.ts',
  'src/utils/style.test.ts',
  'src/utils/lone.test.ts',
]
const EXPECTED_DEPS = {
  'src/utils/a.test.ts': [
    'content/data.json',
    'src/lib/c.ts',
    'src/utils/a.fixture.ts',
    'src/utils/a.test-helper.ts',
    'src/utils/a.test.ts',
    'src/utils/a.ts',
    'src/utils/b.ts',
  ],
  'src/utils/d.test.ts': [
    'content/data.json',
    'src/lib/c.ts',
    'src/utils/a.ts',
    'src/utils/b.ts',
    'src/utils/d.test.ts',
    'src/utils/d.ts',
    'src/utils/e.ts',
  ],
  'src/utils/lone.test.ts': ['src/utils/lone.test.ts'],
  'src/utils/style.test.ts': ['src/utils/style.test.ts', 'src/utils/x.module.css'],
}
const EXPECTED_UNFOLLOWED = [`src/utils/d.test.ts ${EXPRESSION_SPECIFIER}`]
const EXPECTED_OUTSIDE = ['src/utils/d.test.ts ../../scripts/tool.mjs']
// 1つのファイルを書き換えたときに、指紋が変わるテストファイル
const CHANGE_CASES = [
  {
    file: 'src/utils/a.fixture.ts',
    content: `import './a.test'\nexport const fixture = 2`,
    changed: ['src/utils/a.test.ts'],
  },
  {
    file: 'content/data.json',
    content: JSON.stringify({ x: 2 }),
    changed: ['src/utils/a.test.ts', 'src/utils/d.test.ts'],
  },
  // 2つのテストファイルが届くファイルを書き換えると、両方が変わる(届く先の覚えや seen がテストファイルの間で漏れると、後の方が変わらない)
  {
    file: 'src/utils/b.ts',
    content: `import { c } from '@/lib/c'\nexport const b = () => !c`,
    changed: ['src/utils/a.test.ts', 'src/utils/d.test.ts'],
  },
  {
    file: 'src/utils/e.ts',
    content: 'export const e = 2',
    changed: ['src/utils/d.test.ts'],
  },
  {
    file: 'src/utils/x.module.css',
    content: '.a { color: red }',
    changed: ['src/utils/style.test.ts'],
  },
  // 型だけの import の先・どこからも届かないファイルは、変わっても指紋が変わらない
  {
    file: 'src/utils/types.ts',
    content: 'export type T = bigint',
    changed: [],
  },
  {
    file: 'src/utils/types-named.ts',
    content: 'export type U = symbol',
    changed: [],
  },
  {
    file: 'src/utils/unused.ts',
    content: 'export const unused = 1',
    changed: [],
  },
  // テストファイル自身の中身も入れる。最初のテストより前(import・最上位の beforeEach)だけを変えても、import を減らしても変わる
  {
    file: 'src/utils/a.test.ts',
    content: [
      `import { a } from './a'`,
      `import { setup } from './a.test-helper'`,
      `import { beforeEach, it } from 'vitest'`,
      `beforeEach(() => a(setup))`,
      `it('a', () => a(setup))`,
    ].join('\n'),
    changed: ['src/utils/a.test.ts'],
  },
  {
    file: 'src/utils/a.test.ts',
    content: `import { a } from './a'\nit('a', () => a())`,
    changed: ['src/utils/a.test.ts'],
  },
]
const FAKE_REPORT = {
  testFiles: {
    'src/utils/a.test.ts': {
      tests: [
        { id: '1', name: 'a1' },
        { id: '2', name: 'a2' },
      ],
    },
    'src/utils/d.test.ts': { tests: [{ id: '3', name: 'd1' }] },
    'src/utils/gone.test.ts': { tests: [{ id: '4', name: 'g1' }] },
  },
  files: {
    'src/utils/a.ts': {
      mutants: [
        { id: 'm1', status: 'Killed', killedBy: ['1'] },
        { id: 'm2', status: 'Killed', killedBy: ['3'] },
        { id: 'm3', status: 'Killed', killedBy: ['3', '2'] },
        { id: 'm4', status: 'Killed' },
        { id: 'm5', status: 'CompileError', killedBy: ['1'] },
        { id: 'm6', status: 'Killed', killedBy: ['zz'] },
      ],
    },
    'src/utils/e.ts': {
      mutants: [
        { id: 'm7', status: 'Killed', killedBy: ['2'] },
        { id: 'm8', status: 'Survived', coveredBy: ['1'] },
      ],
    },
  },
}
// 測り直すテストファイルごとに、残る変異体と取り除く数。m1・m3・m7 は a.test.ts のテストが、m2・m3 は d.test.ts のテストが落とした。
// killedBy の無いもの・知らない id のもの・Killed でないものは残す
const STALE_CASES = [
  {
    changed: ['src/utils/a.test.ts'],
    kept: { 'src/utils/a.ts': ['m2', 'm4', 'm5', 'm6'], 'src/utils/e.ts': ['m8'] },
    dropped: 3,
  },
  // 2件のときは、どちらのテストが落とした変異体も取り除く(1件目だけを見ると m2 が残る)
  {
    changed: ['src/utils/a.test.ts', 'src/utils/d.test.ts'],
    kept: { 'src/utils/a.ts': ['m4', 'm5', 'm6'], 'src/utils/e.ts': ['m8'] },
    dropped: 4,
  },
]
// 解決できない import は、見逃さないよう必ず拾う
const FAKE_UNRESOLVED = new Map(
  Object.entries({
    'src/utils/bad.test.ts': [
      `import { gone } from './gone'`,
      `import { lost } from '@/lib/lost'`,
      `import missing from '@content/missing.json'`,
      `import { it } from 'vitest'`,
    ].join('\n'),
  })
)
const EXPECTED_UNRESOLVED = [
  'src/utils/bad.test.ts ./gone',
  'src/utils/bad.test.ts @/lib/lost',
  'src/utils/bad.test.ts @content/missing.json',
]
const FINGERPRINT_FILE_CASES = [
  ['reports/stryker-incremental.json', 'reports/stryker-incremental.test-deps.json'],
  ['reports/other', 'reports/other.test-deps.json'],
]

const selfCheckFailures = []
const check = (ok, message) => {
  if (!ok) selfCheckFailures.push(message)
}
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)
const listed = found => found.map(({ file, specifier }) => `${file} ${specifier}`)
const fakeFingerprintOf = files =>
  fingerprintOf(FAKE_TESTS, new Set(files.keys()), file => files.get(file))
const differing = (left, right) =>
  Object.keys(left.tests).filter(file => left.tests[file] !== right.tests[file])

const base = fakeFingerprintOf(FAKE_FILES)
const baseDeps = Object.fromEntries(base.depsOf)
const allTests = [...FAKE_TESTS].sort()
check(same(baseDeps, EXPECTED_DEPS), `届くファイルのたどり方 ${JSON.stringify(baseDeps)}`)
check(same(Object.keys(base.tests), allTests), '指紋を取ったテストファイルの並び')
check(base.unresolved.length === 0, '偽のファイルで解決できない import がある')
check(
  same(listed(base.unfollowed), EXPECTED_UNFOLLOWED),
  `式で組んだ import() の拾い方 ${JSON.stringify(listed(base.unfollowed))}`
)
check(
  same(listed(base.outside), EXPECTED_OUTSIDE),
  `src・content の外を指す import の拾い方 ${JSON.stringify(listed(base.outside))}`
)
for (const { file, content, changed } of CHANGE_CASES) {
  const actual = differing(base, fakeFingerprintOf(new Map([...FAKE_FILES, [file, content]])))
  check(
    same(actual, changed),
    `${file} を書き換えたときに指紋が変わるテストファイル ${JSON.stringify(actual)}(期待 ${JSON.stringify(changed)})`
  )
}

// 前回と同じなら何も測り直さない。前回の指紋が無いときは全部。前回の指紋に無いもの・今の指紋に無いもの(消えたテストファイル)・
// 指紋が違うものは測り直す。結果ファイルに testFiles が無ければ何も測り直さない(取り除く変異体を決められない)
const FULL_REPORT_TESTS = Object.fromEntries(allTests.map(file => [file, {}]))
const CHANGED_CASES = [
  { stored: { tests: base.tests }, reportTestFiles: FULL_REPORT_TESTS, expected: [] },
  { stored: undefined, reportTestFiles: FULL_REPORT_TESTS, expected: allTests },
  {
    stored: { tests: { ...base.tests, 'src/utils/lone.test.ts': undefined } },
    reportTestFiles: FULL_REPORT_TESTS,
    expected: ['src/utils/lone.test.ts'],
  },
  {
    stored: { tests: { ...base.tests, 'src/utils/gone.test.ts': 'old' } },
    reportTestFiles: { 'src/utils/a.test.ts': {}, 'src/utils/gone.test.ts': {} },
    expected: ['src/utils/gone.test.ts'],
  },
  {
    stored: { tests: { ...base.tests, 'src/utils/d.test.ts': 'old' } },
    reportTestFiles: FULL_REPORT_TESTS,
    expected: ['src/utils/d.test.ts'],
  },
  { stored: { tests: base.tests }, reportTestFiles: undefined, expected: [] },
]
for (const { stored, reportTestFiles, expected } of CHANGED_CASES) {
  const actual = changedTestFiles(stored, base, reportTestFiles)
  check(
    same(actual, expected),
    `測り直すテストファイルの選び方 ${JSON.stringify(actual)}(期待 ${JSON.stringify(expected)})`
  )
}

for (const { changed, kept: expectedKept, dropped: expectedDropped } of STALE_CASES) {
  const stale = dropStaleKills(FAKE_REPORT, changed)
  const kept = Object.fromEntries(
    Object.entries(stale.files).map(([name, file]) => [name, file.mutants.map(({ id }) => id)])
  )
  check(
    same(kept, expectedKept) && stale.dropped === expectedDropped,
    `${JSON.stringify(changed)} が変わったときの取り除く変異体の選び方 ${JSON.stringify(kept)}・${stale.dropped} 体`
  )
}
const outsideOfFake = killersOutside(FAKE_REPORT, { tests: { 'src/utils/a.test.ts': 'x' } })
check(
  same(outsideOfFake, ['src/utils/d.test.ts']),
  `指紋に無いテストファイルの拾い方 ${JSON.stringify(outsideOfFake)}`
)
const unresolvedFiles = new Set(FAKE_UNRESOLVED.keys())
const readUnresolved = file => FAKE_UNRESOLVED.get(file)
const { unresolved } = fingerprintOf([...unresolvedFiles], unresolvedFiles, readUnresolved)
check(
  same(listed(unresolved), EXPECTED_UNRESOLVED),
  `解決できない import の拾い方 ${JSON.stringify(listed(unresolved))}`
)
for (const [incrementalFile, expected] of FINGERPRINT_FILE_CASES) {
  check(
    fingerprintFileOf(incrementalFile) === expected,
    `指紋のファイルの名前の決め方 ${incrementalFile}`
  )
}
if (selfCheckFailures.length > 0) {
  throw new Error(
    `fingerprint-tests: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

// ---- 単独で走らせたとき ----
// 何も書かない。「この補助のファイルを変えると、どのテストの結果を測り直すか」を、変異テストを走らせずに確かめるためのもの
const entry = process.argv[1]
const isMain = entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)
if (isMain) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { default: config } = await import('../stryker.config.mjs')
  const incrementalFile = path.resolve(ROOT, process.argv[2] ?? config.incrementalFile)
  const fingerprintFile = fingerprintFileOf(incrementalFile)
  const current = await collectFingerprint(ROOT, config.vitest?.configFile)
  const reached = new Set([...current.depsOf.values()].flat())
  const seconds = ms => (ms / 1000).toFixed(2)
  const { listMs, graphMs } = current.timings
  console.log(
    `fingerprint-tests: 自己検査を通過。テストファイル ${current.testFiles.length} 件(Vitest が選んだもの)・届くファイル ${reached.size} 件(テストファイル自身も入れ、重ならずに数えて。src と content のファイル ${current.knownCount} 件のうち)`
  )
  console.log(
    `fingerprint-tests: かかった時間は、Vitest にテストファイルを聞くのに ${seconds(listMs)} 秒・import をたどって指紋を取るのに ${seconds(graphMs)} 秒`
  )
  console.log(
    `fingerprint-tests: Vitest を作る間に書き換わり、元へ戻した環境変数 ${current.envTouched.length} 個(${current.envTouched.join(', ')})`
  )
  console.log(
    `fingerprint-tests: たどらなかった import(指紋に入らない)は、式で組んだ import() ${current.unfollowed.length} 件・src と content の外を指す相対パス ${current.outside.length} 件`
  )
  for (const line of listed([...current.unfollowed, ...current.outside])) {
    console.log(`  - ${line}`)
  }
  const helpers = [...reached].filter(file => HELPER_FILE.test(file)).sort()
  console.log(
    `fingerprint-tests: テストから届く補助のファイル(*.test-helper.ts・*.fixture.ts) ${helpers.length} 件。書き換えると、届くテストファイルのテストが前回落とした変異体を測り直す`
  )
  for (const helper of helpers) {
    const reaching = [...current.depsOf].filter(([, deps]) => deps.includes(helper))
    const names = reaching.map(([file]) => file).join(', ')
    console.log(`  - ${helper} → ${reaching.length} 件(${names})`)
  }
  const stored = readFingerprint(fingerprintFile)
  if (stored === undefined) {
    console.log(
      `fingerprint-tests: 前回の指紋(${fingerprintFile})が無いか読めない。次の npm run test:mutation は、結果ファイルの testFiles を全部測り直すテストファイルと見る`
    )
  }
  if (existsSync(incrementalFile)) {
    const report = JSON.parse(readFileSync(incrementalFile, 'utf-8'))
    const reportTestFiles = Object.keys(report.testFiles ?? {})
    const fingerprinted = reportTestFiles.filter(file => current.tests[file] !== undefined)
    const changed = changedTestFiles(stored, current, report.testFiles)
    const { dropped } = dropStaleKills(report, changed)
    const outsideKillers = killersOutside(report, current)
    console.log(
      `fingerprint-tests: 結果ファイル(${incrementalFile})の testFiles ${reportTestFiles.length} 件のうち、今の指紋にあるもの ${fingerprinted.length} 件・前回の指紋と比べて測り直すもの ${changed.length} 件`
    )
    for (const file of stored === undefined ? [] : changed) {
      console.log(`  - ${file}`)
    }
    console.log(
      `fingerprint-tests: 次の npm run test:mutation が取り除く、前回落とした変異体 ${dropped} 体。変異体を落としたテストのファイルで今の指紋に無いもの ${outsideKillers.length} 件`
    )
    for (const file of outsideKillers) {
      console.log(`  - ${file}`)
    }
  } else {
    console.log(
      `fingerprint-tests: 結果ファイル(${incrementalFile})が無い。次の npm run test:mutation は、ほかの作業ツリーから写さなければ全部を走らせる`
    )
  }
}
