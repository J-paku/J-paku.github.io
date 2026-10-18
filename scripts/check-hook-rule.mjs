// フックを呼ぶ所の検査(docs/decisions/0019-hooks-make-containers.md)。ESLint の規則 layer/hook-only-in-container
// (scripts/eslint-rules/hook-only-in-container.mjs)が正しく判定し、eslint.config.mjs が正しい所に掛けていることを確かめてから、
// 実際の src を lint して違反を数える。
//
// 確かめること(1〜3 は自己検査。期待と違えば検査そのものが壊れているので、理由を出して落とす):
//   1. 規則の判定   — 偽のコードの断片を ESLint の Linter で規則だけに掛け、拾ったフックの名前(出る順)が期待とぴったり同じか。
//                     useState()・React.useMemo() は拾い、memo()・forwardRef()・use()・user()・呼ばない useless は拾わない。
//                     フックを別の名前で受ける所(import { useState as state }・const s = useState・const { useState: s } = React など)も
//                     「useState as s」の形で拾い、同じ名前で受けるもの(import { useState })は拾わない
//   2. 設定の掛け方 — 実際の eslint.config.mjs で、偽のパスに置いた断片を lint し、拾う数が期待とぴったり同じか。
//                     表示部品の index.tsx・utils などには掛かり、container.tsx・hooks/ の use-*.ts(x)・テストの側
//                     (*.test.ts(x)・*.fixture.ts・*.test-helper.ts)では外れる
//                     (別の名前で受ける所の報告も同じ所で外れる)。コンテナのフォルダに置く統合テスト(container.tsx の隣の
//                     container.integration.test.tsx と __tests__/ の中)と、その部品・フィクスチャも、外れる側にあって lint の対象の外になっていないかを見る
//   3. 名前の決まり — 規則が外れてよいファイルを、eslint.config.mjs とは別に名前で決める(container.tsx・hooks/ の中の use-*.ts(x)・
//                     *.test.ts(x)・*.fixture.ts・*.test-helper.ts だけ)。その決まりが 2 の掛かるパス・外れるパスと合うかと、
//                     実際の設定に偽の抜け道(規則の組みの ignores に表示部品のパスやフォルダを足す・後ろの組みで off や warn にする・
//                     ignores から *.fixture.ts を外す)を入れた設定で、4 の突き合わせがその抜け道のファイルだけを拾うかを見る
//   4. 実際の src   — src の *.ts・*.tsx のすべてで、規則が error で掛かるかを 3 の名前の決まりと突き合わせ、1件でも違えば落とす。
//                     ignores に実在のパスを足すとそのファイルは lint も 2 も通り、掛かるファイルの数が1つ減るだけになるため。
//                     そのうえで eslint.config.mjs で lint し、この規則の違反を数える。1件でもあれば落とす。
//                     eslint-disable の注釈で黙らせた呼び出しも違反に数える(注釈は外す所に入っていない)
//
// ESLint の ignores(.claude/** など)は、設定の基準のフォルダ(cwd か、探し当てた設定ファイルのフォルダ)からのパスで当たる。
// 基準が親のリポジトリになると(作業ツリーは親の .claude/worktrees/ の下にある)、作業ツリーのファイルは全部 .claude/** に当たって
// 無視され、何も検査しないまま通る。そこで cwd と設定ファイルをこのファイルの場所から求めて渡し(基準は cwd になる)、
// lint するファイルが1件も無視されていないことと、規則が error で掛かるファイルが1件以上あることも確かめる。
// lint はこの規則だけを走らせる(ruleFilter)。ほかの規則は npm run lint が見る。
//
// 使い方: node scripts/check-hook-rule.mjs(npm run test:boundary)
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ESLint, Linter } from 'eslint'
import hookOnlyInContainer from './eslint-rules/hook-only-in-container.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')
const SKIP_DIRS = new Set(['node_modules', '.git'])
// 規則を掛ける範囲(eslint.config.mjs の files と同じ src/**/*.{ts,tsx})
const CODE_FILE = /\.tsx?$/
const RULE_ID = 'layer/hook-only-in-container'
// 設定を読んだ後の規則の重さ。error は 2
const ERROR = 2
// 実際の設定で lint するときの指定。基準のフォルダをリポジトリ直下に固定し、この規則だけを走らせる
const ESLINT_OPTIONS = {
  cwd: ROOT,
  overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
  ruleFilter: ({ ruleId }) => ruleId === RULE_ID,
}
// 報告の文面の型(規則の messages)を、埋める所 {{…}} で区切って正規表現にしたもの。報告から、埋めた値を取り出すのに使う
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patternOf = template =>
  new RegExp(
    `^${template
      .split(/\{\{\w+\}\}/)
      .map(escapeRegExp)
      .join('([\\s\\S]+?)')}$`
  )
const { hookCall, hookAlias } = hookOnlyInContainer.meta.messages
// フックの呼び出し(埋めるのはフックの名前)と、フックを別の名前で受ける所(フックの名前と、受ける名前)
const CALL_PATTERN = patternOf(hookCall)
const ALIAS_PATTERN = patternOf(hookAlias)

// 壊れたシンボリックリンクで statSync が例外を投げないよう、実体の無い入口は集める前に落とす
const walk = dir =>
  readdirSync(dir).flatMap(name => {
    if (SKIP_DIRS.has(name)) return []
    const p = path.join(dir, name)
    const stat = statSync(p, { throwIfNoEntry: false })
    if (stat === undefined) return []
    return stat.isDirectory() ? walk(p) : [p]
  })

const toPosix = p => p.split(path.sep).join('/')

const relativeOf = ({ filePath }) => toPosix(path.relative(ROOT, filePath))

// この規則の報告。eslint-disable の注釈で黙らせたもの(suppressedMessages)も数える
const hookCallsOf = result =>
  [...result.messages, ...result.suppressedMessages].filter(({ ruleId }) => ruleId === RULE_ID)

// 構文の誤りで読めなかった報告(読めないファイルはフックの呼び出しを見られない)
const fatalsOf = result => result.messages.filter(({ fatal }) => fatal === true)

// 報告を、拾ったフックの名前にする(別の名前で受ける所は「フックの名前 as 受ける名前」)。
// この規則でない報告(構文の誤りなど)と、どちらの文面の型にも合わない報告は、分かる形でそのまま残す
const nameOf = ({ ruleId, message }) => {
  const call = ruleId === RULE_ID ? CALL_PATTERN.exec(message) : null
  if (call !== null) return call[1]
  const alias = ruleId === RULE_ID ? ALIAS_PATTERN.exec(message) : null
  if (alias !== null) return `${alias[1]} as ${alias[2]}`
  return `(${ruleId ?? '構文'}: ${message})`
}
const namesOf = messages => messages.map(nameOf)

// ---- 自己検査 1: 規則の判定 ----
// 呼ぶ相手の名前の取り方が壊れると、フックを呼ぶ表示部品を見逃したまま「違反なし」で通る(memo() などを拾えば誤って落ちる)。
// そこで偽のコードの断片を規則だけの設定で Linter に掛け、拾ったフックの名前(出る順)が期待とぴったり同じでなければ落とす。
// 型の書き方(useRef<T>(…)・as・!)を含む断片は TypeScript の構文を読む実際の設定でしか読めないので、自己検査 2 が見る
const RULE_ONLY = [
  {
    files: ['**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { layer: { rules: { 'hook-only-in-container': hookOnlyInContainer } } },
    rules: { [RULE_ID]: 'error' },
  },
]
// [コード, 拾うフックの名前(出る順)]
const RULE_CASES = [
  // 拾う(識別子・メンバー・[…] で引くもの・?. の呼び出し・入れ子・JSX の中・数字が続く名前)
  ['const [count] = useState(0)', ['useState']],
  ['const value = React.useMemo(() => 0, [])', ['useMemo']],
  [`const id = React['useId']()`, ['useId']],
  ['const id = React[`useId`]()', ['useId']],
  ['const value = store.slice.useThing()', ['useThing']],
  ['const shape = use3d()', ['use3d']],
  ['useState?.(0)\nReact?.useRef(null)', ['useState', 'useRef']],
  ['const ref = (React?.useRef)(null)', ['useRef']],
  ['useOuter(useInner())', ['useOuter', 'useInner']],
  ['const view = <p>{useLabel()}</p>', ['useLabel']],
  [
    'export default function Fake() {\n  const ref = useRef(null)\n  return <div ref={ref} />\n}',
    ['useRef'],
  ],
  // 別の名前で受ける所を拾う(import・変数・代入・既定値・分割・引数の分割。受ける名前がフックの名前でも違えば拾う)
  ['const hook = useState', ['useState as hook']],
  [`import { useState as state } from 'react'`, ['useState as state']],
  [`import { useState as useMyState, useRef } from 'react'`, ['useState as useMyState']],
  [`import { 'useId' as id } from 'react'`, ['useId as id']],
  ['const s = React.useState', ['useState as s']],
  [`const s = React['useState']`, ['useState as s']],
  ['const s = React?.useState', ['useState as s']],
  ['const s = store.slice.useThing', ['useThing as s']],
  ['let s\ns = useState', ['useState as s']],
  ['const api = {}\napi.load = React.useMemo', ['useMemo as api.load']],
  ['const load = (s = useState) => s', ['useState as s']],
  ['const { useState: s } = React', ['useState as s']],
  ['const { useState: s = fallback } = React', ['useState as s']],
  [`const { 'useState': s } = React`, ['useState as s']],
  [`const { ['useId']: id } = React`, ['useId as id']],
  ['export const pick = () => ({ useState: s } = React)', ['useState as s']],
  ['function Fake({ useLabel: label }) {\n  return label\n}', ['useLabel as label']],
  // 呼び出しの結果を受けるのは、呼び出しだけを拾う(受ける所として二重に拾わない)
  ['const label = useLabel()\nconst ref = React.useRef(null)', ['useLabel', 'useRef']],
  // 拾わない(フックでない呼び出し・名前が合わない呼び出し・呼ばない名前・JSX の属性名・注釈と文字列の中)
  ['export default memo(function Fake() {\n  return null\n})', []],
  ['const Fake = forwardRef((props, ref) => <div ref={ref} />)', []],
  ['const Fake = React.memo(Base)', []],
  ['const value = use(promise)', []],
  ['const value = React.use(promise)', []],
  ['user()\nprofile.user()', []],
  ['usestate()\nuseless()', []],
  ['const useless = 1\nexport const value = useless', []],
  ['const view = <Fake useLabel={label} />', []],
  [`// useState(0)\nconst label = 'useState(0)'`, []],
  // 拾わない(同じ名前で受ける・フックでない名前を受ける・分割でないオブジェクトのキー)
  [`import { useState } from 'react'`, []],
  [`import { memo as useMemo } from 'react'`, []],
  [`import * as React from 'react'\nimport useFake from './use-fake'`, []],
  ['const useState = React.useState', []],
  ['const { useState } = React', []],
  ['const { useState = fallback } = React', []],
  ['const { user: u, useless: v } = React', []],
  ['const s = useless\nconst t = React.user\nconst u = React[name]', []],
  ['const value = { useLabel: label }', []],
]
const linter = new Linter({ cwd: ROOT })
const FAKE_VIEW = path.join(ROOT, 'src/components/Fake/index.tsx')
const ruleFailures = []
for (const [code, expected] of RULE_CASES) {
  const found = namesOf(linter.verify(code, RULE_ONLY, { filename: FAKE_VIEW }))
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    ruleFailures.push(
      `規則の判定 ${JSON.stringify(code)}: 拾った ${JSON.stringify(found)}(期待 ${JSON.stringify(expected)})`
    )
  }
}
if (ruleFailures.length > 0) {
  throw new Error(
    `check-hook-rule: 自己検査(規則の判定)に失敗(期待と違う判定): ${ruleFailures.join(', ')}`
  )
}

// ---- 自己検査 2: 設定の掛け方 ----
// eslint.config.mjs の files・ignores が壊れると(パスの書き違い・外しすぎ)、表示部品に規則が掛からないまま「違反なし」で通る。
// そこで実際の設定で、フックを呼ぶ断片を偽のパスに置いたものとして lint し、拾う数が期待とぴったり同じでなければ落とす。
// 掛かるか外れるかはパスだけで決まるので、パスは実在しなくてよい
const eslint = new ESLint(ESLINT_OPTIONS)
// フックを2つ呼ぶ断片(.ts と .tsx のどちらでも読める形)
const TWO_HOOKS = [
  `import { useRef, useState } from 'react'`,
  'export default function Fake() {',
  '  const [count] = useState<number>(0)',
  '  const ref = useRef<HTMLDivElement>(null)',
  '  return [count, ref]',
  '}',
].join('\n')
// 型の書き方で包んだ呼ぶ相手を5つ(<T>x の形は .tsx で読めないので .ts に置く)
const WRAPPED_HOOKS = [
  'const a = useState!(0)',
  'const b = (useState as typeof useState)(0)',
  'const c = (useState satisfies typeof useState)(0)',
  'const d = (useState<number>)(0)',
  'const e = (<typeof useState>useState)(0)',
].join('\n')
// フックを別の名前で受ける所を3つ(.ts と .tsx のどちらでも読める形)
const THREE_ALIASES = [
  `import React, { useState as state } from 'react'`,
  'const ref = React.useRef',
  'const { useId: id } = React',
  'export const all = [state, ref, id]',
].join('\n')
// 型の書き方で包んだ値を別の名前で受ける所を5つ(.ts に置く)
const WRAPPED_ALIASES = [
  'const a = useState!',
  'const b = useState as typeof useState',
  'const c = useState satisfies typeof useState',
  'const d = React.useState<number>',
  'const e = <typeof useState>useState',
].join('\n')
// 型だけの import は値にならず呼べないので、別の名前で受けても拾わない
const TYPE_ONLY_ALIASES = [
  `import type { useState as State } from 'react'`,
  `import { type useRef as Ref } from 'react'`,
  'export type Hooks = [typeof State, typeof Ref]',
].join('\n')
// 規則が掛かるパス。表示部品・utils・lib・app と、名前が container.tsx・hooks/ の use-*.ts(x) に似ているだけのもの
const RULED_PATHS = [
  'src/components/Fake/index.tsx',
  'src/components/Fake/components/Part/index.tsx',
  'src/components/Fake/my-container.tsx',
  'src/components/Fake/container.ts',
  'src/components/Fake/use-fake.ts',
  'src/components/Fake/hooks/fake.ts',
  'src/components/use-hooks/use-fake.ts',
  'src/hooks/fake.ts',
  'src/utils/fake.ts',
  'src/lib/fake.ts',
  'src/app/page.tsx',
]
// 規則が外れるパス。コンテナ・hooks/ の use-*.ts(x)(フォルダにしたフックと src/hooks/ も)・テストの側
// (コンテナのフォルダの統合テスト・部品・フィクスチャは container.tsx の隣と __tests__/ の中の両方。ADR 0022)
const EXEMPT_PATHS = [
  'src/components/Fake/container.tsx',
  'src/components/Fake/components/Part/container.tsx',
  'src/components/Fake/hooks/use-fake.ts',
  'src/components/Fake/hooks/use-fake.tsx',
  'src/components/Fake/hooks/use-fake/use-fake-draft.ts',
  'src/hooks/use-fake.ts',
  'src/components/Fake/index.test.tsx',
  'src/utils/fake.test.ts',
  'src/components/Fake/container.fixture.ts',
  'src/components/Fake/fake.test-helper.ts',
  'src/components/Fake/container.integration.test.tsx',
  'src/components/Fake/__tests__/open-modal.integration.test.tsx',
  'src/components/Fake/__tests__/fake.test-helper.ts',
  'src/components/Fake/__tests__/container.fixture.ts',
]
// [パス, コード, 拾う数]
const CONFIG_CASES = [
  ...RULED_PATHS.map(file => [file, TWO_HOOKS, 2]),
  ...RULED_PATHS.map(file => [file, THREE_ALIASES, 3]),
  ['src/utils/fake.ts', WRAPPED_HOOKS, 5],
  ['src/utils/fake.ts', WRAPPED_ALIASES, 5],
  ['src/utils/fake.ts', TYPE_ONLY_ALIASES, 0],
  ...EXEMPT_PATHS.map(file => [file, TWO_HOOKS, 0]),
  ...EXEMPT_PATHS.map(file => [file, THREE_ALIASES, 0]),
  // eslint-disable の注釈で黙らせても数える
  ['src/components/Fake/index.tsx', `// eslint-disable-next-line ${RULE_ID}\nuseFake()`, 1],
  ['src/components/Fake/components/Part/index.tsx', '/* eslint-disable */\nuseFake()', 1],
]
const configFailures = []
for (const [file, code, expected] of CONFIG_CASES) {
  if (await eslint.isPathIgnored(file)) {
    configFailures.push(`設定の掛け方 ${file}: lint の対象の外(無視されている)`)
    continue
  }
  const [result] = await eslint.lintText(code, { filePath: file })
  const fatal = fatalsOf(result)[0]
  const count = hookCallsOf(result).length
  if (fatal !== undefined) {
    configFailures.push(`設定の掛け方 ${file}: 断片を読めない(${fatal.message})`)
  } else if (count !== expected) {
    configFailures.push(`設定の掛け方 ${file}: 拾った ${count} 件(期待 ${expected})`)
  }
}
if (configFailures.length > 0) {
  throw new Error(
    `check-hook-rule: 自己検査(設定の掛け方)に失敗(期待と違う判定): ${configFailures.join(', ')}`
  )
}

// 設定を読んだ後のファイルの組みに、この規則が error で掛かるか(lint の対象の外のファイルは undefined)
const isRuled = config => config?.rules?.[RULE_ID]?.[0] === ERROR

// パス → 設定を読んだ後のファイルの組み
const configsOf = async (engine, files) =>
  new Map(
    await Promise.all(files.map(async file => [file, await engine.calculateConfigForFile(file)]))
  )

// ---- 名前の決まり ----
// 規則が外れてよいのは、名前でこれと決まるファイルだけ(ADR 0019)。eslint.config.mjs の ignores とは別にここで書き、実際の設定と突き合わせる。
// 設定の ignores に実在のパス(表示部品の index.tsx など)を足すと、そのファイルは lint も自己検査 2 も通り、掛かるファイルの数が1つ減るだけになるため
const EXEMPT_NAMES = [/^container\.tsx$/, /\.test\.tsx?$/, /\.fixture\.ts$/, /\.test-helper\.ts$/]
// hooks/ の中(フォルダにしたフックの入れ子も)の use-*.ts(x)。use-hooks/ のような名前のフォルダは hooks/ に数えない
const HOOK_FILE = /(^|\/)hooks\/(?:[^/]+\/)*use-[^/]*\.tsx?$/
const isExemptByName = file =>
  HOOK_FILE.test(file) || EXEMPT_NAMES.some(pattern => pattern.test(path.posix.basename(file)))
// 突き合わせの報告(掛かるはずのファイルに掛からない・外れるはずのファイルに掛かる)
const missedAt = file => `${file}(掛かるはずなのに掛からない)`
const extraAt = file => `${file}(外れるはずなのに掛かる)`

// 規則の掛かり方が名前の決まりと合わないファイル。configOf はパス → 設定を読んだ後のファイルの組み
const mismatchesOf = (files, configOf) =>
  files.flatMap(file => {
    const expected = !isExemptByName(file)
    if (isRuled(configOf.get(file)) === expected) return []
    return [expected ? missedAt(file) : extraAt(file)]
  })

// ---- 自己検査 3: 名前の決まり ----
// 名前の決まりが壊れると(外れる名前を足しすぎる・書き違える)、下の突き合わせは抜け道を見逃す。
// そこで決まりを自己検査 2 の掛かるパス・外れるパスで確かめ、さらに実際の eslint.config.mjs に偽の抜け道を入れた設定で、
// 同じパスの突き合わせがその抜け道のファイルだけをぴったり拾うかを見る(抜け道の無い設定では何も拾わない)
const actualConfig = (await import(pathToFileURL(path.join(ROOT, 'eslint.config.mjs')).href))
  .default
const ruleBlocks = actualConfig.filter(block => block.rules?.[RULE_ID] !== undefined)
// 規則を掛ける組みの ignores を書き換えた設定
const withIgnores = edit =>
  actualConfig.map(block =>
    block === ruleBlocks[0] ? { ...block, ignores: edit(block.ignores ?? []) } : block
  )
// 後ろに組みを1つ足した設定
const withBlock = block => [...actualConfig, block]
const CHECKED_PATHS = [...RULED_PATHS, ...EXEMPT_PATHS]
// [抜け道, 設定, 突き合わせが拾うもの]
const BYPASS_CASES = [
  ['抜け道なし', actualConfig, []],
  // 検証で見つかった抜け道。規則の組みの ignores に実在のパスを足すと、lint も自己検査 2 も通った
  [
    'ignores に表示部品のパスを足す',
    withIgnores(ignores => [...ignores, 'src/components/Fake/index.tsx']),
    [missedAt('src/components/Fake/index.tsx')],
  ],
  [
    'ignores にフォルダを足す',
    withIgnores(ignores => [...ignores, 'src/utils/**']),
    [missedAt('src/utils/fake.ts')],
  ],
  [
    '後ろの組みで off にする',
    withBlock({ files: ['src/lib/fake.ts'], rules: { [RULE_ID]: 'off' } }),
    [missedAt('src/lib/fake.ts')],
  ],
  [
    '後ろの組みで warn にする',
    withBlock({ files: ['src/app/page.tsx'], rules: { [RULE_ID]: 'warn' } }),
    [missedAt('src/app/page.tsx')],
  ],
  [
    'ignores から *.fixture.ts を外す',
    withIgnores(ignores => ignores.filter(pattern => pattern !== '**/*.fixture.ts')),
    [
      extraAt('src/components/Fake/container.fixture.ts'),
      extraAt('src/components/Fake/__tests__/container.fixture.ts'),
    ],
  ],
]
const nameFailures = [
  ...(ruleBlocks.length !== 1
    ? [
        `規則 ${RULE_ID} を掛ける組みが ${ruleBlocks.length} 個(偽の抜け道を入れる先が1つに決まらない)`,
      ]
    : []),
  ...RULED_PATHS.filter(isExemptByName).map(file => `名前の決まり ${file}: 外れる(期待は掛かる)`),
  ...EXEMPT_PATHS.filter(file => !isExemptByName(file)).map(
    file => `名前の決まり ${file}: 掛かる(期待は外れる)`
  ),
]
for (const [bypass, config, expected] of BYPASS_CASES) {
  const engine = new ESLint({ cwd: ROOT, overrideConfigFile: true, overrideConfig: config })
  const found = mismatchesOf(CHECKED_PATHS, await configsOf(engine, CHECKED_PATHS))
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    nameFailures.push(
      `抜け道「${bypass}」: 拾った ${JSON.stringify(found)}(期待 ${JSON.stringify(expected)})`
    )
  }
}
if (nameFailures.length > 0) {
  throw new Error(
    `check-hook-rule: 自己検査(名前の決まり)に失敗(期待と違う判定): ${nameFailures.join(', ')}`
  )
}

// ---- 実際の src ----
const files = (existsSync(SRC_DIR) ? walk(SRC_DIR) : [])
  .map(file => toPosix(path.relative(ROOT, file)))
  .filter(file => CODE_FILE.test(file))
  .sort()

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (files.length === 0) {
  console.error('check-hook-rule: src に *.ts・*.tsx が1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

// 無視されたファイルは lint されず、違反を数えられない。規則が error で掛かるファイルが無ければ、掛け方を間違えている
const configOf = await configsOf(eslint, files)
const ignored = files.filter(file => configOf.get(file) === undefined)
if (ignored.length > 0) {
  console.error(
    `check-hook-rule: src のファイルが lint の対象の外になっている(eslint.config.mjs の ignores か、基準のフォルダを疑う): ${ignored.join(', ')}`
  )
  process.exit(1)
}
// 規則が掛かるかは、ファイルごとに名前の決まりと合わなければならない(ignores に実在のパスを足す抜け道を塞ぐ)
const mismatches = mismatchesOf(files, configOf)
if (mismatches.length > 0) {
  console.error(
    `check-hook-rule: 規則 ${RULE_ID} の掛かり方が名前の決まりと合わない src のファイル ${mismatches.length} 件。` +
      '規則が外れてよいのは container.tsx・hooks/ の中の use-*.ts(x)・*.test.ts(x)・*.fixture.ts・*.test-helper.ts だけ。' +
      'eslint.config.mjs の規則の組みの files・ignores と、後ろの組みでの上書きを直す。フックを呼ぶ部品なら、外すのではなく container.tsx にする(ADR 0019)'
  )
  for (const line of mismatches) console.error(`  - ${line}`)
  process.exit(1)
}
const ruledCount = files.filter(file => isRuled(configOf.get(file))).length
if (ruledCount === 0) {
  console.error(
    `check-hook-rule: 規則 ${RULE_ID} が error で掛かる src のファイルが1件も無い。eslint.config.mjs の files を疑うこと`
  )
  process.exit(1)
}

const results = await eslint.lintFiles(files)
const unreadable = results.filter(result => fatalsOf(result).length > 0)
if (results.length !== files.length || unreadable.length > 0) {
  console.error(
    `check-hook-rule: lint の結果 ${results.length} 件(ファイル ${files.length} 件)。構文の誤りで読めないファイル ${unreadable.length} 件(読めないとフックの呼び出しを見られない)`
  )
  for (const result of unreadable) {
    console.error(`  - ${relativeOf(result)}: ${fatalsOf(result)[0].message}`)
  }
  process.exit(1)
}

const violations = []
for (const result of results) {
  for (const { line, column, message } of hookCallsOf(result)) {
    violations.push(`${relativeOf(result)}:${line}:${column}: ${message}`)
  }
}
if (violations.length > 0) {
  console.error(`check-hook-rule: フックの呼び出しの違反 ${violations.length} 件(${RULE_ID})`)
  for (const line of violations) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(
  `check-hook-rule: 自己検査(規則の判定 ${RULE_CASES.length} 件・設定の掛け方 ${CONFIG_CASES.length} 件・名前の決まり ${CHECKED_PATHS.length + BYPASS_CASES.length} 件)を通り、src の *.ts・*.tsx ${files.length} 件(規則が error で掛かるもの ${ruledCount} 件。掛かり方は全件が名前の決まりどおり)を検査 — フックの呼び出しの違反 0 件`
)
