// テストの置き場の境界検査。フック(hooks/ 配下)に単体テストを置いていないかと、
// フックを renderHook で呼ぶテストがどこにも無いかと、コンポーネントを描くテストが __tests__/ の統合テストの外に無いかを見る。
//
// 決まり: ロジックは純粋関数(src/lib/・utils/)に置き、単体テストと変異テストで固める。
// フックは単体テストを置かない層で、動きはそのフックを呼ぶコンテナ(container.tsx)を統合テスト(*.integration.test.tsx)で描いて見る
// (vitest.config.ts のカバレッジでも測らない。統合のカバレッジ vitest.integration.config.ts がファイル別100%で固める)。
// hooks/ の外へテストを移しても、renderHook でフックを呼べば同じことになるので、それも落とす。
// テストの部品・フィクスチャ(*.test-helper.ts・*.fixture.ts)も hooks/ 配下に置かない。統合のカバレッジ(vitest.integration.config.ts)は
// この名前を exclude で外すので、hooks/ の下に置くとフックのファイル別100%の門(ADR 0018)の外に黙って残る。
// ストアを import して getState() で状態を戻すだけのテストは、フックを描かないので落とさない。
// 例外を許す一覧は持たない(移し終えて 0 件になった。足したくなったら、ロジックを純粋関数へ切り出してそちらで測る)。
//
// 加えて、コンポーネントを描くテストの置き場を見る(ADR 0019)。コンポーネントを描くのは、リポジトリ直下の __tests__/ の統合テストだけ。
// コンテナ(container.tsx)ごとに対応する __tests__ のフォルダがあり、単位の元のフォルダ自身のコンテナは __tests__/<unit>/、
// その下の状態コンテナは __tests__/<unit>/<kebab(フォルダの名前)>/(<unit> は単位の元のフォルダの src/components/ の下のパスの kebab-case)。
// 単位の元は、I/O コンテナ(scripts/container-dirs.mjs の一覧。check-layers.mjs と同じもの)の中ならいちばん近い I/O コンテナ、
// 外なら状態コンテナが自分で単位になり、入っている最上位のコンポーネントのフォルダ(src/components/<名前> か src/components/ui/<名前>)。
// 決め方は scripts/container-dirs.mjs の unitRootOf・testDirOf。
//   - 統合テストの名前は *.integration.test.tsx で、置けるのはコンテナに対応するフォルダの直下だけ
//     (統合の設定 vitest.integration.config.ts は __tests__ の下のこの名前だけを拾う)。*.integration.test.ts とほかの場所(src・tests も)は落とす
//   - もとの名前 *.browser.test.*(container.browser.test.tsx)は、どこにあっても落とす
//   - *.test.tsx(単体の設定 vitest.config.ts が拾う名前)は src のどこにも置かない。__tests__ には統合テスト以外のテストを置かない
//   - __tests__ に置ける名前は、統合テスト(*.integration.test.tsx)・統合テストだけが使う部品(*.test-helper.ts)・
//     container.fixture.ts・文書(*.md)だけ。ほかの名前(*.ts・*.tsx・*.test-helper.tsx・ほかの *.fixture.ts・データなど)は落とす
//   - コンテナごとに、対応するフォルダに統合テストが1本以上要る(一覧のフォルダは container.tsx が無くても数える)
//   - 統合テストは、そのフォルダが対応するコンテナを @/components/…/container で(型だけでなく)import する(そのコンテナを描く)
//   - どのコンテナにも対応しない __tests__ のフォルダにはファイルを置かない(単位フォルダは、自分のコンテナが無くても部品と
//     container.fixture.ts を置ける)。1つの単位の中で状態コンテナの kebab の名前が重ならない。
//     単位が決まらない所(src/components/ の外と、src/components/・src/components/ui/ の直下)の container.tsx は落とす
//   - 統合テストの外(src の *.test.ts・*.test-helper.ts・*.fixture.ts と、__tests__ の *.integration.test.tsx でないファイル全部)は、
//     コンポーネントを描く道具(@testing-library/react・react-dom とその下)を import しない(型だけの import も)。
//     happy-dom でコンポーネントを描くと、名前を *.test.ts にするだけで上の置き場の決まりをすり抜けるため
//   - container.fixture.ts は単位フォルダ(__tests__/<unit>/)の直下にだけ置ける。統合の設定が __tests__ の下の
//     container.fixture.ts を全部 globalSetup に入れるので、ほかの所に置くと黙って走るか、走らないまま残る
// import は scripts/read-imports.mjs で構文木から読む(注釈・文字列の中は数えない)。
//
// 見るのは git の追跡ではなく作業ツリー。書いたばかりの未追跡のテストも Vitest は拾って走らせるため。
// 正規表現や注釈の外し方・import の判定が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-test-boundary.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CONTAINER_DIRS,
  TEST_ROOT,
  kebabOf,
  testDirOf,
  unitDirOf,
  unitRootOf,
} from './container-dirs.mjs'
import { importsOf, parseSource } from './read-imports.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 中身まで見るフォルダ(src の単体テストと、__tests__ の統合テスト)
const SCAN_DIRS = ['src', TEST_ROOT]
// 統合テストの名前だけを見るフォルダ(E2E。ここに置いた統合テストはどの設定にも拾われない)
const NAME_SCAN_DIRS = ['tests']

// Vitest が拾う名前(vitest.config.ts の include と同じ *.test.ts / *.test.tsx)
const TEST_FILE = /\.test\.tsx?$/
// テストが読むファイル(フィクスチャ・テストの部品)。統合テストの外として描く道具の import を見る
const TEST_SUPPORT = /\.(?:fixture|test-helper)\.ts$/
// 統合テストの名前(統合の設定が拾うもの)と、統合テストに見える名前の全部(*.integration.test.ts も)
const INTEGRATION_TEST = /\.integration\.test\.tsx$/
const INTEGRATION_NAME = /\.integration\.test\.tsx?$/
// もとの統合テストの名前(拡張子を問わない)
const BROWSER_TEST = /\.browser\.test\./
const UNIT_TEST_TSX = /\.test\.tsx$/
const CONTAINER = 'container.tsx'
const CONTAINER_FIXTURE = 'container.fixture.ts'
// __tests__ に置ける名前(統合テスト・統合テストだけが使う部品・フィクスチャ・文書)。ファイルの名前に当てる
const TEST_ROOT_NAMES = [
  INTEGRATION_TEST,
  /\.test-helper\.ts$/,
  /^container\.fixture\.ts$/,
  /\.md$/,
]
// import を読むコード(__tests__ のデータなど、コードでないファイルは読まない)
const CODE_FILE = /\.[cm]?[jt]sx?$/
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
const FOLDERS =
  '単位の元のフォルダ自身のコンテナは __tests__/<unit>/、その下の状態コンテナは __tests__/<unit>/<kebab(フォルダの名前)>/。' +
  '<unit> は単位の元のフォルダの src/components/ の下のパスの kebab-case。単位の元は、I/O コンテナ(scripts/container-dirs.mjs の一覧)の中なら' +
  'いちばん近い I/O コンテナ、外なら状態コンテナが入る最上位のコンポーネントのフォルダ(src/components/<名前> か src/components/ui/<名前>)'
const REASON_HOOK_TEST =
  'hooks/ 配下にテストは置かない(統合テストも)。ロジックを純粋関数(src/lib/ か utils/)へ移してそちらで測り、フックの動きは、そのフックを呼ぶコンテナを __tests__/ の統合テスト(*.integration.test.tsx)で描いて見る'
const REASON_HOOK_SUPPORT =
  'hooks/ 配下にテストの部品・フィクスチャ(*.test-helper.ts・*.fixture.ts)は置かない。統合のカバレッジ(vitest.integration.config.ts)はこの名前を exclude で外すので、' +
  'hooks/ の下に置くとフックのファイル別100%の門の外に黙って残る。テストが読む部品はテストの側(hooks/ の外)に置き、フックの中身ならフックの名前にする(ADR 0018)'
const REASON_RENDER_HOOK =
  'renderHook でフックを呼ぶテストは置かない(hooks/ の外でも同じ)。ロジックを純粋関数へ移してそちらで測り、フックの動きは、そのフックを呼ぶコンテナを __tests__/ の統合テスト(*.integration.test.tsx)で描いて見る'
const REASON_UNIT_TSX =
  '*.test.tsx(単体の設定が拾う名前)は src に置かない。コンポーネントを描くテストは、そのコンポーネントを含むコンテナに対応する __tests__ のフォルダの <動作>.integration.test.tsx(統合テスト)に書く。' +
  `純粋関数のテストなら *.test.ts にする。${FOLDERS}(ADR 0019)`
const REASON_BROWSER_OLD =
  '*.browser.test.*(もとの統合テストの名前。container.browser.test.tsx も)は、どこにも置かない(どちらの設定にも拾われない)。' +
  `統合テストは、コンテナに対応する __tests__ のフォルダの直下に <動作>.integration.test.tsx で書く。${FOLDERS}(ADR 0019)`
const REASON_INTEGRATION_PLACE =
  '統合テスト(*.integration.test.ts・*.integration.test.tsx)を置けるのは、コンテナに対応する __tests__ のフォルダの直下だけで、名前は <動作>.integration.test.tsx。' +
  `統合の設定(vitest.integration.config.ts)はそれだけを拾い、ほかは走らないまま残る。${FOLDERS}(ADR 0019)`
const REASON_TESTS_UNIT =
  '__tests__/ には統合テスト(*.integration.test.tsx)のほかのテストを置かない(どちらの設定にも拾われない)。単体テストは src の対象の隣に *.test.ts で置き、' +
  'コンポーネントを描くテストは <動作>.integration.test.tsx にする(ADR 0019)'
const REASON_TESTS_NAME =
  '__tests__/ に置ける名前は、統合テスト(<動作>.integration.test.tsx)・統合テストだけが使う部品(<名前>.test-helper.ts)・container.fixture.ts・文書(*.md)だけ。' +
  'コンポーネントを描くテストなら <動作>.integration.test.tsx に、統合テストが共有する部品なら <名前>.test-helper.ts(.tsx にしない。JSX を書かない)に、' +
  'node で props を組むフィクスチャなら単位フォルダの直下の container.fixture.ts にまとめる。src の単体テストも使う部品・データなら、src の対象の隣に置く(ADR 0019)'
const REASON_NO_TESTS =
  `コンテナ(container.tsx)には、対応する __tests__ のフォルダの直下に統合テスト(<動作>.integration.test.tsx)が1本以上要る。${FOLDERS}。` +
  'コンテナをフック・子と一緒に実ブラウザで描く統合テストを書く(ADR 0019)'
const REASON_NOT_OWN_CONTAINER =
  '統合テスト(*.integration.test.tsx)は、そのフォルダが対応するコンテナを @/components/…/container で(型だけでなく)import して描く。' +
  'ほかのコンテナの動きなら、そのコンテナのフォルダに書く(ADR 0019)'
const REASON_FIXTURE_PLACE =
  'container.fixture.ts を置けるのは単位フォルダ(__tests__/<unit>/)の直下だけ。統合の設定(vitest.integration.config.ts)が __tests__ の下の container.fixture.ts を全部 globalSetup に入れるので、' +
  `ほかの所に置くと黙って走るか、走らないまま残る。src の単体テストが読むデータなら、src の対象の隣に別の名前の *.fixture.ts で置く。${FOLDERS}(ADR 0019)`
const REASON_UNIT_RENDER =
  '統合テストの外(src の *.test.ts・*.test-helper.ts・*.fixture.ts と、__tests__ の *.integration.test.tsx でないファイル全部)は、コンポーネントを描く道具(@testing-library/react・react-dom とその下)を import しない(型だけの import も)。' +
  'コンポーネントを描くテストは、そのコンテナに対応する __tests__ のフォルダの <動作>.integration.test.tsx(統合テスト)に書く(ADR 0019)'
const REASON_ORPHAN_DIR =
  `__tests__ のこのフォルダは、どのコンテナにも対応しない(ファイルを置けるのは、コンテナに対応するフォルダと単位フォルダの直下だけ)。${FOLDERS}。` +
  'コンテナを改名・移動したなら、フォルダも合わせて移す(ADR 0019)'
const REASON_DUPLICATE =
  '同じ単位の中で、状態コンテナの kebab の名前が重なる(対応する __tests__ のフォルダが1つに決まらない)。どちらかのフォルダの名前を変える(ADR 0019)'
const REASON_NO_UNIT =
  'このコンテナ(container.tsx)は、統合テストの単位が決まらない所にある。コンテナは src/components/<名前>/ か src/components/ui/<名前>/ の下に置く' +
  `(src/components/ の外と、src/components/・src/components/ui/ の直下には置かない)。${FOLDERS}(ADR 0019)`

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

// テストの部品・フィクスチャの違反の理由(違反でなければ undefined)。hooks/ 配下の部品は、それだけで違反
const supportViolationOf = file =>
  TEST_SUPPORT.test(file) && HOOKS_DIR.test(file) ? REASON_HOOK_SUPPORT : undefined

// テスト・フィクスチャの置き場の違反の理由(違反でなければ undefined)。
// containers はコンテナに対応する __tests__ のフォルダ → コンテナのフォルダ、unitDirs は単位フォルダ
// (I/O コンテナの単位と、I/O コンテナの外の状態コンテナが自分でなる単位)
const placementViolationOf = (file, containers, unitDirs) => {
  const dir = path.posix.dirname(file)
  const name = path.posix.basename(file)
  if (BROWSER_TEST.test(name)) return REASON_BROWSER_OLD
  if (INTEGRATION_NAME.test(name)) {
    return INTEGRATION_TEST.test(name) && containers.has(dir) ? undefined : REASON_INTEGRATION_PLACE
  }
  if (TEST_FILE.test(name) && file.startsWith(`${TEST_ROOT}/`)) return REASON_TESTS_UNIT
  if (UNIT_TEST_TSX.test(name)) return REASON_UNIT_TSX
  if (name === CONTAINER_FIXTURE && !unitDirs.has(dir)) return REASON_FIXTURE_PLACE
  return undefined
}

// __tests__ の中のファイルの名前の違反の理由(違反でなければ undefined)。置ける名前は TEST_ROOT_NAMES だけ
const testRootNameViolationOf = file =>
  file.startsWith(`${TEST_ROOT}/`) &&
  !TEST_ROOT_NAMES.some(pattern => pattern.test(path.posix.basename(file)))
    ? REASON_TESTS_NAME
    : undefined

// @/ の指定子が指す src の中のパス(拡張子は付けない)。@/ でなければ undefined
const aliasTargetOf = specifier =>
  specifier !== undefined && specifier.startsWith('@/')
    ? path.posix.normalize(`src/${specifier.slice(2)}`)
    : undefined

// 中身の import の違反の理由(違反でなければ undefined)。統合テストは自分のフォルダのコンテナを描くか、
// 統合テストの外は描く道具を使わないかを見る。containers は placementViolationOf と同じ
const importViolationOf = (file, code, containers) => {
  const imports = importsOf(parseSource(file, code))
  if (INTEGRATION_TEST.test(file)) {
    const own = containers.get(path.posix.dirname(file))
    const drawsOwn =
      own !== undefined &&
      imports.some(
        ({ specifier, typeOnly }) => !typeOnly && aliasTargetOf(specifier) === `${own}/container`
      )
    return drawsOwn ? undefined : REASON_NOT_OWN_CONTAINER
  }
  const renders = imports.some(
    ({ specifier }) =>
      specifier !== undefined && RENDER_PACKAGES.some(name => specifier.startsWith(name))
  )
  return renders ? REASON_UNIT_RENDER : undefined
}

// src の container.tsx か
const isSrcContainer = file => file.startsWith('src/') && path.posix.basename(file) === CONTAINER

// __tests__ の下の、フォルダの対応を見るファイルか(文書の .md はどこに置いてもよい。npm run docs:check が見る)
const isTestRootFile = file => file.startsWith(`${TEST_ROOT}/`) && !file.endsWith('.md')

// コンテナと __tests__ のフォルダの対応と、フォルダの単位で見る違反。files は src と __tests__ のファイル(リポジトリ直下からのパス)
const layoutOf = (files, ioDirs) => {
  const violations = []
  const atContainer = (dir, reason) => ({ file: `${dir}/${CONTAINER}`, reason })
  // コンテナのフォルダ(src の container.tsx のフォルダと、一覧のフォルダ)ごとに、対応する __tests__ のフォルダを決める
  const foundDirs = files.filter(isSrcContainer).map(file => path.posix.dirname(file))
  const containerDirs = [...new Set([...foundDirs, ...ioDirs])].sort()
  const owners = new Map()
  // 単位フォルダ。I/O コンテナの単位と、コンテナが入る単位の全部(自分のコンテナが無い単位フォルダも、部品とフィクスチャを置ける)
  const unitDirs = new Set(ioDirs.map(unitDirOf))
  for (const dir of containerDirs) {
    const testDir = testDirOf(dir, ioDirs)
    if (testDir === undefined) {
      violations.push(atContainer(dir, REASON_NO_UNIT))
      continue
    }
    owners.set(testDir, [...(owners.get(testDir) ?? []), dir])
    unitDirs.add(unitDirOf(unitRootOf(dir, ioDirs)))
  }
  const testDirsWithTests = new Set(
    files.filter(file => INTEGRATION_TEST.test(file)).map(file => path.posix.dirname(file))
  )
  for (const [testDir, dirs] of owners) {
    for (const dir of dirs) {
      if (dirs.length > 1) violations.push(atContainer(dir, REASON_DUPLICATE))
      if (!testDirsWithTests.has(testDir)) violations.push(atContainer(dir, REASON_NO_TESTS))
    }
  }
  // 重なった名前のフォルダは、並べて先のコンテナに対応させる(重なり自体は上で落とす)
  const containers = new Map([...owners].map(([testDir, [dir]]) => [testDir, dir]))
  const testRootDirs = new Set(files.filter(isTestRootFile).map(file => path.posix.dirname(file)))
  for (const dir of [...testRootDirs].sort()) {
    if (!containers.has(dir) && !unitDirs.has(dir)) {
      violations.push({ file: `${dir}/`, reason: REASON_ORPHAN_DIR })
    }
  }
  return { violations, containers, unitDirs }
}

// 1 ファイルずつ見るファイルか。src のテスト・部品・フィクスチャ・もとの名前と、__tests__ の文書でないファイルの全部
const isPerFileTarget = file =>
  TEST_FILE.test(file) || TEST_SUPPORT.test(file) || BROWSER_TEST.test(file) || isTestRootFile(file)

// 全体の検査。files は src と __tests__ のファイル、nameOnlyFiles は名前だけを見るファイル(tests/ の統合テストに見える名前)。
// 1 ファイル 1 件で数える。hooks/ と renderHook の理由を先に出し、無ければ置き場、その次に中身の import(コードのときだけ)、
// 最後に __tests__ の中の名前を見る。名前より import を先に見るのは、__tests__ の部品の名前を直しただけで
// 描く道具の import が残るのを、最初の報告で分かるようにするため。返すのは { file, reason } の一覧
const checkTree = (files, nameOnlyFiles, lists, readCode) => {
  const layout = layoutOf(files, lists.ioDirs)
  const perFile = files.filter(isPerFileTarget).flatMap(file => {
    const reason =
      (TEST_FILE.test(file) ? violationOf(file, () => readCode(file)) : supportViolationOf(file)) ??
      placementViolationOf(file, layout.containers, layout.unitDirs) ??
      (CODE_FILE.test(file)
        ? importViolationOf(file, readCode(file), layout.containers)
        : undefined) ??
      testRootNameViolationOf(file)
    return reason === undefined ? [] : [{ file, reason }]
  })
  const nameOnly = nameOnlyFiles.flatMap(file => {
    const reason = placementViolationOf(file, layout.containers, layout.unitDirs)
    return reason === undefined ? [] : [{ file, reason }]
  })
  return [...perFile, ...nameOnly, ...layout.violations]
}

// ---- 自己検査 ----
// 正規表現や注釈の外し方・import の判定・フォルダの対応・__tests__ の名前の判定が壊れると、違反を見逃したまま「違反なし」で通る
// (下の 0 件の検査は、src を見失ったときしか落ちない)。そこで違反と分かっている文字列と違反でない文字列を、
// 実際の検査と同じ関数でメモリの上で判定し、期待と違えば落とす
const TEST_FILE_CASES = [
  ['src/a.test.ts', true],
  ['src/a.test.tsx', true],
  ['src/a.browser.test.tsx', true],
  ['src/a.browser.test.ts', true],
  ['__tests__/a/b.integration.test.tsx', true],
  ['src/a.ts', false],
  ['src/a.test.ts.snap', false],
]
// [パス, 中身, 期待する理由]
const VIOLATION_CASES = [
  ['src/hooks/use-a.test.ts', '', REASON_HOOK_TEST],
  ['src/components/A/hooks/use-b/use-b.test.tsx', '', REASON_HOOK_TEST],
  ['__tests__/a/hooks/use-b.integration.test.tsx', '', REASON_HOOK_TEST],
  ['src/use-hooks/a.test.ts', '', undefined],
  ['src/a.test.ts', `import { renderHook } from '@testing-library/react'`, REASON_RENDER_HOOK],
  ['src/a.test.tsx', 'const r = rtl.renderHook(() => useA())', REASON_RENDER_HOOK],
  ['__tests__/a/b.integration.test.tsx', 'const r = renderHook(() => useA())', REASON_RENDER_HOOK],
  // URL の :// は行注釈ではないので、その後ろの renderHook を拾う
  ['src/a.test.ts', `const r = load('https://example.com/', renderHook)`, REASON_RENDER_HOOK],
  ['src/a.test.ts', '// renderHook を使わない', undefined],
  ['src/a.test.ts', 'const a = 1 // renderHook を使わない', undefined],
  ['src/a.test.ts', '/*\n * renderHook を使わない\n */', undefined],
  ['src/a.test.ts', 'const renderHooked = 1', undefined],
]
// [パス, 期待する理由]
const SUPPORT_CASES = [
  ['src/hooks/a.test-helper.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/use-b/b.fixture.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/container.fixture.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/use-b.ts', undefined],
  ['src/use-hooks/a.test-helper.ts', undefined],
  ['src/components/A/a.fixture.ts', undefined],
]
// kebab-case にする規則と、本物の I/O コンテナの一覧の単位フォルダ(ADR 0019 の名前そのもの)
const KEBAB_CASES = [
  ['VillagePage', 'village-page'],
  ['SettingsMenuPanel', 'settings-menu-panel'],
  ['SceneSvg', 'scene-svg'],
  ['TechChipPopover', 'tech-chip-popover'],
  ['PageviewCounter', 'pageview-counter'],
  ['SVGPlayer', 'svg-player'],
  ['Story', 'story'],
  ['ui', 'ui'],
]
const EXPECTED_UNIT_DIRS = [
  '__tests__/village-page',
  '__tests__/directory',
  '__tests__/story',
  '__tests__/ui/settings-menu',
  '__tests__/ui/pageview-counter',
  '__tests__/ui/scene-player',
]
// [コンテナのフォルダ, 期待する __tests__ のフォルダ]。本物の I/O コンテナの一覧で引く
const TEST_DIR_CASES = [
  ['src/components/Story', '__tests__/story'],
  ['src/components/Story/components/StoryBody', '__tests__/story/story-body'],
  ['src/components/ui/ScenePlayer/components/SceneSvg', '__tests__/ui/scene-player/scene-svg'],
  [
    'src/components/ui/SettingsMenu/components/SettingsMenuPanel',
    '__tests__/ui/settings-menu/settings-menu-panel',
  ],
  ['src/components/Directory/components/WorkCard', '__tests__/directory/work-card'],
  // 入れ子の状態コンテナも、単位はいちばん近い I/O コンテナで、名前は自分のフォルダの名前だけ
  ['src/components/Story/components/StoryBody/components/Deep', '__tests__/story/deep'],
  // I/O コンテナの外の状態コンテナは自分で単位になる。単位は最上位のコンポーネントのフォルダ(ui/ の下は ui/<名前>)で、
  // そのフォルダ自身のコンテナは単位フォルダ、その下は単位フォルダの下の自分のフォルダの名前(入れ子でも同じ)
  ['src/components/ui/Logo', '__tests__/ui/logo'],
  ['src/components/ui/Logo/components/Mark', '__tests__/ui/logo/mark'],
  ['src/components/Foo', '__tests__/foo'],
  ['src/components/Foo/components/Bar', '__tests__/foo/bar'],
  ['src/components/Foo/components/Bar/components/Baz', '__tests__/foo/baz'],
  // 名前の前の方が同じだけのフォルダは、I/O コンテナの下ではなく自分で単位になる
  ['src/components/StoryX/components/A', '__tests__/story-x/a'],
  ['src/components/ui/SettingsMenuX', '__tests__/ui/settings-menu-x'],
  // 単位が決まらない(src/components/ の外と、src/components/・src/components/ui/ の直下)
  ['src/app/a', undefined],
  ['src/hooks', undefined],
  ['src/components', undefined],
  ['src/components/ui', undefined],
]
// [パス, 期待する理由]。__tests__ に置ける名前(統合テスト・部品・フィクスチャ・文書)と、それ以外
const NAME_CASES = [
  ['__tests__/a/b.integration.test.tsx', undefined],
  ['__tests__/a/b.test-helper.ts', undefined],
  ['__tests__/a/container.fixture.ts', undefined],
  ['__tests__/a/README.md', undefined],
  ['__tests__/AGENTS.md', undefined],
  ['__tests__/a/render.ts', REASON_TESTS_NAME],
  ['__tests__/a/render.tsx', REASON_TESTS_NAME],
  ['__tests__/a/b.test-helper.tsx', REASON_TESTS_NAME],
  ['__tests__/a/b.test-helpers.ts', REASON_TESTS_NAME],
  ['__tests__/a/b.helper.ts', REASON_TESTS_NAME],
  ['__tests__/a/data.fixture.ts', REASON_TESTS_NAME],
  ['__tests__/a/x.container.fixture.ts', REASON_TESTS_NAME],
  ['__tests__/a/container.fixture.tsx', REASON_TESTS_NAME],
  ['__tests__/a/b.integration.test.ts', REASON_TESTS_NAME],
  ['__tests__/a/b.test.ts', REASON_TESTS_NAME],
  ['__tests__/a/data.json', REASON_TESTS_NAME],
  ['__tests__/a/b.integration.test.tsx.snap', REASON_TESTS_NAME],
  // __tests__ の外は見ない
  ['src/a/render.ts', undefined],
  ['tests/a.ts', undefined],
]

// 偽の作業ツリー(パス → 中身)と I/O コンテナ。Lonely は一覧にあるのに container.tsx もテストも無い
const FAKE_IO_DIRS = ['src/components/Screen', 'src/components/ui/Player', 'src/components/Lonely']
const FAKE_LISTS = { ioDirs: FAKE_IO_DIRS }
const SCREEN_IMPORT = `import Screen from '@/components/Screen/container'`
const FAKE_TREE = new Map(
  Object.entries({
    // I/O コンテナと、その単位フォルダの統合テスト・フィクスチャ・テストの部品
    'src/components/Screen/container.tsx': '',
    'src/components/Screen/index.tsx': '',
    'src/components/Screen/hooks/use-screen.ts': '',
    '__tests__/screen/open.integration.test.tsx': SCREEN_IMPORT,
    '__tests__/screen/container.fixture.ts': `import type Screen from '@/components/Screen/container'`,
    '__tests__/screen/screen.test-helper.ts': `import { page } from 'vitest/browser'`,
    'src/components/ui/Player/container.tsx': '',
    '__tests__/ui/player/play.integration.test.tsx': `const Player = await import('@/components/ui/Player/container')`,
    // 状態コンテナ(隣に hooks/ を持つもの・入れ子のもの)と、そのフォルダの統合テスト
    'src/components/Screen/components/StoryBody/container.tsx': '',
    'src/components/Screen/components/StoryBody/hooks/use-story-body.ts': '',
    '__tests__/screen/story-body/scroll.integration.test.tsx': `import StoryBody from '@/components/Screen/components/StoryBody/container'`,
    '__tests__/screen/story-body/focus.integration.test.tsx': `import type StoryBody from '@/components/Screen/components/StoryBody/container'`,
    '__tests__/screen/story-body/container.fixture.ts': '',
    'src/components/ui/Player/components/SceneSvg/container.tsx': '',
    '__tests__/ui/player/scene-svg/draw.integration.test.tsx': `import SceneSvg from '@/components/ui/Player/components/SceneSvg/container'`,
    // テストの無い状態コンテナ・名前の重なる状態コンテナ
    'src/components/Screen/components/Card/container.tsx': '',
    'src/components/Screen/components/StoryBody/components/Chip/container.tsx': '',
    'src/components/Screen/components/Aside/components/Chip/container.tsx': '',
    // I/O コンテナの外の状態コンテナ(自分で単位になる)で通るもの: 横断部品のフォルダ自身(隣に hooks/ を持つ)・
    // 最上位のフォルダの下の入れ子と、自分のコンテナが無い単位フォルダ(__tests__/panel/)の部品・フィクスチャ
    'src/components/ui/Badge/container.tsx': '',
    'src/components/ui/Badge/hooks/use-badge.ts': '',
    '__tests__/ui/badge/show.integration.test.tsx': `import Badge from '@/components/ui/Badge/container'`,
    '__tests__/ui/badge/container.fixture.ts': '',
    'src/components/Panel/index.tsx': '',
    'src/components/Panel/components/Tab/container.tsx': '',
    '__tests__/panel/tab/switch.integration.test.tsx': `import Tab from '@/components/Panel/components/Tab/container'`,
    '__tests__/panel/panel.test-helper.ts': `import { page } from 'vitest/browser'`,
    '__tests__/panel/container.fixture.ts': '',
    // 自分で単位になる状態コンテナで落ちるもの: テストが無い・コンテナの無い単位フォルダの統合テスト・入れ子のフィクスチャ
    'src/components/ui/Mute/container.tsx': '',
    '__tests__/panel/open.integration.test.tsx': `import Tab from '@/components/Panel/components/Tab/container'`,
    '__tests__/panel/tab/container.fixture.ts': '',
    // 単位が決まらない所のコンテナ
    'src/components/ui/container.tsx': '',
    'src/app/a/container.tsx': '',
    // __tests__ に置けない名前(描く道具を import するものは、名前より先にそちらで落ちる)と、置ける名前で描く道具を import するもの
    '__tests__/screen/render.ts': `import { render } from '@testing-library/react'`,
    '__tests__/screen/draw.test-helper.tsx': `import { createRoot } from 'react-dom/client'`,
    '__tests__/screen/paint.test-helper.ts': `import { render } from '@testing-library/react'`,
    '__tests__/screen/data.ts': 'export const data = 1',
    '__tests__/screen/view.test-helper.tsx': 'export const view = 1',
    '__tests__/screen/screen.test-helpers.ts': '',
    '__tests__/screen/data.fixture.ts': '',
    '__tests__/screen/data.json': '{}',
    '__tests__/screen/README.md': '',
    // どのコンテナにも対応しないフォルダ
    '__tests__/stray/a.integration.test.tsx': SCREEN_IMPORT,
    '__tests__/root.test-helper.ts': '',
    '__tests__/ui/player/scene-svg/deep/b.test-helper.ts': '',
    // 文書はどのフォルダに置いてもよい
    '__tests__/docs/AGENTS.md': '',
    // もとの名前と置き場
    'src/components/Screen/container.browser.test.tsx': `import Screen from './container'`,
    'src/components/Screen/container.fixture.ts': '',
  })
)
const FAKE_NAME_ONLY = ['tests/a.integration.test.tsx', 'tests/b.browser.test.ts']
const at = (file, reason) => `${file}: ${reason}`
const CHIPS = [
  'src/components/Screen/components/Aside/components/Chip/container.tsx',
  'src/components/Screen/components/StoryBody/components/Chip/container.tsx',
]
const EXPECTED_TREE = [
  at('__tests__/screen/story-body/focus.integration.test.tsx', REASON_NOT_OWN_CONTAINER),
  at('__tests__/screen/story-body/container.fixture.ts', REASON_FIXTURE_PLACE),
  at('__tests__/stray/a.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('src/components/Screen/container.browser.test.tsx', REASON_BROWSER_OLD),
  at('src/components/Screen/container.fixture.ts', REASON_FIXTURE_PLACE),
  at('tests/a.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('tests/b.browser.test.ts', REASON_BROWSER_OLD),
  at('src/components/Screen/components/Card/container.tsx', REASON_NO_TESTS),
  ...CHIPS.flatMap(file => [at(file, REASON_DUPLICATE), at(file, REASON_NO_TESTS)]),
  at('src/components/Lonely/container.tsx', REASON_NO_TESTS),
  at('src/components/ui/Mute/container.tsx', REASON_NO_TESTS),
  at('__tests__/panel/open.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('__tests__/panel/tab/container.fixture.ts', REASON_FIXTURE_PLACE),
  at('src/components/ui/container.tsx', REASON_NO_UNIT),
  at('src/app/a/container.tsx', REASON_NO_UNIT),
  at('__tests__/screen/render.ts', REASON_UNIT_RENDER),
  at('__tests__/screen/draw.test-helper.tsx', REASON_UNIT_RENDER),
  at('__tests__/screen/paint.test-helper.ts', REASON_UNIT_RENDER),
  at('__tests__/screen/data.ts', REASON_TESTS_NAME),
  at('__tests__/screen/view.test-helper.tsx', REASON_TESTS_NAME),
  at('__tests__/screen/screen.test-helpers.ts', REASON_TESTS_NAME),
  at('__tests__/screen/data.fixture.ts', REASON_TESTS_NAME),
  at('__tests__/screen/data.json', REASON_TESTS_NAME),
  at('__tests__/', REASON_ORPHAN_DIR),
  at('__tests__/stray/', REASON_ORPHAN_DIR),
  at('__tests__/ui/player/scene-svg/deep/', REASON_ORPHAN_DIR),
].sort()
const FAKE_LAYOUT = layoutOf([...FAKE_TREE.keys()], FAKE_IO_DIRS)
// [パス, 期待する理由]。フォルダの対応は上の偽の作業ツリーのもの
const PLACEMENT_CASES = [
  ['__tests__/screen/open.integration.test.tsx', undefined],
  ['__tests__/screen/story-body/scroll.integration.test.tsx', undefined],
  ['__tests__/ui/player/scene-svg/draw.integration.test.tsx', undefined],
  ['__tests__/screen/open.integration.test.ts', REASON_INTEGRATION_PLACE],
  ['__tests__/stray/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['__tests__/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['__tests__/ui/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['__tests__/screen/story-body/deep/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/open.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['tests/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/container.browser.test.tsx', REASON_BROWSER_OLD],
  ['__tests__/screen/container.browser.test.tsx', REASON_BROWSER_OLD],
  ['src/a.browser.test.ts', REASON_BROWSER_OLD],
  ['tests/b.browser.test.js', REASON_BROWSER_OLD],
  ['__tests__/screen/math.test.ts', REASON_TESTS_UNIT],
  ['__tests__/screen/view.test.tsx', REASON_TESTS_UNIT],
  ['src/components/A/components/X/index.test.tsx', REASON_UNIT_TSX],
  ['src/components/A/container.test.tsx', REASON_UNIT_TSX],
  ['src/utils/a.test.tsx', REASON_UNIT_TSX],
  ['src/utils/a.test.ts', undefined],
  ['src/components/A/index.tsx', undefined],
  ['src/components/A/container.tsx', undefined],
  ['__tests__/screen/container.fixture.ts', undefined],
  ['__tests__/ui/player/container.fixture.ts', undefined],
  ['__tests__/lonely/container.fixture.ts', undefined],
  ['__tests__/screen/story-body/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['__tests__/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/components/Screen/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['__tests__/screen/screen.test-helper.ts', undefined],
  ['src/lib/a.fixture.ts', undefined],
  // I/O コンテナの外の状態コンテナが自分でなる単位(コンテナの無い単位フォルダ __tests__/panel/ も単位フォルダ)
  ['__tests__/ui/badge/show.integration.test.tsx', undefined],
  ['__tests__/panel/tab/switch.integration.test.tsx', undefined],
  ['__tests__/ui/badge/container.fixture.ts', undefined],
  ['__tests__/ui/mute/container.fixture.ts', undefined],
  ['__tests__/panel/container.fixture.ts', undefined],
  ['__tests__/panel/open.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['__tests__/panel/tab/container.fixture.ts', REASON_FIXTURE_PLACE],
  ['__tests__/foo/container.fixture.ts', REASON_FIXTURE_PLACE],
]
// [パス, 中身, 期待する理由]。フォルダの対応は上の偽の作業ツリーのもの
const OPEN = '__tests__/screen/open.integration.test.tsx'
const IMPORT_CASES = [
  [OPEN, `import { render } from '@testing-library/react'\n${SCREEN_IMPORT}`, undefined],
  [OPEN, `const Screen = await import('@/components/Screen/container')`, undefined],
  [OPEN, `import Screen from '@/components/Screen/./container'`, undefined],
  [
    '__tests__/screen/story-body/scroll.integration.test.tsx',
    `import StoryBody from '@/components/Screen/components/StoryBody/container'\n${SCREEN_IMPORT}`,
    undefined,
  ],
  // 型だけ・相対パス・ローダー・ほかのコンテナ・注釈の中・同じ名前で始まる別のファイル
  [OPEN, `import type Screen from '@/components/Screen/container'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import { type Props } from '@/components/Screen/container'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '../../src/components/Screen/container'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '@/components/Screen'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import data from '@/components/Screen/container.fixture'`, REASON_NOT_OWN_CONTAINER],
  [
    OPEN,
    `import StoryBody from '@/components/Screen/components/StoryBody/container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [
    '__tests__/screen/story-body/scroll.integration.test.tsx',
    SCREEN_IMPORT,
    REASON_NOT_OWN_CONTAINER,
  ],
  [OPEN, `// ${SCREEN_IMPORT}`, REASON_NOT_OWN_CONTAINER],
  // どのコンテナにも対応しないフォルダの統合テストは、描くべきコンテナが無い
  ['__tests__/stray/a.integration.test.tsx', SCREEN_IMPORT, REASON_NOT_OWN_CONTAINER],
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
  [
    '__tests__/screen/screen.test-helper.ts',
    `import { render } from '@testing-library/react'`,
    REASON_UNIT_RENDER,
  ],
  // __tests__ の中は、統合テストでないファイルの全部(置けない名前も)が描く道具を import しない
  ['__tests__/x/render.ts', `import { render } from '@testing-library/react'`, REASON_UNIT_RENDER],
  [
    '__tests__/x/draw.test-helper.tsx',
    `import { createRoot } from 'react-dom/client'`,
    REASON_UNIT_RENDER,
  ],
  [
    '__tests__/screen/container.fixture.ts',
    `import { render } from '@testing-library/react'`,
    REASON_UNIT_RENDER,
  ],
  // 自分で単位になる状態コンテナのフォルダの統合テストも、そのコンテナを描く
  [
    '__tests__/ui/badge/show.integration.test.tsx',
    `import Badge from '@/components/ui/Badge/container'`,
    undefined,
  ],
  [
    '__tests__/panel/tab/switch.integration.test.tsx',
    `import Badge from '@/components/ui/Badge/container'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  ['src/utils/a.test.ts', `import { screen } from '@testing-library/dom'`, undefined],
  ['src/utils/a.test.ts', `// import { render } from '@testing-library/react'`, undefined],
  ['src/utils/a.test.ts', `const name = 'react-dom/client'`, undefined],
  [
    '__tests__/screen/container.fixture.ts',
    `import type Screen from '@/components/Screen/container'`,
    undefined,
  ],
]
const readFake = file => FAKE_TREE.get(file) ?? ''
const fakeFound = checkTree([...FAKE_TREE.keys()].sort(), FAKE_NAME_ONLY, FAKE_LISTS, readFake)
const fakeTree = fakeFound.map(({ file, reason }) => at(file, reason)).sort()
const unitDirs = CONTAINER_DIRS.map(unitDirOf)
const selfCheckFailures = [
  ...TEST_FILE_CASES.filter(([file, expected]) => TEST_FILE.test(file) !== expected).map(
    ([file, expected]) => `テストの名前の判定 ${file} → ${expected}`
  ),
  ...VIOLATION_CASES.filter(
    ([file, code, expected]) => violationOf(file, () => code) !== expected
  ).map(([file, code, expected]) => `違反の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...SUPPORT_CASES.filter(([file, expected]) => supportViolationOf(file) !== expected).map(
    ([file, expected]) => `部品の置き場の判定 ${file} → ${expected}`
  ),
  ...KEBAB_CASES.filter(([name, expected]) => kebabOf(name) !== expected).map(
    ([name, expected]) => `kebab-case の判定 ${name} → ${expected}`
  ),
  ...(JSON.stringify(unitDirs) !== JSON.stringify(EXPECTED_UNIT_DIRS)
    ? [`I/O コンテナの単位フォルダ ${JSON.stringify(unitDirs)}`]
    : []),
  ...TEST_DIR_CASES.filter(([dir, expected]) => testDirOf(dir, CONTAINER_DIRS) !== expected).map(
    ([dir, expected]) => `__tests__ のフォルダの対応 ${dir} → ${expected}`
  ),
  ...NAME_CASES.filter(([file, expected]) => testRootNameViolationOf(file) !== expected).map(
    ([file, expected]) => `__tests__ の名前の判定 ${file} → ${expected}`
  ),
  ...PLACEMENT_CASES.filter(
    ([file, expected]) =>
      placementViolationOf(file, FAKE_LAYOUT.containers, FAKE_LAYOUT.unitDirs) !== expected
  ).map(([file, expected]) => `置き場の判定 ${file} → ${expected}`),
  ...IMPORT_CASES.filter(
    ([file, code, expected]) => importViolationOf(file, code, FAKE_LAYOUT.containers) !== expected
  ).map(([file, code, expected]) => `import の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...EXPECTED_TREE.filter(line => !fakeTree.includes(line)).map(
    line => `偽の作業ツリーで拾うべき違反を拾わない: ${line}`
  ),
  ...fakeTree
    .filter(line => !EXPECTED_TREE.includes(line))
    .map(line => `偽の作業ツリーで違反でないものを拾う: ${line}`),
  // 同じ行を2回拾う(数え違い)も、上の2つでは見えないので数で見る
  ...(fakeTree.length !== EXPECTED_TREE.length
    ? [`偽の作業ツリーの違反の数 ${fakeTree.length}(期待 ${EXPECTED_TREE.length})`]
    : []),
]
if (selfCheckFailures.length > 0) {
  throw new Error(
    `check-test-boundary: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

const filesUnder = dir =>
  existsSync(path.join(ROOT, dir))
    ? walk(path.join(ROOT, dir)).map(file => toPosix(path.relative(ROOT, file)))
    : []
const files = SCAN_DIRS.flatMap(filesUnder).sort()
const nameOnlyFiles = NAME_SCAN_DIRS.flatMap(filesUnder)
  .filter(file => INTEGRATION_NAME.test(file) || BROWSER_TEST.test(file))
  .sort()
const srcTestFiles = files.filter(file => file.startsWith('src/') && TEST_FILE.test(file))

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (srcTestFiles.length === 0) {
  console.error('check-test-boundary: src にテストが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

const read = file => readFileSync(path.join(ROOT, file), 'utf8')
const LISTS = { ioDirs: CONTAINER_DIRS }
const found = checkTree(files, nameOnlyFiles, LISTS, read)
const failures = found.map(({ file, reason }) => at(file, reason))

if (failures.length > 0) {
  console.error(`check-test-boundary: ${failures.length} 件の違反`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

const integrationCount = files.filter(file => INTEGRATION_TEST.test(file)).length
const supportCount = files.filter(file => TEST_SUPPORT.test(file)).length
const containerCount = files.filter(isSrcContainer).length
console.log(
  `check-test-boundary: src のテスト ${srcTestFiles.length} 件・__tests__ の統合テスト ${integrationCount} 件・フィクスチャとテストの部品 ${supportCount} 件・` +
    `コンテナ ${containerCount} 個(I/O コンテナの一覧 ${CONTAINER_DIRS.length} か所)を検査 — 違反なし`
)
