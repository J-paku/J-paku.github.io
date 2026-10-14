// テストの置き場の境界検査。フック(hooks/ 配下)に単体テストを置いていないかと、
// フックを renderHook で呼ぶテストが src のどこにも無いかと、コンポーネントを描くテストがコンテナの統合テストの外に無いかを見る。
//
// 決まり: ロジックは純粋関数(src/lib/・utils/)に置き、単体テストと変異テストで固める。
// フックは単体テストを置かない層で、動きはそのフックを使うコンポーネントを統合テスト(*.browser.test.tsx)で描いて見る
// (統合テストへ移し終えるまでは E2E が見る。vitest.config.ts のカバレッジでも測らない)。
// hooks/ の外へテストを移しても、renderHook でフックを呼べば同じことになるので、それも落とす。
// ストアを import して getState() で状態を戻すだけのテストは、フックを描かないので落とさない。
// 例外を許す一覧は持たない(移し終えて 0 件になった。足したくなったら、ロジックを純粋関数へ切り出してそちらで測る)。
//
// 加えて、コンポーネントを描くテストの置き場を見る(ADR 0017 の D5)。コンポーネントを描くのはコンテナの統合テストだけ。
// コンテナを置くフォルダは一覧(scripts/container-dirs.mjs。check-layers.mjs と同じもの)で決まる。
//   - *.test.tsx(単体の設定 vitest.config.ts が拾う名前)は src のどこにも置かない
//   - *.browser.test.ts・*.browser.test.tsx は、名前がちょうど container.browser.test.tsx で、一覧のフォルダにあり、
//     同じフォルダに container.tsx があるときだけ置ける(統合の設定 vitest.integration.config.ts もこの名前だけを拾う)
//   - 一覧のフォルダごとに container.browser.test.tsx が1本要る(同じフォルダに同じ名前は1つしか無いので、ちょうど1本になる)
//   - container.browser.test.tsx は、同じフォルダの ./container を(型だけでなく)import する(自分のコンテナを描く)
//   - 単体の側(*.test.ts・*.test-helper.ts・*.fixture.ts)は、コンポーネントを描く道具(@testing-library/react・react-dom とその下)を
//     import しない(型だけの import も)。happy-dom でコンポーネントを描くと、名前を *.test.ts にするだけで上の置き場の決まりをすり抜けるため
//   - container.fixture.ts は一覧のフォルダにだけ置ける。統合の設定が src の下の container.fixture.ts を全部 globalSetup に入れるので、
//     ほかの所に置くと黙って走る
// import は scripts/read-imports.mjs で構文木から読む(注釈・文字列の中は数えない)。
//
// 見るのは git の追跡ではなく作業ツリー。書いたばかりの未追跡のテストも Vitest は拾って走らせるため。
// 正規表現や注釈の外し方・import の判定が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-test-boundary.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTAINER_DIRS } from './container-dirs.mjs'
import { importsOf, parseSource } from './read-imports.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')

// Vitest が拾う名前(vitest.config.ts の include と同じ *.test.ts / *.test.tsx)
const TEST_FILE = /\.test\.tsx?$/
// テストが読むファイル(フィクスチャ・テストの部品)。単体の側として描く道具の import を見る
const TEST_SUPPORT = /\.(?:fixture|test-helper)\.ts$/
// 統合テストの名前(*.browser.test.ts も Vitest の名前としては拾えるので両方を見る)と、コンテナ・その統合テスト・フィクスチャの名前
const BROWSER_TEST = /\.browser\.test\.tsx?$/
const UNIT_TEST_TSX = /\.test\.tsx$/
const CONTAINER = 'container.tsx'
const CONTAINER_TEST = 'container.browser.test.tsx'
const CONTAINER_FIXTURE = 'container.fixture.ts'
// コンポーネントを描く道具。前方一致で見る(react-dom/client・react-dom/server・@testing-library/react/pure も)
const RENDER_PACKAGES = ['@testing-library/react', 'react-dom']
// 親フォルダのどれかが hooks であるパス(use-hooks/ のような名前は含めない)
const HOOKS_DIR = /(^|\/)hooks\//
// renderHook という名前の識別子(import・呼び出し・名前空間越しの rtl.renderHook のどれも拾う)
const RENDER_HOOK = /\brenderHook\b/
// 注釈の中の renderHook(「renderHook を使わない」等)は使っていないので、照合の前に注釈を外す。
// 行注釈は URL の :// を注釈と取り違えないよう、直前が : でない // だけを外す
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT = /(^|[^:])\/\/.*$/gm
const SKIP_DIRS = new Set(['node_modules', '.git'])

// 違反ごとに出す理由。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const REASON_HOOK_TEST =
  'hooks/ 配下にテストは置かない(統合テストの *.browser.test.tsx も)。ロジックを純粋関数(src/lib/ か utils/)へ移してそちらで測り、フックの動きは、そのフックを使うコンポーネントを統合テスト(*.browser.test.tsx)で描いて見る'
const REASON_RENDER_HOOK =
  'renderHook でフックを呼ぶテストは置かない(hooks/ の外でも同じ)。ロジックを純粋関数へ移してそちらで測り、フックの動きは、そのフックを使うコンポーネントを統合テスト(*.browser.test.tsx)で描いて見る'
const REASON_UNIT_TSX =
  '*.test.tsx(単体の設定が拾う名前)は置かない。コンポーネントを描くテストは、その部品を含むコンテナの隣の container.browser.test.tsx(統合テスト)に書く。純粋関数のテストなら *.test.ts にする(ADR 0017 の D5)'
const REASON_BROWSER_PLACE =
  '統合テスト(*.browser.test.ts・*.browser.test.tsx)を置けるのは、コンテナの一覧(scripts/container-dirs.mjs)のフォルダで container.tsx と同じフォルダの container.browser.test.tsx だけ。' +
  '断定を、その部品を含むコンテナの container.browser.test.tsx へ移す(ADR 0017 の D5)'
const REASON_NO_CONTAINER_TEST =
  'コンテナの一覧(scripts/container-dirs.mjs)のフォルダには、container.browser.test.tsx が1本要る。コンテナをフック・子と一緒に実ブラウザで描く統合テストを書く(ADR 0017 の D5)'
const REASON_NOT_OWN_CONTAINER =
  'container.browser.test.tsx は同じフォルダの ./container を(型だけでなく)import して、自分のコンテナを描く。ほかのコンテナや部品を描くなら、そのコンテナの container.browser.test.tsx に書く(ADR 0017 の D5)'
const REASON_FIXTURE_PLACE =
  'container.fixture.ts を置けるのはコンテナの一覧(scripts/container-dirs.mjs)のフォルダだけ。統合の設定(vitest.integration.config.ts)が src の下の container.fixture.ts を全部 globalSetup に入れるので、' +
  'ほかの所に置くと黙って走る。単体テストが読むデータなら、別の名前の *.fixture.ts にする(ADR 0017 の D5)'
const REASON_UNIT_RENDER =
  '単体の側(*.test.ts・*.test-helper.ts・*.fixture.ts)は、コンポーネントを描く道具(@testing-library/react・react-dom とその下)を import しない(型だけの import も)。' +
  'コンポーネントを描くテストは、その部品を含むコンテナの container.browser.test.tsx(統合テスト)に書く(ADR 0017 の D5)'

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

// 注釈を外したうえで renderHook を使っているか
const usesRenderHook = code =>
  RENDER_HOOK.test(code.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1'))

// 1 ファイルの違反の理由(違反でなければ undefined)。hooks/ 配下のテストは renderHook の有無を問わず
// それだけで違反なので、理由は置き場の方を出す。中身は hooks/ の外のときだけ読む
const violationOf = (file, readCode) => {
  if (HOOKS_DIR.test(file)) return REASON_HOOK_TEST
  if (usesRenderHook(readCode())) return REASON_RENDER_HOOK
  return undefined
}

// コンポーネントを描くテスト・フィクスチャの置き場の違反の理由(違反でなければ undefined)。
// exists は同じフォルダの相手が実在するか、dirs はコンテナの一覧
const placementViolationOf = (file, exists, dirs) => {
  const dir = path.posix.dirname(file)
  const name = path.posix.basename(file)
  if (BROWSER_TEST.test(name)) {
    return name === CONTAINER_TEST && dirs.includes(dir) && exists(`${dir}/${CONTAINER}`)
      ? undefined
      : REASON_BROWSER_PLACE
  }
  if (UNIT_TEST_TSX.test(name)) return REASON_UNIT_TSX
  if (name === CONTAINER_FIXTURE && !dirs.includes(dir)) return REASON_FIXTURE_PLACE
  return undefined
}

// 中身の import の違反の理由(違反でなければ undefined)。統合テストは自分のコンテナを描くか、単体の側は描く道具を使わないかを見る
const importViolationOf = (file, code) => {
  const imports = importsOf(parseSource(file, code))
  if (path.posix.basename(file) === CONTAINER_TEST) {
    const drawsOwn = imports.some(
      ({ specifier, typeOnly }) => specifier === './container' && !typeOnly
    )
    return drawsOwn ? undefined : REASON_NOT_OWN_CONTAINER
  }
  const renders = imports.some(
    ({ specifier }) =>
      specifier !== undefined && RENDER_PACKAGES.some(name => specifier.startsWith(name))
  )
  return renders ? REASON_UNIT_RENDER : undefined
}

// コンテナの一覧のうち、統合テストが無いフォルダ
const missingTestsOf = (dirs, exists) => dirs.filter(dir => !exists(`${dir}/${CONTAINER_TEST}`))

// ---- 自己検査 ----
// 正規表現や注釈の外し方・import の判定が壊れると、違反を見逃したまま「違反なし」で通る(下の 0 件の検査は、src を見失ったときしか落ちない)。
// そこで違反と分かっている文字列と違反でない文字列を、実際の検査と同じ関数でメモリの上で判定し、期待と違えば落とす
const TEST_FILE_CASES = [
  ['src/a.test.ts', true],
  ['src/a.test.tsx', true],
  ['src/a.browser.test.tsx', true],
  ['src/a.browser.test.ts', true],
  ['src/a.ts', false],
  ['src/a.test.ts.snap', false],
]
// [パス, 中身, 期待する理由]
const VIOLATION_CASES = [
  ['src/hooks/use-a.test.ts', '', REASON_HOOK_TEST],
  ['src/components/A/hooks/use-b/use-b.test.tsx', '', REASON_HOOK_TEST],
  ['src/use-hooks/a.test.ts', '', undefined],
  ['src/a.test.ts', `import { renderHook } from '@testing-library/react'`, REASON_RENDER_HOOK],
  ['src/a.test.tsx', 'const r = rtl.renderHook(() => useA())', REASON_RENDER_HOOK],
  // URL の :// は行注釈ではないので、その後ろの renderHook を拾う
  ['src/a.test.ts', `const r = load('https://example.com/', renderHook)`, REASON_RENDER_HOOK],
  ['src/a.test.ts', '// renderHook を使わない', undefined],
  ['src/a.test.ts', 'const a = 1 // renderHook を使わない', undefined],
  ['src/a.test.ts', '/*\n * renderHook を使わない\n */', undefined],
  ['src/a.test.ts', 'const renderHooked = 1', undefined],
]
// 置き場の判定に使う偽の作業ツリーとコンテナの一覧(D は container.tsx があるが一覧の外)と、[パス, 期待する理由]
const FAKE_DIRS = ['src/components/A', 'src/components/B', 'src/components/C']
const FAKE_TREE = new Set([
  'src/components/A/container.tsx',
  'src/components/A/container.browser.test.tsx',
  'src/components/B/container.tsx',
  'src/components/C/container.browser.test.tsx',
  'src/components/D/container.tsx',
])
const PLACEMENT_CASES = [
  ['src/components/A/container.browser.test.tsx', undefined],
  ['src/components/C/container.browser.test.tsx', REASON_BROWSER_PLACE],
  ['src/components/D/container.browser.test.tsx', REASON_BROWSER_PLACE],
  ['src/components/A/index.browser.test.tsx', REASON_BROWSER_PLACE],
  ['src/components/A/container.browser.test.ts', REASON_BROWSER_PLACE],
  ['src/components/A/components/X/work-card.browser.test.ts', REASON_BROWSER_PLACE],
  ['src/components/A/components/X/container.browser.test.tsx', REASON_BROWSER_PLACE],
  ['src/components/A/components/X/index.test.tsx', REASON_UNIT_TSX],
  ['src/components/A/container.test.tsx', REASON_UNIT_TSX],
  ['src/utils/a.test.tsx', REASON_UNIT_TSX],
  ['src/utils/a.test.ts', undefined],
  ['src/components/A/index.tsx', undefined],
  ['src/components/A/container.tsx', undefined],
  ['src/components/A/container.fixture.ts', undefined],
  ['src/components/B/container.fixture.ts', undefined],
  ['src/components/D/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/components/A/components/X/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/lib/a.fixture.ts', undefined],
]
// 一覧のうち統合テストが無いフォルダ。C はテストがある(コンテナが無いことは置き場の判定で落ちる)
const EXPECTED_MISSING_TESTS = ['src/components/B']
// [パス, 中身, 期待する理由]
const IMPORT_CASES = [
  [
    'src/components/A/container.browser.test.tsx',
    `import { render } from '@testing-library/react'\nimport A from './container'`,
    undefined,
  ],
  [
    'src/components/A/container.browser.test.tsx',
    `const A = await import('./container')`,
    undefined,
  ],
  [
    'src/components/A/container.browser.test.tsx',
    `import type A from './container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [
    'src/components/A/container.browser.test.tsx',
    `import A from '@/components/A/container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [
    'src/components/A/container.browser.test.tsx',
    `import X from './components/X/container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [
    'src/components/A/container.browser.test.tsx',
    `// import A from './container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  ['src/utils/a.test.ts', `import { render } from '@testing-library/react'`, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { createRoot } from 'react-dom/client'`, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { flushSync } from 'react-dom'`, REASON_UNIT_RENDER],
  [
    'src/utils/a.test.ts',
    `const { renderToString } = await import('react-dom/server')`,
    REASON_UNIT_RENDER,
  ],
  [
    'src/utils/a.test.ts',
    `import type { RenderResult } from '@testing-library/react'`,
    REASON_UNIT_RENDER,
  ],
  ['src/utils/a.test.ts', `export * from '@testing-library/react/pure'`, REASON_UNIT_RENDER],
  [
    'src/lib/a.test-helper.ts',
    `import { render } from '@testing-library/react'`,
    REASON_UNIT_RENDER,
  ],
  ['src/lib/a.fixture.ts', `import { render } from '@testing-library/react'`, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { screen } from '@testing-library/dom'`, undefined],
  ['src/utils/a.test.ts', `// import { render } from '@testing-library/react'`, undefined],
  ['src/utils/a.test.ts', `const name = 'react-dom/client'`, undefined],
  ['src/components/A/container.fixture.ts', `import type A from './container'`, undefined],
]
const fakeExists = p => FAKE_TREE.has(p)
const fakeMissingTests = missingTestsOf(FAKE_DIRS, fakeExists)
const selfCheckFailures = [
  ...TEST_FILE_CASES.filter(([file, expected]) => TEST_FILE.test(file) !== expected).map(
    ([file, expected]) => `テストの名前の判定 ${file} → ${expected}`
  ),
  ...VIOLATION_CASES.filter(
    ([file, code, expected]) => violationOf(file, () => code) !== expected
  ).map(([file, code, expected]) => `違反の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...PLACEMENT_CASES.filter(
    ([file, expected]) => placementViolationOf(file, fakeExists, FAKE_DIRS) !== expected
  ).map(([file, expected]) => `置き場の判定 ${file} → ${expected}`),
  ...IMPORT_CASES.filter(
    ([file, code, expected]) => importViolationOf(file, code) !== expected
  ).map(([file, code, expected]) => `import の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...(JSON.stringify(fakeMissingTests) !== JSON.stringify(EXPECTED_MISSING_TESTS)
    ? [`統合テストの無いコンテナの判定 ${JSON.stringify(fakeMissingTests)}`]
    : []),
]
if (selfCheckFailures.length > 0) {
  throw new Error(
    `check-test-boundary: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

const srcFiles = (existsSync(SRC_DIR) ? walk(SRC_DIR) : [])
  .map(file => toPosix(path.relative(ROOT, file)))
  .sort()
const srcFileSet = new Set(srcFiles)
const exists = p => srcFileSet.has(p)
const testFiles = srcFiles.filter(file => TEST_FILE.test(file))
const supportFiles = srcFiles.filter(file => TEST_SUPPORT.test(file))

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (testFiles.length === 0) {
  console.error('check-test-boundary: src にテストが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

// 1 ファイル 1 件で数える。hooks/ と renderHook の理由を先に出し、無ければ置き場、その次に中身の import を見る
const read = file => readFileSync(path.join(ROOT, file), 'utf8')
const failures = []
for (const file of [...testFiles, ...supportFiles]) {
  const reason =
    (TEST_FILE.test(file) ? violationOf(file, () => read(file)) : undefined) ??
    placementViolationOf(file, exists, CONTAINER_DIRS) ??
    importViolationOf(file, read(file))
  if (reason !== undefined) failures.push(`${file}: ${reason}`)
}
for (const dir of missingTestsOf(CONTAINER_DIRS, exists)) {
  failures.push(`${dir}/${CONTAINER}: ${REASON_NO_CONTAINER_TEST}`)
}

if (failures.length > 0) {
  console.error(`check-test-boundary: ${failures.length} 件の違反`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(
  `check-test-boundary: src のテスト ${testFiles.length} 件・フィクスチャとテストの部品 ${supportFiles.length} 件とコンテナの一覧 ${CONTAINER_DIRS.length} か所を検査 — 違反なし`
)
