// 層の境界検査(ADR 0017 の D1〜D4)。表示部品が外の世界に触れていないかを、import のつながりと、import の要らない大域の名前で見る。
//
// 決まり: 外の世界に触れる入口(下の IO_FILES・IO_DIRS・IO_PACKAGES)を import してよいのは、コンテナ(container.tsx)と
// その隣の hooks/、画面のローダー、src/app/・src/lib/、テストの側(src のテストの名前と __tests__/ の全部)だけ(下の「許す側」)。それ以外は表示部品で、
// 入口を直接 import しないのはもちろん、入口へ届くファイル(フック・部品・utils)を import してもいけない。
// ESLint の no-restricted-imports はファイル1つずつの指定子しか見ないので、「入口を import するフックを表示部品が import する」形を見逃す。
// そこで src と __tests__ の import を全部読んでつながりの図にし、入口へ届くファイル(「染まった」ファイル)を逆向きにたどって求める。
//
// コンテナは、置き場の一覧(scripts/container-dirs.mjs。check-test-boundary.mjs と同じもの)のフォルダの container.tsx だけ。
// 名前が container.tsx でも一覧の外のものはコンテナに数えず、表示部品として見る。ローダーは一覧のうち画面の3つのフォルダの index.tsx だけ。
//
// 規則は6つ。
//   1. 許す側の外のファイルは、入口と、染まったファイルを import しない。
//      ただしコンテナは染まりを外へ伝えない(横断部品のコンテナは、外から container.tsx を直接指して表示部品が描く決まり)
//   2. 許す側の外のファイルは、コンテナの隣の hooks/(一覧のフォルダの直下の hooks/ の下)を import しない。
//      今は外の世界に触れていないフックでも、そこは画面の状態・データのフックの置き場なので。例外は無い
//   3. 画面のコンテナを import してよいのは、同じフォルダのローダーと、__tests__/<その単位>/ の下の統合テスト(*.integration.test.tsx)・
//      フィクスチャ(__tests__/<その単位>/container.fixture.ts)だけ。<単位> は scripts/container-dirs.mjs の unitDirOf で決まる。
//      許す側(src/app/ など)でも同じ。画面を描く入口はローダーで、ルートはローダーを指す
//   4. 一覧の外に container.tsx を置かない(置けると、外の世界の import を許す場所と、その隣のローダーまがいの index.tsx を作れてしまう)
//   5. 一覧のフォルダには container.tsx が要る。改名・移動で一覧が空振りすると、そのフォルダの hooks/ の許しだけが黙って残るため
//   6. 許す側の外のファイルは、import の要らない外の世界の入口(下の IO_GLOBALS・IO_MEMBERS。fetch・localStorage など)を式の中で使わない。
//      window.・globalThis.・self. を前に付けたもの、['…'] で引くもの、分割代入で取り出すものも数える。注釈・文字列・型の位置は数えない。
//      名前だけで見るので、同じ名前の変数や引数を作ってそれを使っても数える(名前を変える)
// 規則 1〜3 では、型だけの import(import type・import { type X }・export type)は数えない。実行時に読み込まれないため(表示部品の props に型を使う)。
// import の読み方は scripts/read-imports.mjs(require('…') の呼び出しは ESLint が src の全部で落とすので集めない)。
// 指定子の解決は tsconfig.json と同じ(@/ は src、@content/ は content で対象の外、相対パス、拡張子と index の省略)。
// src か __tests__ の中を指すのに解決できない import があれば、見逃しを避けるため落とす。名指しした入口が実在しないときも落とす。
//
// 見るのは git の追跡ではなく作業ツリー(check-test-boundary.mjs と同じ)。
// 判定の関数が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-layers.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  SCREEN_CONTAINER_DIRS,
  SHARED_CONTAINER_DIRS,
  TEST_ROOT,
  unitDirOf,
} from './container-dirs.mjs'
import { importsOf, parseSource } from './read-imports.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 読むフォルダ(src と、リポジトリ直下の統合テストの __tests__)
const SCAN_DIRS = ['src', TEST_ROOT]
const SKIP_DIRS = new Set(['node_modules', '.git'])

// 外の世界に触れる入口(ADR 0017 の D3)
const IO_FILES = [
  'src/lib/preferences.ts',
  'src/lib/weather.ts',
  'src/lib/analytics.ts',
  'src/lib/fetch-svg-source.ts',
  'src/lib/metadata.ts',
  // 村の卓上時計のストア
  'src/components/VillagePage/hooks/use-village-time.ts',
]
// この下のファイルは全部が入口(content の読み出し)
const IO_DIRS = ['src/lib/content/']
// パッケージは前方一致で見る(next/navigation.js のような書き方も同じ入口)
const IO_PACKAGES = ['next/navigation']
// import の要らない外の世界の入口(規則 6)。名前だけで触れる大域
const IO_GLOBALS = [
  'fetch',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
]
// 大域の物のメンバーで外の世界に触れるもの
const IO_MEMBERS = new Map([
  ['navigator', ['sendBeacon']],
  ['document', ['cookie']],
])
// 大域そのものを指す名前(window.fetch・globalThis.localStorage の形)
const GLOBAL_OBJECTS = ['window', 'globalThis', 'self']

const CONTAINER = 'container.tsx'
// import を読むファイル。それ以外(CSS など)は指定子の解決先としてだけ数える
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/
// 拡張子と index を省いた指定子に、tsconfig.json(moduleResolution: bundler)と同じ順で足して探す
const RESOLVE_SUFFIXES = [
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
// テストの側(Vitest が拾う名前・フィクスチャ・テストの部品)。__tests__/ の下は名前を問わずテストの側
const TEST_SIDE = /\.test\.tsx?$|\.fixture\.ts$|\.test-helper\.ts$/
const TEST_ROOT_PREFIX = `${TEST_ROOT}/`
// 画面のコンテナを import してよい、単位フォルダの下の統合テストとフィクスチャの名前
const INTEGRATION_TEST = /\.integration\.test\.tsx$/
const CONTAINER_FIXTURE = 'container.fixture.ts'

// 違反ごとに出す理由。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const REASON_IO =
  '表示部品は外の世界(保存・天気・計測・SVG の取得・content の読み出し・メタデータ・村の時計のストア・next/navigation)に触れない。' +
  '間にフック・部品・utils を挟んでも同じ(上の道で届く)。その import をコンテナ(container.tsx)か、その隣の hooks/ へ上げ、値は props で受け取る。' +
  '型だけなら import type にする(ADR 0017 の D3・D4)'
const REASON_HOOKS =
  'コンテナの隣の hooks/(コンテナの一覧 scripts/container-dirs.mjs のフォルダの直下の hooks/)は画面の状態・データのフックの置き場で、import してよいのはコンテナとその hooks/ の中だけ' +
  '(今は外の世界に触れていないフックでも)。表示部品の UI のフックなら、使う部品の隣の hooks/ へ移す。画面の状態なら、コンテナで呼んで値を props で受け取る(ADR 0017 の D3・D4)'
const REASON_SCREEN =
  '画面のコンテナ(画面の3つの container.tsx)を import してよいのは、同じフォルダのローダー(index.tsx)と、__tests__/<その単位>/ の下の統合テスト(*.integration.test.tsx)・' +
  'フィクスチャ(__tests__/<その単位>/container.fixture.ts)だけ。画面を描くならローダーの index.tsx を指す。画面の中の部品を別の所でも使うなら、その部品を表示部品として import する(ADR 0017 の D2、ADR 0019)'
const REASON_STRAY =
  'container.tsx を置けるのはコンテナの一覧(scripts/container-dirs.mjs)のフォルダだけで、ここに置いたものはコンテナに数えない(外の世界の import も許さない)。' +
  '新しいコンテナを置くなら、その一覧と ADR 0017 の D1 に足す(利用者の決定が要る)。コンテナでないなら名前を変える'
const REASON_MISSING =
  'コンテナの一覧(scripts/container-dirs.mjs)のフォルダに container.tsx が無い。改名・移動したなら、一覧と ADR 0017 の D1 を合わせて直す' +
  '(一覧が空振りすると、そのフォルダの hooks/ の許しだけが黙って残る)'
const REASON_GLOBAL =
  '表示部品は、import の要らない外の世界の入口(fetch・localStorage・sessionStorage・indexedDB・XMLHttpRequest・WebSocket・EventSource・navigator.sendBeacon・document.cookie。' +
  'window.・globalThis.・self. を付けても同じ)にも触れない。src/lib/ の入口に置き、コンテナ(container.tsx)かその隣の hooks/ から呼んで、値は props で受け取る。' +
  '名前だけで見るので、同じ名前の変数や引数も数える。そのときは名前を変える(ADR 0017 の D3・D4)'
const REASONS = new Map([
  ['io', REASON_IO],
  ['hooks', REASON_HOOKS],
  ['screen', REASON_SCREEN],
  ['stray', REASON_STRAY],
  ['missing', REASON_MISSING],
  ['global', REASON_GLOBAL],
])

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

const isIo = node =>
  IO_FILES.includes(node) || IO_DIRS.some(dir => node.startsWith(dir)) || IO_PACKAGES.includes(node)

// 指定子の解決。src と __tests__ の中のファイルはリポジトリ直下からのパス、入口のパッケージはその名前(前方一致)、
// それ以外のパッケージ・@content/・src と __tests__ の外は null(図に入れない)、その中を指すのに見つからなければ undefined
const resolveSpecifier = (from, specifier, files) => {
  if (specifier === undefined) return undefined
  const ioPackage = IO_PACKAGES.find(name => specifier.startsWith(name))
  if (ioPackage !== undefined) return ioPackage
  let base
  if (specifier.startsWith('@/')) base = `src/${specifier.slice(2)}`
  else if (/^\.\.?(?:\/|$)/.test(specifier))
    base = path.posix.join(path.posix.dirname(from), specifier)
  else return null
  if (!base.startsWith('src/') && !base.startsWith(TEST_ROOT_PREFIX)) return null
  return RESOLVE_SUFFIXES.map(suffix => `${base}${suffix}`).find(candidate => files.has(candidate))
}

// 名指しした入口のうち実在しないもの。改名・移動で名指しが空振りすると、入口へ届く import を黙って見逃すため
const missingIo = files => [
  ...IO_FILES.filter(file => !files.has(file)),
  ...IO_DIRS.filter(dir => ![...files.keys()].some(file => file.startsWith(dir))),
]

// 型の付け外し・括弧・非 null の印を外した中身((self as Window).fetch の self を見るため)
const unwrap = node =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node

// 式が大域そのもの(window・globalThis・self と、globalThis.window の形)か
const isGlobalObject = node => {
  const inner = unwrap(node)
  if (ts.isIdentifier(inner)) return GLOBAL_OBJECTS.includes(inner.text)
  return (
    ts.isPropertyAccessExpression(inner) &&
    GLOBAL_OBJECTS.includes(inner.name.text) &&
    isGlobalObject(inner.expression)
  )
}

// 式 object から名前 key を読むと外の世界に触れるなら、数える名前(fetch・navigator.sendBeacon など)。触れないなら undefined。
// object が大域そのものなら大域の名前を、navigator・document(window.navigator の形も)ならそのメンバーを見る
const ioAccessOf = (object, key) => {
  if (isGlobalObject(object) && IO_GLOBALS.includes(key)) return key
  const inner = unwrap(object)
  const host = ts.isIdentifier(inner)
    ? inner.text
    : ts.isPropertyAccessExpression(inner) && isGlobalObject(inner.expression)
      ? inner.name.text
      : undefined
  return IO_MEMBERS.get(host)?.includes(key) ? `${host}.${key}` : undefined
}

// 名前の欄(宣言の名前・メンバーやキーの名前・import の名前・JSX の属性名・ラベル)にある識別子。そこの名前は大域を読まない。
// ただし { fetch } の短い書き方は値を読む
const isNameSlot = node => {
  const parent = node.parent
  if (ts.isShorthandPropertyAssignment(parent)) return false
  return parent.name === node || parent.propertyName === node || parent.label === node
}

// 型だけを書く所。中の名前は実行時に読まれない。class の extends だけは値を読むので見る
const isTypePlace = node =>
  ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) ||
  (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ImplementsKeyword) ||
  (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node))

// 1 ファイルが式の中で使う、import の要らない外の世界の入口を { name, line } で返す(規則 6)
const globalIoOf = source => {
  const found = []
  const add = (node, name) => {
    if (name === undefined) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    found.push({ name, line: line + 1 })
  }
  const visit = node => {
    if (isTypePlace(node)) return
    if (ts.isIdentifier(node)) {
      if (IO_GLOBALS.includes(node.text) && !isNameSlot(node)) add(node, node.text)
    } else if (ts.isPropertyAccessExpression(node)) {
      add(node, ioAccessOf(node.expression, node.name.text))
    } else if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression
      if (ts.isStringLiteralLike(key)) add(node, ioAccessOf(node.expression, key.text))
    } else if (
      ts.isBindingElement(node) &&
      ts.isObjectBindingPattern(node.parent) &&
      ts.isVariableDeclaration(node.parent.parent) &&
      node.parent.parent.initializer !== undefined
    ) {
      // const { localStorage } = window の形。取り出すキーと、取り出す元の式を見る
      const key = node.propertyName ?? node.name
      if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) {
        add(node, ioAccessOf(node.parent.parent.initializer, key.text))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

// files: リポジトリ直下からのパス → 中身(import を読まないファイルは undefined)。
// dirs: コンテナを置くフォルダの一覧(screenDirs は画面、sharedDirs は横断部品)。
// 返すのは違反の一覧と、解決できなかった import の一覧
const checkLayers = (files, { screenDirs, sharedDirs }) => {
  // 実行時の import だけを辺にする(型だけの import は数えない)。大域の入口もここで集める
  const edges = new Map()
  const globals = new Map()
  const unresolved = []
  for (const [file, code] of files) {
    if (code === undefined) continue
    const source = parseSource(file, code)
    const targets = new Set()
    for (const { specifier, typeOnly } of importsOf(source)) {
      const target = resolveSpecifier(file, specifier, files)
      if (target === undefined)
        unresolved.push({ file, specifier: specifier ?? '(式で組んだ指定子)' })
      else if (target !== null && !typeOnly) targets.add(target)
    }
    edges.set(file, [...targets].sort())
    globals.set(file, globalIoOf(source))
  }

  const containerDirs = [...screenDirs, ...sharedDirs]
  const isContainer = file => containerDirs.some(dir => file === `${dir}/${CONTAINER}`)
  const inContainerHooks = file => containerDirs.some(dir => file.startsWith(`${dir}/hooks/`))
  const isLoader = file => screenDirs.some(dir => file === `${dir}/index.tsx`)
  const isAllowed = file =>
    isContainer(file) ||
    inContainerHooks(file) ||
    isLoader(file) ||
    file.startsWith('src/app/') ||
    file.startsWith('src/lib/') ||
    file.startsWith(TEST_ROOT_PREFIX) ||
    TEST_SIDE.test(file)
  // 画面のコンテナ → それを import してよいファイルか(同じフォルダのローダーと、単位フォルダの下の統合テスト・単位フォルダ直下のフィクスチャ)
  const screenOwners = new Map(
    screenDirs.map(dir => {
      const unitDir = unitDirOf(dir)
      return [
        `${dir}/${CONTAINER}`,
        file =>
          file === `${dir}/index.tsx` ||
          file === `${unitDir}/${CONTAINER_FIXTURE}` ||
          (file.startsWith(`${unitDir}/`) && INTEGRATION_TEST.test(file)),
      ]
    })
  )

  // 入口から import を逆向きにたどり、染まったファイルごとに入口へ1歩近づく先を覚える(入口は null)。
  // 幅優先なので、覚えた先をたどると入口への一番短い道になる。コンテナからは先へ伝えない
  const importers = new Map()
  for (const [file, targets] of edges) {
    for (const target of targets) importers.set(target, [...(importers.get(target) ?? []), file])
  }
  const nodes = [...new Set([...files.keys(), ...importers.keys()])].sort()
  const towardIo = new Map(nodes.filter(isIo).map(node => [node, null]))
  const queue = [...towardIo.keys()]
  while (queue.length > 0) {
    const node = queue.shift()
    if (isContainer(node)) continue
    for (const importer of importers.get(node) ?? []) {
      if (towardIo.has(importer)) continue
      towardIo.set(importer, node)
      queue.push(importer)
    }
  }
  const chainOf = node => (node === null ? [] : [node, ...chainOf(towardIo.get(node))])

  const violations = []
  for (const [file, targets] of edges) {
    for (const target of targets) {
      const mayImport = screenOwners.get(target)
      if (mayImport !== undefined && !mayImport(file)) {
        violations.push({ rule: 'screen', file, target })
      }
    }
    if (isAllowed(file)) continue
    for (const target of targets) {
      if (towardIo.has(target) && !isContainer(target)) {
        violations.push({ rule: 'io', file, target, chain: chainOf(target) })
      } else if (inContainerHooks(target)) {
        violations.push({ rule: 'hooks', file, target })
      }
    }
    for (const { name, line } of globals.get(file)) {
      violations.push({ rule: 'global', file, target: name, line })
    }
  }
  for (const file of files.keys()) {
    if (path.posix.basename(file) === CONTAINER && !isContainer(file)) {
      violations.push({ rule: 'stray', file })
    }
  }
  for (const dir of containerDirs) {
    if (!files.has(`${dir}/${CONTAINER}`))
      violations.push({ rule: 'missing', file: `${dir}/${CONTAINER}` })
  }
  return { violations, unresolved, edgeCount: [...edges.values()].flat().length }
}

// 違反を1行の文字列にする(自己検査の照合と出力で同じ形を使う)
const formatViolation = ({ rule, file, target, chain, line }) => {
  if (rule === 'io') return `${file} → ${target}(届く道: ${chain.join(' → ')})`
  if (rule === 'global') return `${file}:${line} ${target}`
  if (rule === 'stray' || rule === 'missing') return file
  return `${file} → ${target}`
}
// 自己検査で照合する形。同じ形の行(hooks と screen)を取り違えないよう、規則の名前を前に付ける
const keyOf = violation => `${violation.rule} ${formatViolation(violation)}`

// ---- 自己検査 ----
// 型だけの判定・指定子の解決・許す側の判定・染まりのたどり方・大域の名前の判定が壊れると、違反を見逃したまま「違反なし」で通る。
// そこで違反と分かっているファイルと違反でないファイルを並べた偽の src を、実際の検査と同じ関数でメモリの上で判定し、
// 違反の一覧(道を含む)が期待とぴったり同じでなければ落とす。コンテナの一覧も偽のものを渡す(Gone は container.tsx が無い)
const FAKE_DIRS = {
  screenDirs: ['src/components/Screen', 'src/components/Gone'],
  sharedDirs: ['src/components/ui/Player'],
}
// 大域の入口に触れる表示部品の1行ずつと、その行で数える名前
const GLOBAL_CASES = [
  [`export const a = () => fetch('/a')`, 'fetch'],
  [`export const b = () => window.localStorage.getItem('a')`, 'localStorage'],
  [`export const c = () => globalThis['sessionStorage']`, 'sessionStorage'],
  [`export const d = () => navigator.sendBeacon('/a')`, 'navigator.sendBeacon'],
  [`export const e = () => window.navigator.sendBeacon('/a')`, 'navigator.sendBeacon'],
  [`export const f = () => { document.cookie = 'a=1' }`, 'document.cookie'],
  [`export const g = () => new WebSocket('ws://a')`, 'WebSocket'],
  [`export const h = () => new EventSource('/a')`, 'EventSource'],
  [`export const i = () => new XMLHttpRequest()`, 'XMLHttpRequest'],
  [`export const j = () => indexedDB.open('a')`, 'indexedDB'],
  [
    `export const k = () => { const { localStorage: store } = window; return store }`,
    'localStorage',
  ],
  [`export const l = () => ({ fetch })`, 'fetch'],
  [`export const m = () => (self as Window).fetch('/a')`, 'fetch'],
  [`export const n = () => globalThis.window.localStorage`, 'localStorage'],
  [`export const o = () => { const { cookie } = document; return cookie }`, 'document.cookie'],
  [`export const p = () => window?.['indexedDB']`, 'indexedDB'],
  [`export const q = () => fetch.call(undefined, '/a')`, 'fetch'],
]
const FAKE_SRC = new Map(
  Object.entries({
    // 入口(src/lib/ は大域の入口に触れてよい)
    'src/lib/preferences.ts': `export const readTheme = () => 'light'\nexport type Theme = 'light'`,
    'src/lib/weather.ts': `export const fetchWeather = () => fetch('/weather')\nexport type Precipitation = 'rain'`,
    'src/lib/analytics.ts': `export const countPageview = () => navigator.sendBeacon('/count')`,
    'src/lib/fetch-svg-source.ts': 'export const fetchSvgSource = () => {}',
    'src/lib/metadata.ts': 'export const buildMetadata = () => ({})',
    'src/lib/content/read.ts': `import { parse } from './parse'\nexport const readContent = () => parse()`,
    'src/lib/content/parse.ts': 'export const parse = () => 0',
    'src/components/VillagePage/hooks/use-village-time.ts': 'export const useVillageTime = () => 0',
    // lib は許す側。入口へ届く lib を表示部品が import すると落ちる
    'src/lib/theme-label.ts': `import { readTheme } from './preferences'\nexport const label = readTheme`,
    'src/lib/village/grid.ts': 'export const grid = 0',
    'src/utils/clamp.ts': 'export const clamp = () => 0',
    // 画面: ローダー・コンテナ・隣の hooks(下のフォルダも)・テストの側は通る。大域の入口に触れても通る
    'src/components/Screen/index.tsx': [
      `import { readContent } from '@/lib/content/read'`,
      `import Container from './container'`,
      `const cookie = document.cookie`,
    ].join('\n'),
    'src/components/Screen/container.tsx': [
      `import { readTheme } from '@/lib/preferences'`,
      `import { useClock } from './hooks/use-clock'`,
      `import { useWeather } from './hooks/use-weather/use-weather'`,
      `import { useUiOnly } from './hooks/use-ui-only'`,
      `import Body from './components/Body'`,
      `export const load = () => window.fetch('/a')`,
    ].join('\n'),
    'src/components/Screen/hooks/use-clock.ts': `import { useVillageTime } from '@/components/VillagePage/hooks/use-village-time'`,
    'src/components/Screen/hooks/use-weather/use-weather.ts': `import { fetchWeather } from '@/lib/weather'`,
    'src/components/Screen/hooks/use-ui-only.ts': 'export const useUiOnly = () => 0',
    'src/components/Screen/hooks/use-saved.ts': `export const useSaved = () => localStorage.getItem('a')`,
    // 単位フォルダの下の統合テスト(入れ子のフォルダも)・単位フォルダ直下のフィクスチャは、画面のコンテナを描いてよい。
    // __tests__/ の下は名前を問わずテストの側で、入口・I/O コンテナの隣の hooks/・大域の入口に触れても通る。相対パスは __tests__ と src の中を解決する
    '__tests__/screen/open.integration.test.tsx': [
      `import { readTheme } from '@/lib/preferences'`,
      `import { useUiOnly } from '@/components/Screen/hooks/use-ui-only'`,
      `import Screen from '@/components/Screen/container'`,
      `import { stepFrame } from './screen.test-helper'`,
      `globalThis.fetch = () => 0`,
    ].join('\n'),
    '__tests__/screen/body/scroll.integration.test.tsx': `import Screen from '../../../src/components/Screen/container'`,
    '__tests__/screen/container.fixture.ts': `import { readContent } from '@/lib/content/read'\nimport Screen from '@/components/Screen/container'`,
    '__tests__/screen/screen.test-helper.ts': `import { readTheme } from '@/lib/preferences'\nexport const stepFrame = () => sessionStorage`,
    '__tests__/screen/data.ts': `import { readTheme } from '@/lib/preferences'\nexport const store = localStorage`,
    'src/components/Screen/screen.test-helper.ts': `import { readTheme } from '@/lib/preferences'\nconst store = sessionStorage`,
    // もとの置き場の統合テスト・フィクスチャと、単位フォルダの下でも統合テスト・単位フォルダ直下のフィクスチャでないもの・
    // ほかの単位・名前の前の方が同じだけの別のフォルダは、テストの側でも画面のコンテナを描かない
    'src/components/Screen/container.browser.test.tsx': [
      `import { readTheme } from '@/lib/preferences'`,
      `import { useUiOnly } from './hooks/use-ui-only'`,
      `import Screen from './container'`,
      `globalThis.fetch = () => 0`,
    ].join('\n'),
    'src/components/Screen/container.fixture.ts': `import { readContent } from '@/lib/content/read'\nimport Screen from './container'`,
    '__tests__/screen/render.test-helper.ts': `import Screen from '@/components/Screen/container'`,
    '__tests__/screen/body/container.fixture.ts': `import Screen from '@/components/Screen/container'`,
    '__tests__/screen/open.integration.test.ts': `import Screen from '@/components/Screen/container'`,
    '__tests__/gone/open.integration.test.tsx': `import Screen from '@/components/Screen/container'`,
    '__tests__/screen-extra/open.integration.test.tsx': `import Screen from '@/components/Screen/container'`,
    'src/components/Screen/utils/build.test.ts': `import { parse } from '@/lib/content/parse'`,
    'src/app/page.tsx': [
      `import Screen from '@/components/Screen'`,
      `import { buildMetadata } from '@/lib/metadata'`,
      `import type Container from '@/components/Screen/container'`,
      `const socket = new WebSocket('ws://a')`,
    ].join('\n'),
    // 表示部品で通るもの: 型だけの import・注釈の中・純粋な lib と utils・自分の UI のフック・横断部品のコンテナ
    'src/components/Screen/components/Body/index.tsx': [
      `import type { Theme } from '@/lib/preferences'`,
      `import { type Precipitation } from '@/lib/weather'`,
      `import type { UiOnly } from '../../hooks/use-ui-only'`,
      `import type Container from '../../container'`,
      `// import { readTheme } from '@/lib/preferences'`,
      `/* import { fetchWeather } from '@/lib/weather' */`,
      `import Link from 'next/link'`,
      `import { grid } from '@/lib/village/grid'`,
      `import { clamp } from '../../../../utils/clamp'`,
      `import { useBody } from './hooks/use-body'`,
      `import Player from '@/components/ui/Player/container'`,
      `import styles from './body.module.css'`,
      `type Kind = typeof import('@/lib/analytics')`,
    ].join('\n'),
    'src/components/Screen/components/Body/body.module.css': undefined,
    'src/components/Screen/components/Body/hooks/use-body.ts': `import { useId } from 'react'`,
    'src/components/Screen/components/Body/types.ts': `export type { Theme } from '@/lib/preferences'\nexport { type Precipitation } from '@/lib/weather'`,
    // 表示部品で通るもの: 大域の入口と同じ名前でも、注釈・文字列・型の位置・名前の欄・ほかの物のメンバー
    'src/components/Screen/components/Quiet/index.tsx': [
      `// fetch('/a') と localStorage は注釈の中`,
      `/* window.localStorage.getItem('a') */`,
      `const label = 'fetch localStorage document.cookie'`,
      'const shown = `navigator.sendBeacon`',
      `let socket: WebSocket | undefined`,
      `type Load = typeof fetch`,
      `interface Saved extends Storage { localStorage: string }`,
      `const api = { fetch: () => 0, localStorage: 1 }`,
      `api.fetch()`,
      `const doc = { cookie: '' }`,
      `doc.cookie = 'a'`,
      `const send = (props: { navigator: Navigator }) => props.navigator.sendBeacon`,
      `class Store { fetch() { return 0 } }`,
      `const frame = <Frame fetch={1} />`,
      `const saved = socket as WebSocket`,
      `export const quiet = [label, shown, api, doc, send, Store, frame, saved]`,
    ].join('\n'),
    // 横断部品のコンテナを描く表示部品を、さらに表示部品が描く(コンテナの先の染まりは伝わらない)
    'src/components/Screen/components/Page/index.tsx': `import Body from '../Body'`,
    // 横断部品のコンテナ。染まっているが、表示部品が描いてよい
    'src/components/ui/Player/container.tsx': `import { useSources } from './hooks/use-sources'\nimport Player from './index'`,
    'src/components/ui/Player/hooks/use-sources.ts': `import { fetchSvgSource } from '@/lib/fetch-svg-source'`,
    // 横断部品のフォルダの index.tsx はローダーではない(ローダーは画面のフォルダの index.tsx だけ)
    'src/components/ui/Player/index.tsx': `import { parse } from '@/lib/content/parse'\nexport default function Player() {}`,
    // 一覧の外の container.tsx はコンテナではなく、隣の index.tsx もローダーではない(どちらも表示部品として見る)
    'src/components/Screen/components/Card/container.tsx': `import { readTheme } from '@/lib/preferences'\nexport const load = () => fetch('/a')`,
    'src/components/Screen/components/Card/index.tsx': `import Card from './container'\nimport { readContent } from '@/lib/content/read'`,
    // 表示部品で落ちるもの
    'src/components/Bad/direct.tsx': `import { readTheme } from '@/lib/preferences'`,
    'src/components/Bad/mixed.tsx': `import { readTheme, type Theme } from '@/lib/preferences'`,
    'src/components/Bad/side-effect.tsx': `import '@/lib/analytics'`,
    'src/components/Bad/dynamic.tsx': `export const load = () => import('@/lib/fetch-svg-source')`,
    'src/components/Bad/reexport.ts': `export { readTheme } from '@/lib/preferences'`,
    'src/components/Bad/star.ts': `export * from '@/lib/preferences'`,
    'src/components/Bad/star-as.ts': `export * as preferences from '@/lib/preferences'`,
    'src/components/Bad/require.ts': `import preferences = require('@/lib/preferences')`,
    'src/components/Bad/require-type.ts': `import type preferences = require('@/lib/preferences')`,
    'src/components/Bad/navigation.tsx': `import { usePathname } from 'next/navigation'`,
    'src/components/Bad/navigation-js.tsx': `import { usePathname } from 'next/navigation.js'`,
    'src/components/Bad/content.tsx': `import { parse } from '@/lib/content/parse'`,
    'src/components/Bad/metadata.ts': `import * as meta from '@/lib/metadata'`,
    'src/components/Bad/store.tsx': `import { useVillageTime } from '@/components/VillagePage/hooks/use-village-time'`,
    'src/components/Bad/via-lib.tsx': `import { label } from '@/lib/theme-label'`,
    'src/components/Bad/via-hook.tsx': `import { useTheme } from '@/hooks/use-theme'`,
    'src/hooks/use-theme.ts': `import { readTheme } from '@/lib/preferences'`,
    'src/components/Bad/via-sibling.tsx': `import Direct from './direct'`,
    'src/components/Bad/via-loader.tsx': `import Screen from '@/components/Screen'`,
    'src/components/Bad/screen-hook.tsx': `import { useUiOnly } from '@/components/Screen/hooks/use-ui-only'`,
    'src/components/Bad/screen-io-hook.tsx': `import { useWeather } from '../Screen/hooks/use-weather/use-weather'`,
    'src/components/Bad/index.tsx': `import { readContent } from '@/lib/content/read'`,
    'src/components/Bad/hooks/use-bad.ts': `import { fetchWeather } from '@/lib/weather'`,
    'src/components/Screen/components/Deep/hooks/use-deep.ts': `import { readTheme } from '@/lib/preferences'`,
    'src/utils/bad.ts': `import { readTheme } from '@/lib/preferences'`,
    // 画面のコンテナを、そのフォルダのローダー・統合テスト・フィクスチャの外から import する(許す側でも落ちる)
    'src/components/Bad/screen-container.tsx': `import Screen from '@/components/Screen/container'`,
    'src/components/Bad/container.browser.test.tsx': `import Screen from '../Screen/container'`,
    'src/app/direct.tsx': `import Screen from '@/components/Screen/container'`,
    // 大域の入口に触れる表示部品
    'src/components/Bad/global.tsx': GLOBAL_CASES.map(([line]) => line).join('\n'),
    'src/hooks/use-socket.ts': `export const useSocket = () => new WebSocket('ws://a')`,
  })
)
const io = (file, ...chain) => keyOf({ rule: 'io', file, target: chain[0], chain })
const hooks = (file, target) => keyOf({ rule: 'hooks', file, target })
const screen = (file, target) => keyOf({ rule: 'screen', file, target })
const globalIo = (file, line, target) => keyOf({ rule: 'global', file, target, line })
const PREFERENCES = 'src/lib/preferences.ts'
const SCREEN_CONTAINER = 'src/components/Screen/container.tsx'
const CARD_CONTAINER = 'src/components/Screen/components/Card/container.tsx'
const EXPECTED_VIOLATIONS = [
  io('src/components/Bad/direct.tsx', PREFERENCES),
  io('src/components/Bad/mixed.tsx', PREFERENCES),
  io('src/components/Bad/side-effect.tsx', 'src/lib/analytics.ts'),
  io('src/components/Bad/dynamic.tsx', 'src/lib/fetch-svg-source.ts'),
  io('src/components/Bad/reexport.ts', PREFERENCES),
  io('src/components/Bad/star.ts', PREFERENCES),
  io('src/components/Bad/star-as.ts', PREFERENCES),
  io('src/components/Bad/require.ts', PREFERENCES),
  io('src/components/Bad/navigation.tsx', 'next/navigation'),
  io('src/components/Bad/navigation-js.tsx', 'next/navigation'),
  io('src/components/Bad/content.tsx', 'src/lib/content/parse.ts'),
  io('src/components/Bad/metadata.ts', 'src/lib/metadata.ts'),
  io('src/components/Bad/store.tsx', 'src/components/VillagePage/hooks/use-village-time.ts'),
  io('src/components/Bad/via-lib.tsx', 'src/lib/theme-label.ts', PREFERENCES),
  io('src/components/Bad/via-hook.tsx', 'src/hooks/use-theme.ts', PREFERENCES),
  io('src/hooks/use-theme.ts', PREFERENCES),
  io('src/components/Bad/via-sibling.tsx', 'src/components/Bad/direct.tsx', PREFERENCES),
  io(
    'src/components/Bad/via-loader.tsx',
    'src/components/Screen/index.tsx',
    'src/lib/content/read.ts'
  ),
  hooks('src/components/Bad/screen-hook.tsx', 'src/components/Screen/hooks/use-ui-only.ts'),
  io(
    'src/components/Bad/screen-io-hook.tsx',
    'src/components/Screen/hooks/use-weather/use-weather.ts',
    'src/lib/weather.ts'
  ),
  io('src/components/Bad/index.tsx', 'src/lib/content/read.ts'),
  io('src/components/Bad/hooks/use-bad.ts', 'src/lib/weather.ts'),
  io('src/components/Screen/components/Deep/hooks/use-deep.ts', PREFERENCES),
  io('src/utils/bad.ts', PREFERENCES),
  io('src/components/ui/Player/index.tsx', 'src/lib/content/parse.ts'),
  io(CARD_CONTAINER, PREFERENCES),
  globalIo(CARD_CONTAINER, 2, 'fetch'),
  keyOf({ rule: 'stray', file: CARD_CONTAINER }),
  io('src/components/Screen/components/Card/index.tsx', CARD_CONTAINER, PREFERENCES),
  io('src/components/Screen/components/Card/index.tsx', 'src/lib/content/read.ts'),
  keyOf({ rule: 'missing', file: 'src/components/Gone/container.tsx' }),
  screen('src/components/Bad/screen-container.tsx', SCREEN_CONTAINER),
  screen('src/components/Bad/container.browser.test.tsx', SCREEN_CONTAINER),
  screen('src/app/direct.tsx', SCREEN_CONTAINER),
  screen('src/components/Screen/container.browser.test.tsx', SCREEN_CONTAINER),
  screen('src/components/Screen/container.fixture.ts', SCREEN_CONTAINER),
  screen('__tests__/screen/render.test-helper.ts', SCREEN_CONTAINER),
  screen('__tests__/screen/body/container.fixture.ts', SCREEN_CONTAINER),
  screen('__tests__/screen/open.integration.test.ts', SCREEN_CONTAINER),
  screen('__tests__/gone/open.integration.test.tsx', SCREEN_CONTAINER),
  screen('__tests__/screen-extra/open.integration.test.tsx', SCREEN_CONTAINER),
  ...GLOBAL_CASES.map(([, name], index) =>
    globalIo('src/components/Bad/global.tsx', index + 1, name)
  ),
  globalIo('src/hooks/use-socket.ts', 1, 'WebSocket'),
].sort()
// 解決できない import は、見逃さないよう違反とは別に必ず拾う
const FAKE_UNRESOLVED = new Map(
  Object.entries({
    'src/components/A/index.tsx': `import Gone from './gone'\nimport { lost } from '@/lib/lost'\nconst load = name => import(name)`,
    'src/components/A/b.tsx': `import Link from 'next/link'\nimport type { Locale } from '@content/types/content'`,
    '__tests__/a/b.integration.test.tsx': `import { page } from 'vitest/browser'\nimport { step } from './gone.test-helper'\nimport A from '../../src/components/A/gone'`,
  })
)
const EXPECTED_UNRESOLVED = [
  'src/components/A/index.tsx ./gone',
  'src/components/A/index.tsx @/lib/lost',
  'src/components/A/index.tsx (式で組んだ指定子)',
  '__tests__/a/b.integration.test.tsx ./gone.test-helper',
  '__tests__/a/b.integration.test.tsx ../../src/components/A/gone',
]

const fake = checkLayers(FAKE_SRC, FAKE_DIRS)
const fakeViolations = fake.violations.map(keyOf).sort()
const fakeUnresolved = checkLayers(FAKE_UNRESOLVED, FAKE_DIRS).unresolved.map(
  ({ file, specifier }) => `${file} ${specifier}`
)
const selfCheckFailures = [
  ...EXPECTED_VIOLATIONS.filter(line => !fakeViolations.includes(line)).map(
    line => `拾うべき違反を拾わない: ${line}`
  ),
  ...fakeViolations
    .filter(line => !EXPECTED_VIOLATIONS.includes(line))
    .map(line => `違反でないものを拾う: ${line}`),
  // 同じ行を2回拾う(数え違い)も、上の2つでは見えないので数で見る
  ...(fakeViolations.length !== EXPECTED_VIOLATIONS.length
    ? [`違反の数 ${fakeViolations.length}(期待 ${EXPECTED_VIOLATIONS.length})`]
    : []),
  ...(fake.unresolved.length > 0 ? ['偽の src で解決できない import がある'] : []),
  ...(JSON.stringify(fakeUnresolved) !== JSON.stringify(EXPECTED_UNRESOLVED)
    ? [`解決できない import の判定 ${JSON.stringify(fakeUnresolved)}`]
    : []),
  ...(missingIo(FAKE_SRC).length > 0 ? ['入口の実在の判定(全部ある)'] : []),
  ...(missingIo(FAKE_UNRESOLVED).length !== IO_FILES.length + IO_DIRS.length
    ? ['入口の実在の判定(全部無い)']
    : []),
]
if (selfCheckFailures.length > 0) {
  throw new Error(`check-layers: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`)
}

const files = new Map(
  SCAN_DIRS.filter(dir => existsSync(path.join(ROOT, dir)))
    .flatMap(dir => walk(path.join(ROOT, dir)))
    .map(file => toPosix(path.relative(ROOT, file)))
    .sort()
    .map(file => [
      file,
      CODE_FILE.test(file) ? readFileSync(path.join(ROOT, file), 'utf8') : undefined,
    ])
)

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
const srcCount = [...files.keys()].filter(file => file.startsWith('src/')).length
if (srcCount === 0) {
  console.error('check-layers: src にファイルが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

const missing = missingIo(files)
if (missing.length > 0) {
  console.error(
    `check-layers: 名指しした外の世界の入口が実在しない(移動・改名したらこのファイルの IO_FILES・IO_DIRS を直す): ${missing.join(', ')}`
  )
  process.exit(1)
}

const containerCount = SCREEN_CONTAINER_DIRS.length + SHARED_CONTAINER_DIRS.length
const { violations, unresolved, edgeCount } = checkLayers(files, {
  screenDirs: SCREEN_CONTAINER_DIRS,
  sharedDirs: SHARED_CONTAINER_DIRS,
})

if (unresolved.length > 0) {
  console.error(
    `check-layers: ${unresolved.length} 件の import を解決できない(解決できないと、その先が外の世界へ届くかを見られない)`
  )
  for (const { file, specifier } of unresolved) console.error(`  - ${file}: ${specifier}`)
  process.exit(1)
}

if (violations.length > 0) {
  console.error(`check-layers: ${violations.length} 件の違反`)
  for (const violation of violations) {
    console.error(`  - ${formatViolation(violation)}: ${REASONS.get(violation.rule)}`)
  }
  process.exit(1)
}

console.log(
  `check-layers: src と __tests__ のファイル ${files.size} 件(import ${edgeCount} 本)とコンテナの一覧 ${containerCount} か所を検査 — 違反なし`
)
