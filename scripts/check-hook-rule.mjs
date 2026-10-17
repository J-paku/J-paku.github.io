// フックを呼ぶ所の検査(docs/decisions/0019-hooks-make-containers.md)。ESLint の規則 layer/hook-only-in-container
// (scripts/eslint-rules/hook-only-in-container.mjs)が正しく判定し、eslint.config.mjs が正しい所に掛けていることを確かめてから、
// 実際の src を lint して違反を数える。
//
// 確かめること(1・2 は自己検査。期待と違えば検査そのものが壊れているので、理由を出して落とす):
//   1. 規則の判定   — 偽のコードの断片を ESLint の Linter で規則だけに掛け、拾ったフックの名前(出る順)が期待とぴったり同じか。
//                     useState()・React.useMemo() は拾い、memo()・forwardRef()・use()・user()・呼ばない useless は拾わない。
//                     フックを別の名前で受ける所(import { useState as state }・const s = useState・const { useState: s } = React など)も
//                     「useState as s」の形で拾い、同じ名前で受けるもの(import { useState })は拾わない
//   2. 設定の掛け方 — 実際の eslint.config.mjs で、偽のパスに置いた断片を lint し、拾う数が期待とぴったり同じか。
//                     表示部品の index.tsx・utils などには掛かり、container.tsx・hooks/ の use-*.ts(x)・テストの側
//                     (*.test.ts(x)・*.fixture.ts・*.test-helper.ts)・待ちの一覧(PENDING_CONTAINER_FILES)では外れる
//                     (別の名前で受ける所の報告も同じ所で外れる)。統合テストを置く __tests__/ が lint の対象の外になっていないかも見る
//   3. 待ちの一覧の判定 — 偽の一覧と偽の中身を下の 5 と同じ関数で判定し、古くなった項目と理由が期待とぴったり同じか
//   4. 実際の src   — src の *.ts・*.tsx をすべて eslint.config.mjs で lint し、この規則の違反を数える。1件でもあれば落とす。
//                     eslint-disable の注釈で黙らせた呼び出しも違反に数える(注釈は外す所に入っていない)
//   5. 待ちの一覧   — PENDING_CONTAINER_FILES のファイルが実在し、一覧が無くても規則が外れる名前(container.tsx・hooks/ の use-*.ts(x)・
//                     テストの側)でなく、まだ規則に違反しているか(フックを呼ぶか、別の名前で受けるか)。どれかに外れた項目は
//                     一覧から外す(一覧は減るだけ。残すと、外れたままの所にフックの呼び出しを足せてしまう)。
//                     この判定は、ここだけが持つ(check-test-boundary.mjs は PENDING_HOOK_DIRS だけを見る)
//
// ESLint の ignores(.claude/** など)は、設定の基準のフォルダ(cwd か、探し当てた設定ファイルのフォルダ)からのパスで当たる。
// 基準が親のリポジトリになると(作業ツリーは親の .claude/worktrees/ の下にある)、作業ツリーのファイルは全部 .claude/** に当たって
// 無視され、何も検査しないまま通る。そこで cwd と設定ファイルをこのファイルの場所から求めて渡し(基準は cwd になる)、
// lint するファイルが1件も無視されていないことと、規則が error で掛かるファイルが1件以上あることも確かめる。
// lint はこの規則だけを走らせる(ruleFilter)。ほかの規則は npm run lint が見る。
//
// 使い方: node scripts/check-hook-rule.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint, Linter } from 'eslint'
import eslintConfig from '../eslint.config.mjs'
import { PENDING_CONTAINER_FILES } from './container-dirs.mjs'
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
// 規則が外れるパス。コンテナ・hooks/ の use-*.ts(x)(フォルダにしたフックと src/hooks/ も)・テストの側・待ちの一覧
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
  ...PENDING_CONTAINER_FILES,
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
// lint の対象の外になっていてはいけないパス(規則が掛かるかは問わない)。統合テストは src の外の __tests__/ に置く
const LINTED_PATHS = ['__tests__/story/story-body/open-modal.integration.test.tsx']
const configFailures = []
for (const file of LINTED_PATHS) {
  if (await eslint.isPathIgnored(file)) {
    configFailures.push(`設定の掛け方 ${file}: lint の対象の外(無視されている)`)
  }
}
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

// ---- 自己検査 3: 待ちの一覧の判定 ----
// 待ちの一覧の項目が、一覧が無くても規則が外れる名前(container.tsx など)になったかを見るため、実際の設定から、
// 規則を掛ける組みの ignores に並べた待ちの一覧だけを抜いた設定を作る。規則を掛ける組みはただ1つのはずで、
// 0 か 2 以上なら eslint.config.mjs の形が変わっていて、抜く所を決められない
const ruleBlocks = eslintConfig.filter(block => block.rules?.[RULE_ID] !== undefined)
if (ruleBlocks.length !== 1) {
  throw new Error(
    `check-hook-rule: eslint.config.mjs で規則 ${RULE_ID} を書いた組みが ${ruleBlocks.length} 個(期待 1)。待ちの一覧を抜いた設定を作れない`
  )
}
const withoutPending = eslintConfig.map(block =>
  ruleBlocks.includes(block) && block.ignores !== undefined
    ? { ...block, ignores: block.ignores.filter(item => !PENDING_CONTAINER_FILES.includes(item)) }
    : block
)
const bareEslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: withoutPending,
  ruleFilter: ESLINT_OPTIONS.ruleFilter,
})

// 待ちの一覧の項目のうち古くなったものを { file, reason } で返す(並びは一覧の順)。readCode は中身を返す(無いファイルは undefined)。
//   gone       — ファイルが無い
//   exempt     — 一覧が無くても規則が外れる名前(container.tsx・hooks/ の use-*.ts(x)・テストの側)
//   settled    — 規則を掛け直して lint しても、もう違反しない(フックを呼ばず、別の名前で受けもしない)
//   unreadable — 構文の誤りで読めない(読めないと、違反しないのか分からない)
// 外したままの設定では数えられないので、一覧のファイルにだけ規則を掛け直して lint する。
// files に空の配列は書けないので、一覧が空なら見ない
const pendingStalesOf = async (list, readCode) => {
  if (list.length === 0) return []
  const forced = new ESLint({
    ...ESLINT_OPTIONS,
    overrideConfig: [{ files: list, rules: { [RULE_ID]: 'error' } }],
  })
  const stales = []
  for (const file of list) {
    const code = readCode(file)
    if (code === undefined) {
      stales.push({ file, reason: 'gone' })
    } else if (!isRuled(await bareEslint.calculateConfigForFile(file))) {
      stales.push({ file, reason: 'exempt' })
    } else {
      const [result] = await forced.lintText(code, { filePath: file })
      if (fatalsOf(result).length > 0) stales.push({ file, reason: 'unreadable' })
      else if (hookCallsOf(result).length === 0) stales.push({ file, reason: 'settled' })
    }
  }
  return stales
}

// 一覧の判定が壊れると、古い項目が残ったまま(外れたままの所にフックを足せるまま)通るか、生きている項目を誤って落とす。
// そこで偽の一覧と中身(パス → 中身。無いファイルは undefined)を判定し、古い項目と理由が期待とぴったり同じでなければ落とす。
// 本物の一覧の先頭の項目も1つ入れる(待ちの一覧を抜いた設定が壊れて、本物の項目を「外れる名前」と見ないか)
const FAKE_PENDING = new Map([
  // 古くない(まだフックを呼ぶ・別の名前で受ける・注釈で黙らせても呼ぶ・本物の一覧の項目)
  ['src/components/Fake/components/Wait/index.tsx', 'const a = useWait()'],
  ['src/components/Fake/components/Ref/index.tsx', 'const r = React.useRef(null)'],
  [
    'src/components/Fake/components/Alias/index.tsx',
    `import { useState as state } from 'react'\nexport const s = state`,
  ],
  [
    'src/components/Fake/components/Quiet/index.tsx',
    `// eslint-disable-next-line ${RULE_ID}\nuseFake()`,
  ],
  ...PENDING_CONTAINER_FILES.slice(0, 1).map(file => [file, 'const a = useWait()']),
  // 古い(もうフックを呼ばない・無い・一覧が無くても外れる名前・読めない)
  [
    'src/components/Fake/components/Pure/index.tsx',
    `// useWait()\nconst label = 'useWait()'\nconst a = user()`,
  ],
  ['src/components/Fake/components/Missing/index.tsx', undefined],
  ['src/components/Fake/components/Done/container.tsx', 'const a = useDone()'],
  ['src/hooks/use-fake.ts', 'export const useFake = () => useState(0)'],
  ['src/components/Fake/fake.test-helper.ts', 'const a = useFake()'],
  ['src/components/Fake/components/Broken/index.tsx', 'const a = useBroken('],
])
const EXPECTED_STALES = [
  'src/components/Fake/components/Pure/index.tsx settled',
  'src/components/Fake/components/Missing/index.tsx gone',
  'src/components/Fake/components/Done/container.tsx exempt',
  'src/hooks/use-fake.ts exempt',
  'src/components/Fake/fake.test-helper.ts exempt',
  'src/components/Fake/components/Broken/index.tsx unreadable',
]
const fakeStales = (
  await pendingStalesOf([...FAKE_PENDING.keys()], file => FAKE_PENDING.get(file))
).map(({ file, reason }) => `${file} ${reason}`)
if (JSON.stringify(fakeStales) !== JSON.stringify(EXPECTED_STALES)) {
  throw new Error(
    `check-hook-rule: 自己検査(待ちの一覧の判定)に失敗(期待と違う判定): 古いと見た ${JSON.stringify(fakeStales)}(期待 ${JSON.stringify(EXPECTED_STALES)})`
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
const configOf = new Map(
  await Promise.all(files.map(async file => [file, await eslint.calculateConfigForFile(file)]))
)
const ignored = files.filter(file => configOf.get(file) === undefined)
if (ignored.length > 0) {
  console.error(
    `check-hook-rule: src のファイルが lint の対象の外になっている(eslint.config.mjs の ignores か、基準のフォルダを疑う): ${ignored.join(', ')}`
  )
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

// ---- 待ちの一覧 ----
// 理由ごとの文面。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const STALE_REASONS = new Map([
  ['gone', 'ファイルが無い。一覧から外す'],
  [
    'exempt',
    '一覧が無くても規則が外れる名前(container.tsx・hooks/ の use-*.ts(x)・テストの側)になった。一覧から外す(一覧は減るだけ)',
  ],
  [
    'settled',
    'もう規則に違反しない(フックを呼ばず、フックを別の名前で受けもしない)。一覧から外す(一覧は減るだけ)',
  ],
  ['unreadable', '構文の誤りで読めない(読めないと、まだ違反しているのか分からない)'],
])
const readReal = file => {
  const p = path.join(ROOT, file)
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined
}
const stales = await pendingStalesOf(PENDING_CONTAINER_FILES, readReal)
if (stales.length > 0) {
  console.error(
    `check-hook-rule: 待ちの一覧(scripts/container-dirs.mjs の PENDING_CONTAINER_FILES)の古い項目 ${stales.length} 件`
  )
  for (const { file, reason } of stales) console.error(`  - ${file}: ${STALE_REASONS.get(reason)}`)
  process.exit(1)
}

console.log(
  `check-hook-rule: 自己検査(規則の判定 ${RULE_CASES.length} 件・設定の掛け方 ${CONFIG_CASES.length + LINTED_PATHS.length} 件・待ちの一覧の判定 ${FAKE_PENDING.size} 件)を通り、src の *.ts・*.tsx ${files.length} 件(規則が error で掛かるもの ${ruledCount} 件)と待ちの一覧 ${PENDING_CONTAINER_FILES.length} 件を検査 — フックの呼び出しの違反 0 件`
)
