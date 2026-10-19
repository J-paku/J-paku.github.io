// 層の境界検査(ADR 0004・ADR 0017 の D2〜D4・ADR 0019・ADR 0024)。表示部品と状態コンテナが外の世界に触れていないかを、import のつながりと、
// import の要らない大域の名前で見る。import の向き(utils ← lib ← hooks ← components ← app)も、書いた指定子ではなく import の先のファイルで見る(規則 7)。
//
// 決まり: 外の世界に触れる入口(下の IO_FILES・IO_DIRS・IO_PACKAGES)を import してよいのは、I/O コンテナ(一覧のフォルダの index.tsx)と
// その隣の hooks/、src/app/(画面のローダーとルート)・src/lib/、テストの側(テストの名前と、コンテナのフォルダの __tests__/ の中の全部)だけ(下の「許す側」)。
// それ以外は表示部品か状態コンテナで、入口を直接 import しないのはもちろん、入口へ届くファイル(フック・部品・utils)を import してもいけない。
// ESLint の no-restricted-imports はファイル1つずつの指定子しか見ないので、「入口を import するフックを表示部品が import する」形を見逃す。
// そこで src の import を全部読んでつながりの図にし、入口へ届くファイル(「染まった」ファイル)を逆向きにたどって求める。
//
// I/O コンテナは、置き場の一覧(scripts/container-dirs.mjs。check-test-boundary.mjs と同じもの)のフォルダの index.tsx だけ
// (どのファイルがコンテナかの判定の正本は scripts/find-containers.mjs。I/O コンテナの名前もそこから取る)。
// 一覧の外のコンテナ(フックを使う index.tsx)は状態コンテナで、import の制限は表示部品と同じ(「状態がある」と「外に触れる」は別の軸。ADR 0019)。
// なので、この検査は状態コンテナと表示部品を分けずに見る。状態コンテナの隣の hooks/ も、許す側に入らない。
// 画面のローダー(content を読んで画面のコンテナへ渡すサーバの入口)は src/app/<名前>-screen.tsx で、画面のフォルダごとに1つ(下の SCREEN_LOADER_OF)。
//
// 規則は7つ。
//   1. 許す側の外のファイルは、入口と、染まったファイルを import しない。
//      ただし I/O コンテナは染まりを外へ伝えない(横断部品のコンテナは、外から @/components/ui/<名前> を指して表示部品が描く決まり)
//   2. 許す側の外のファイルは、I/O コンテナの隣の hooks/(一覧のフォルダの直下の hooks/ の下)を import しない。
//      今は外の世界に触れていないフックでも、そこは画面の状態・データのフックの置き場なので。例外は無い
//   3. 画面のコンテナ(画面のフォルダの index.tsx)を import してよいのは、その画面のローダー(SCREEN_LOADER_OF)と、その画面のフォルダの下の
//      統合テスト(*.integration.test.tsx)と、画面のフォルダのフィクスチャ(index.tsx の隣か、そのフォルダの __tests__/ の直下の index.fixture.ts)だけ(ADR 0022・ADR 0024)。
//      許す側(src/app/ のほかのファイル・ほかの画面のローダーなど)でも同じ。画面を描く入口はローダーで、ルートはローダーを指す
//   4. 一覧のフォルダには index.tsx が、画面のフォルダにはローダーが要る。改名・移動で一覧が空振りすると、そのフォルダの hooks/ の許しだけが黙って残るため
//   5. 許す側の外のファイルは、import の要らない外の世界の入口(下の IO_GLOBALS・IO_MEMBERS。fetch・localStorage など)を式の中で使わない。
//      window.・globalThis.・self. を前に付けたもの、['…'] で引くもの、分割代入で取り出すものも数える。注釈・文字列・型の位置は数えない。
//      名前だけで見るので、同じ名前の変数や引数を作ってそれを使っても数える(名前を変える)
//   6. I/O コンテナとその隣の hooks/ も、content の読み出し(IO_DIRS の src/lib/content/)へは届かない(間に lib・utils を挟んでも同じ)。
//      content を読むのは src/app のローダーだけで、コンテナは読み出した値を props で受け取る(ADR 0024)。
//      ローダーを src/components の中へ戻す(I/O コンテナの index.tsx が content を読む)とここで落ちる。
//      許す側の外のファイルが content へ届くのは規則 1 が落とすので、ここでは重ねない
//   7. import の向き(utils ← lib ← hooks ← components ← app。content の実データを読むのは src/lib/content だけ)。
//      向きの正本は eslint.config.mjs の no-restricted-imports で、ESLint は書いた指定子の文字列を patterns(group・regex)に当てるだけなので、
//      別名(@/…)で書けば落ちる import を、相対パスで書くと(import でも export … from でも)見逃す。import() は別名でも見ない。そこで src と content のコードのファイルの
//      import の先のファイル(src・content の中)を別名の指定子(@/ + src の下のパス、content は @content/ + content の下のパス)に書き直し、
//      import するファイルに ESLint が掛ける patterns に当てる(content から src を相対パスで指す向きも、content に掛かる patterns が落とす)。
//      掛かる patterns は ESLint に聞き(calculateConfigForFile)、当てるのも ESLint の no-restricted-imports そのもの(Linter)で、表をここに書き写さない。
//      別名は拡張子と index を省いた形も作り、どれか1つが当たれば落とす(ESLint は書いた形だけを見るので、どの形で書いても落ちるように)。
//      patterns に、取り出す名前や型だけかで分ける欄(importNames・allowTypeImports など)があると、先のファイルだけでは決まらないので落とす。
//      paths(バレル禁止の '.'・'..')はここでは見ない(書いた指定子の形の決まりで、向きではない)
// 規則 1〜3・6 では、型だけの import(import type・import { type X }・export type)は数えない。実行時に読み込まれないため(表示部品の props に型を使う)。
// 規則 7 では型だけの import も import() も数える。ESLint の no-restricted-imports が型だけの import も落とす(allowTypeImports を付けていない)ので同じにする。
// import() は ESLint の no-restricted-imports が見ないが、向きは書き方ではなく先のファイルで決まるので数える。
// import の読み方は scripts/read-imports.mjs(require('…') の呼び出しは ESLint が src の全部で落とすので集めない)。
// 指定子の解決は scripts/resolve-import.mjs で、tsconfig.json と同じ(@/ は src、@content/ は content、相対パス、拡張子と index の省略)。
// 規則 1〜6 のつながりの図と規則 5 の大域の名前には src の中のファイルだけを入れる。content のコードのファイルの import は規則 7 でだけ読み、
// src のファイルから content の中を指す import(@content/ と、content を指す相対パス)も規則 7 でだけ見る。
// src の中を指すのに解決できない import があれば、見逃しを避けるため落とす(content の中を指して見つからないものと、content のファイルの import で
// 見つからないものは型検査が落とすので、ここでは数えない)。
// 名指しした入口が実在しないときも落とす。src と content のコードのファイルに ESLint の設定が掛からない(lint の対象の外)ときも、規則 7 で見られないので落とす。
// ESLint の設定の基準のフォルダは、このファイルの場所から求めたリポジトリ直下にする(check-hook-rule.mjs と同じ。作業ツリーが親のリポジトリの
// .claude/ の下にあっても、作業ツリーのファイルが .claude/** に当たって無視されないように)。
//
// 見るのは git の追跡ではなく作業ツリー(check-test-boundary.mjs と同じ)。
// 判定の関数が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-layers.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint, Linter } from 'eslint'
import ts from 'typescript'
import {
  SCREEN_CONTAINER_DIRS,
  SHARED_CONTAINER_DIRS,
  TESTS_DIR,
  inTestsDir,
} from './container-dirs.mjs'
import { CONTAINER_ENTRY, isIoContainer } from './find-containers.mjs'
import { importsOf, parseSource } from './read-imports.mjs'
import {
  ALIAS_ROOTS,
  RESOLVE_SUFFIXES,
  basePathOf,
  findFile,
  resolveImport,
} from './resolve-import.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 読むフォルダ(統合テストもコンテナのフォルダに置くので src だけ。リポジトリ直下の __tests__/ は check-test-boundary.mjs が落とす)
const SCAN_DIRS = ['src']
// content のフォルダ。中のファイルは指定子の解決先になり、コードのファイルの import は規則 7 でだけ見る(規則 1〜6 の図と規則 5 には入れない)
const CONTENT_SCAN_DIR = 'content'
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
// import の要らない外の世界の入口(規則 5)。名前だけで触れる大域
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

// 画面のフォルダ → その画面のローダー(content を読んで画面のコンテナへ渡すサーバの入口。src/app/<名前>-screen.tsx)。
// 画面のコンテナを import してよいローダーは、この対の1つだけ。画面のフォルダは scripts/container-dirs.mjs の SCREEN_CONTAINER_DIRS と
// 同じでなければならず、ローダーは src/app/ の直下の <名前>-screen.tsx でなければならない(下の自己検査が見る。ほかの所を足して許しを広げない)
const SCREEN_LOADER_OF = new Map([
  ['src/components/VillagePage', 'src/app/village-screen.tsx'],
  ['src/components/Directory', 'src/app/directory-screen.tsx'],
  ['src/components/Story', 'src/app/story-screen.tsx'],
])
// ローダーの名前(src/app/ の直下の kebab-case の <名前>-screen.tsx)
const LOADER_NAME = /^src\/app\/[a-z0-9]+(?:-[a-z0-9]+)*-screen\.tsx$/
// content の読み出し(規則 6 で I/O コンテナとその hooks/ も届かない入口)
const CONTENT_DIR = 'src/lib/content/'
// import を読むファイル。それ以外(CSS など)は指定子の解決先としてだけ数える
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/
// テストの側(Vitest が拾う名前・フィクスチャ・テストの部品)。コンテナのフォルダの __tests__/ の中は名前を問わずテストの側
// (置ける名前は check-test-boundary.mjs が見る)
const TEST_SIDE = /\.test\.tsx?$|\.fixture\.ts$|\.test-helper\.ts$/
// 画面のコンテナを import してよい、画面のフォルダの下の統合テストとフィクスチャの名前
const INTEGRATION_TEST = /\.integration\.test\.tsx$/
const CONTAINER_FIXTURE = 'index.fixture.ts'
// 規則 7 で当てる ESLint の規則と、その設定を読んだ後の重さ(off は 0)
const RESTRICTED_IMPORTS = 'no-restricted-imports'
const OFF = 0
// 規則 7 が写せる patterns の欄。これ以外(importNames・allowImportNames・importNamePattern・allowImportNamePattern・allowTypeImports)は
// 取り出す名前や型だけかで判定が分かれ、import の先のファイルだけでは決まらない
const LAYER_PATTERN_KEYS = ['group', 'regex', 'message', 'caseSensitive']
// 規則 7 で指定子を ESLint に当てるときの、偽のファイルの名前(.mjs は ESLint が既定で import 文として読む)
const PROBE_FILE = 'check-layers-probe.mjs'

// 違反ごとに出す理由。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const REASON_IO =
  '表示部品と状態コンテナ(I/O コンテナの一覧の外の、フックを使う index.tsx)は外の世界(保存・天気・計測・SVG の取得・content の読み出し・メタデータ・村の時計のストア・next/navigation)に触れない。' +
  '間にフック・部品・utils を挟んでも同じ(上の道で届く)。その import を I/O コンテナ(scripts/container-dirs.mjs の一覧のフォルダの index.tsx)か、その隣の hooks/ へ上げ、値は props で受け取る。' +
  '型だけなら import type にする(ADR 0017 の D3・D4、ADR 0019・ADR 0024)'
const REASON_HOOKS =
  'I/O コンテナの隣の hooks/(コンテナの一覧 scripts/container-dirs.mjs のフォルダの直下の hooks/)は画面の状態・データのフックの置き場で、import してよいのは I/O コンテナとその hooks/ の中だけ' +
  '(今は外の世界に触れていないフックでも)。部品の UI のフックなら、その部品のフォルダの index.tsx を状態コンテナにして隣の hooks/ へ移す。画面の状態なら、I/O コンテナで呼んで値を props で受け取る(ADR 0017 の D3・D4、ADR 0019・ADR 0024)'
const REASON_SCREEN =
  '画面のコンテナ(画面の3つのフォルダの index.tsx)を import してよいのは、その画面のローダー(src/app/<名前>-screen.tsx。この検査の SCREEN_LOADER_OF)と、その画面のフォルダの下の統合テスト(*.integration.test.tsx)と、' +
  '画面のフォルダのフィクスチャ(index.tsx の隣か、そのフォルダの __tests__/ の直下の index.fixture.ts)だけ。ルートから画面を描くならローダーを指す。' +
  '画面の中の部品を別の所でも使うなら、その部品を表示部品として import する(ADR 0017 の D2、ADR 0022・ADR 0024)'
const REASON_MISSING =
  'コンテナの一覧(scripts/container-dirs.mjs)のフォルダに index.tsx が無いか、画面のローダー(この検査の SCREEN_LOADER_OF)が無い。改名・移動したなら、一覧・SCREEN_LOADER_OF と ADR を合わせて直す' +
  '(一覧が空振りすると、そのフォルダの hooks/ の許しだけが黙って残る)'
const REASON_GLOBAL =
  '表示部品と状態コンテナは、import の要らない外の世界の入口(fetch・localStorage・sessionStorage・indexedDB・XMLHttpRequest・WebSocket・EventSource・navigator.sendBeacon・document.cookie。' +
  'window.・globalThis.・self. を付けても同じ)にも触れない。src/lib/ の入口に置き、I/O コンテナ(一覧のフォルダの index.tsx)かその隣の hooks/ から呼んで、値は props で受け取る。' +
  '名前だけで見るので、同じ名前の変数や引数も数える。そのときは名前を変える(ADR 0017 の D3・D4、ADR 0019)'
const REASON_LOADER =
  'I/O コンテナとその隣の hooks/ も、content の読み出し(src/lib/content/)へは届かない(間に lib・utils を挟んでも同じ)。content を読むのは src/app の画面のローダー' +
  '(src/app/<名前>-screen.tsx)だけで、ローダーが読み出した値を直列化できる props にしてコンテナへ渡す。サーバのローダーを src/components の中へ戻さない' +
  '(統合テストはブラウザで描くので、content を読むファイルを測れない。ADR 0017 の D2・ADR 0024)'
const REASON_LOADERS =
  '画面のローダーの対(この検査の SCREEN_LOADER_OF)が、画面のフォルダの一覧(scripts/container-dirs.mjs の SCREEN_CONTAINER_DIRS)と合わないか、' +
  'ローダーが src/app/ の直下の <名前>-screen.tsx でないか、同じローダーを2つの画面に当てている。画面のコンテナを import してよい所を広げないため、対は画面ごとに src/app の1つだけにする(ADR 0024)'
// 規則 7 は、この後ろに ESLint の報告(当たった別名の指定子と、eslint.config.mjs の message)を付けて出す
const REASON_LAYER =
  'import の向き(utils ← lib ← hooks ← components ← app。content の実データを読むのは src/lib/content だけ)の正本は eslint.config.mjs の no-restricted-imports。' +
  'この検査は import の先のファイルを別名(@/…。content は @content/…)で書き直して同じ規則に掛けるので、相対パス・再 export・import()・型だけの import で書いても、' +
  '別名で書けば ESLint が落とすものは落ちる。指定子の書き方を変えて通すのではなく、ファイルの置き場所か import の向きを直す(docs/architecture/boundaries.md・ADR 0004)。ESLint の報告: '
const REASONS = new Map([
  ['io', REASON_IO],
  ['hooks', REASON_HOOKS],
  ['screen', REASON_SCREEN],
  ['missing', REASON_MISSING],
  ['global', REASON_GLOBAL],
  ['loader', REASON_LOADER],
  ['layer', REASON_LAYER],
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

// 指定子の解決(規則 1〜6 のつながりの図)。src の中のファイルはリポジトリ直下からのパス、入口のパッケージはその名前(前方一致)、
// それ以外のパッケージ・@content/・src の外は null(図に入れない)、その中を指すのに見つからなければ undefined
const resolveSpecifier = (from, specifier, files) => {
  if (specifier === undefined) return undefined
  const ioPackage = IO_PACKAGES.find(name => specifier.startsWith(name))
  if (ioPackage !== undefined) return ioPackage
  const base = basePathOf(from, specifier)
  if (base === null || !base.startsWith('src/')) return null
  return findFile(base, files)
}

// ファイルを指せる別名の指定子の全部(src/components/ui/Logo/index.tsx なら @/components/ui/Logo/index.tsx・@/components/ui/Logo/index・
// @/components/ui/Logo)。拡張子と index を省く形は、解決のときに足す並び(RESOLVE_SUFFIXES)と同じものを外して作る。
// 並びは長い形(拡張子を付けたまま)から短い形へ
const aliasFormsOf = file => {
  const [root, alias] = ALIAS_ROOTS.find(([prefix]) => file.startsWith(prefix))
  const rest = file.slice(root.length)
  const suffixes = RESOLVE_SUFFIXES.filter(
    suffix => rest.endsWith(suffix) && rest.length > suffix.length
  )
  return suffixes.map(suffix => `${alias}${rest.slice(0, rest.length - suffix.length)}`)
}

// ESLint の設定を読んだ後のファイルの組みから、no-restricted-imports の patterns を取り出す。
// lint の対象の外(設定が無い)は undefined、規則が off か paths だけ(文字列の配列・name の組みの配列)なら空
const layerPatternsOf = config => {
  if (config === undefined) return undefined
  const [severity, options] = config.rules?.[RESTRICTED_IMPORTS] ?? [OFF]
  if (severity === OFF || options === null || typeof options !== 'object') return []
  return options.patterns ?? []
}

// patterns のうち、規則 7 が写せない欄の名前(重ならず並べたもの)。文字列の pattern は group と同じなので写せる
const unsupportedKeysOf = patterns => {
  const objects = patterns.filter(pattern => typeof pattern !== 'string')
  const keys = objects.flatMap(pattern => Object.keys(pattern))
  return [...new Set(keys.filter(key => !LAYER_PATTERN_KEYS.includes(key)))].sort()
}

// 別名の指定子を、ESLint の no-restricted-imports そのものに patterns だけを掛けて判定する。
// 指定子ごとに import の1行を並べた断片を Linter に掛け、報告の出た行の指定子 → 最初の報告の文面を返す
const linter = new Linter({ cwd: ROOT })
const restrictedFormsOf = (patterns, forms) => {
  const code = forms.map(form => `import ${JSON.stringify(form)}`).join('\n')
  const rules = { [RESTRICTED_IMPORTS]: ['error', { patterns }] }
  const config = [{ files: [`**/${PROBE_FILE}`], rules }]
  const messages = linter.verify(code, config, { filename: path.join(ROOT, PROBE_FILE) })
  // 読めない断片(構文の誤り)や、ほかの規則の報告があれば、判定を信じられない
  const unexpected = messages.find(
    message => message.fatal === true || message.ruleId !== RESTRICTED_IMPORTS
  )
  if (unexpected !== undefined) {
    throw new Error(`check-layers: 規則 7 の断片を ESLint が判定できない(${unexpected.message})`)
  }
  const reports = new Map()
  for (const { line, message } of messages) {
    if (!reports.has(forms[line - 1])) reports.set(forms[line - 1], message)
  }
  return reports
}

// 規則 7。layerTargets: パス → import の先(規則 7 で見るもの)、patternsOf: パス → そのファイルに ESLint が掛ける patterns。
// 同じ patterns のファイル(同じ層)はまとめて、ESLint に1回で聞く。import の先の別名のどれか1つでも当たれば落とす
const layerViolationsOf = (layerTargets, patternsOf) => {
  const formsByPatterns = new Map()
  for (const [file, targets] of layerTargets) {
    const patterns = patternsOf.get(file) ?? []
    if (patterns.length === 0) continue
    const key = JSON.stringify(patterns)
    const forms = formsByPatterns.get(key)?.forms ?? new Set()
    for (const target of targets) {
      for (const form of aliasFormsOf(target)) forms.add(form)
    }
    formsByPatterns.set(key, { patterns, forms })
  }
  const reportsByPatterns = new Map()
  for (const [key, { patterns, forms }] of formsByPatterns) {
    reportsByPatterns.set(key, restrictedFormsOf(patterns, [...forms]))
  }
  return [...layerTargets].flatMap(([file, targets]) => {
    const reports = reportsByPatterns.get(JSON.stringify(patternsOf.get(file) ?? []))
    if (reports === undefined) return []
    return targets.flatMap(target => {
      // 出す指定子は短い形(拡張子と index を省いた形)から選ぶ。落とすかどうかは、どの形が当たっても同じ
      const form = [...aliasFormsOf(target)].reverse().find(candidate => reports.has(candidate))
      if (form === undefined) return []
      return [{ rule: 'layer', file, target, message: reports.get(form) }]
    })
  })
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

// 1 ファイルが式の中で使う、import の要らない外の世界の入口を { name, line } で返す(規則 5)
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
// dirs: I/O コンテナを置くフォルダの一覧(screenDirs は画面、sharedDirs は横断部品)と、画面のフォルダ → ローダー(loaders)。
// layers: content のファイル(contentFiles。files と同じ形のパス → 中身。指定子の解決先になり、コードのファイルの import は規則 7 でだけ見る)と、
// パス → そのファイルに ESLint が掛ける patterns(patternsOf。規則 7)。
// 返すのは違反の一覧と、解決できなかった import の一覧と、ESLint の設定が掛からず規則 7 で見られないファイル(src と content のコードのファイル)の一覧
const checkLayers = (files, { screenDirs, sharedDirs, loaders }, { contentFiles, patternsOf }) => {
  // 実行時の import だけを辺にする(型だけの import は数えない)。大域の入口もここで集める。
  // 規則 7 の import の先は、型だけのものも import() も、content の中も集める(図とは別に持つ)
  const edges = new Map()
  const globals = new Map()
  const layerTargets = new Map()
  const unresolved = []
  const unlinted = []
  const known = new Set([...files.keys(), ...contentFiles.keys()])
  // 規則 7 で見る import の先(src か content の中のファイル)。見つからないもの・その外は数えない
  const layerTargetsOf = (file, imports) => {
    const found = imports.map(({ specifier }) => resolveImport(file, specifier, known))
    return [...new Set(found.filter(target => typeof target === 'string'))].sort()
  }
  for (const [file, code] of files) {
    if (code === undefined) continue
    const source = parseSource(file, code)
    const imports = importsOf(source)
    const targets = new Set()
    for (const { specifier, typeOnly } of imports) {
      const target = resolveSpecifier(file, specifier, files)
      if (target === undefined)
        unresolved.push({ file, specifier: specifier ?? '(式で組んだ指定子)' })
      else if (target !== null && !typeOnly) targets.add(target)
    }
    edges.set(file, [...targets].sort())
    globals.set(file, globalIoOf(source))
    layerTargets.set(file, layerTargetsOf(file, imports))
    if (patternsOf.get(file) === undefined) unlinted.push(file)
  }
  // content のコードのファイルは規則 7 でだけ見る(つながりの図・大域の名前には入れない。content から src を相対パスで指す向きもここで落ちる)
  for (const [file, code] of contentFiles) {
    if (code === undefined) continue
    layerTargets.set(file, layerTargetsOf(file, importsOf(parseSource(file, code))))
    if (patternsOf.get(file) === undefined) unlinted.push(file)
  }

  const containerDirs = [...screenDirs, ...sharedDirs]
  // I/O コンテナ(一覧の外のコンテナは状態コンテナで、ここには数えず表示部品と同じに見る)
  const isContainer = file => isIoContainer(file, containerDirs)
  const inContainerHooks = file => containerDirs.some(dir => file.startsWith(`${dir}/hooks/`))
  const isAllowed = file =>
    isContainer(file) ||
    inContainerHooks(file) ||
    file.startsWith('src/app/') ||
    file.startsWith('src/lib/') ||
    inTestsDir(file) ||
    TEST_SIDE.test(file)
  // 画面のコンテナ → それを import してよいファイルか(その画面のローダーと、画面のフォルダの下の統合テストと、
  // 画面のフォルダの index.tsx の隣か __tests__/ の直下のフィクスチャ)
  const screenOwners = new Map(
    screenDirs.map(dir => [
      `${dir}/${CONTAINER_ENTRY}`,
      file =>
        file === loaders.get(dir) ||
        file === `${dir}/${CONTAINER_FIXTURE}` ||
        file === `${dir}/${TESTS_DIR}/${CONTAINER_FIXTURE}` ||
        (file.startsWith(`${dir}/`) && INTEGRATION_TEST.test(file)),
    ])
  )

  // 入口から import を逆向きにたどり、染まったファイルごとに入口へ1歩近づく先を覚える(入口は null)。
  // 幅優先なので、覚えた先をたどると入口への一番短い道になる。I/O コンテナからは先へ伝えない
  const importers = new Map()
  for (const [file, targets] of edges) {
    for (const target of targets) importers.set(target, [...(importers.get(target) ?? []), file])
  }
  const nodes = [...new Set([...files.keys(), ...importers.keys()])].sort()
  const taintFrom = isSeed => {
    const toward = new Map(nodes.filter(isSeed).map(node => [node, null]))
    const queue = [...toward.keys()]
    while (queue.length > 0) {
      const node = queue.shift()
      if (isContainer(node)) continue
      for (const importer of importers.get(node) ?? []) {
        if (toward.has(importer)) continue
        toward.set(importer, node)
        queue.push(importer)
      }
    }
    return toward
  }
  // 外の世界の入口のどれかへ届くファイル(規則 1)と、content の読み出しへ届くファイル(規則 6)
  const towardIo = taintFrom(isIo)
  const towardContent = taintFrom(node => node.startsWith(CONTENT_DIR))
  const chainOf = (toward, node) =>
    node === null ? [] : [node, ...chainOf(toward, toward.get(node))]

  const violations = []
  for (const [file, targets] of edges) {
    for (const target of targets) {
      const mayImport = screenOwners.get(target)
      if (mayImport !== undefined && !mayImport(file)) {
        violations.push({ rule: 'screen', file, target })
      }
    }
    if (isContainer(file) || inContainerHooks(file)) {
      const target = towardContent.get(file)
      if (target !== undefined) {
        violations.push({ rule: 'loader', file, target, chain: chainOf(towardContent, target) })
      }
    }
    if (isAllowed(file)) continue
    for (const target of targets) {
      if (towardIo.has(target) && !isContainer(target)) {
        violations.push({ rule: 'io', file, target, chain: chainOf(towardIo, target) })
      } else if (inContainerHooks(target)) {
        violations.push({ rule: 'hooks', file, target })
      }
    }
    for (const { name, line } of globals.get(file)) {
      violations.push({ rule: 'global', file, target: name, line })
    }
  }
  for (const dir of containerDirs) {
    if (!files.has(`${dir}/${CONTAINER_ENTRY}`))
      violations.push({ rule: 'missing', file: `${dir}/${CONTAINER_ENTRY}` })
  }
  for (const dir of screenDirs) {
    const loader = loaders.get(dir)
    if (loader !== undefined && !files.has(loader))
      violations.push({ rule: 'missing', file: loader })
  }
  violations.push(...layerViolationsOf(layerTargets, patternsOf))
  return {
    violations,
    unresolved,
    unlinted,
    edgeCount: [...edges.values()].flat().length,
    layerCount: [...layerTargets.values()].flat().length,
  }
}

// 画面のローダーの対が、画面のフォルダの一覧と同じフォルダを持ち、ローダーが src/app/<名前>-screen.tsx で重ならないか(合えば undefined)
const loadersViolationOf = (loaders, screenDirs) => {
  const sameDirs =
    JSON.stringify([...loaders.keys()].sort()) === JSON.stringify([...screenDirs].sort())
  const values = [...loaders.values()]
  const named = values.every(loader => LOADER_NAME.test(loader))
  const distinct = new Set(values).size === values.length
  return sameDirs && named && distinct ? undefined : REASON_LOADERS
}

// 違反を1行の文字列にする(自己検査の照合と出力で同じ形を使う)
const formatViolation = ({ rule, file, target, chain, line }) => {
  if (rule === 'io' || rule === 'loader') return `${file} → ${target}(届く道: ${chain.join(' → ')})`
  if (rule === 'global') return `${file}:${line} ${target}`
  if (rule === 'missing') return file
  return `${file} → ${target}`
}
// 自己検査で照合する形。同じ形の行(hooks と screen)を取り違えないよう、規則の名前を前に付ける
const keyOf = violation => `${violation.rule} ${formatViolation(violation)}`

// ESLint の設定(基準のフォルダはリポジトリ直下)。規則 7 の patterns を、ファイルごとに ESLint に聞く
const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: path.join(ROOT, 'eslint.config.mjs') })
// パス → そのファイルに ESLint が掛ける patterns(import を読むファイルだけ。lint の対象の外は undefined)。
// 掛かるかはパスだけで決まるので、偽のパスでもよい。files はパス → 中身の組みの並び(src と content を続けて渡す)
const patternsAt = async file => layerPatternsOf(await eslint.calculateConfigForFile(file))
const patternsFor = async files => {
  const paths = [...files].filter(([, code]) => code !== undefined).map(([file]) => file)
  return new Map(await Promise.all(paths.map(async file => [file, await patternsAt(file)])))
}

// ---- 自己検査 ----
// 型だけの判定・指定子の解決・許す側の判定・染まりのたどり方・大域の名前の判定・ESLint の patterns への当て方が壊れると、
// 違反を見逃したまま「違反なし」で通る。そこで違反と分かっているファイルと違反でないファイルを並べた偽の src と content を、実際の検査と同じ関数で
// メモリの上で判定し、違反の一覧(道を含む)が期待とぴったり同じでなければ落とす。コンテナの一覧とローダーの対も偽のものを渡す
// (Gone は index.tsx もローダーも無い。Reader は content を読む I/O コンテナ)。
// 規則 7 の patterns は、偽のファイルにも本物の eslint.config.mjs から聞く(向きの正本を写さないため。eslint.config.mjs の向きを変えたら、下の期待も直す)
const FAKE_DIRS = {
  screenDirs: ['src/components/Screen', 'src/components/Gone'],
  sharedDirs: ['src/components/ui/Player', 'src/components/ui/Reader'],
  loaders: new Map([
    ['src/components/Screen', 'src/app/fake-screen.tsx'],
    ['src/components/Gone', 'src/app/gone-screen.tsx'],
  ]),
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
    'src/lib/text.ts': `import { readContent } from './content/read'\nexport const text = readContent`,
    'src/utils/clamp.ts': 'export const clamp = () => 0',
    // 画面: ローダー(src/app)・コンテナ(index.tsx)・隣の hooks(下のフォルダも)・テストの側は通る。大域の入口に触れても通る
    'src/app/fake-screen.tsx': [
      `import { readContent } from '@/lib/content/read'`,
      `import Container from '@/components/Screen'`,
      `const cookie = document.cookie`,
    ].join('\n'),
    'src/components/Screen/index.tsx': [
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
    // 画面のフォルダの下の統合テスト(子のコンテナのものも)・画面のフォルダのフィクスチャ(index.tsx の隣と __tests__/ の直下)は、
    // 画面のコンテナを描いてよい。__tests__/ の中は名前を問わずテストの側で、入口・I/O コンテナの隣の hooks/・大域の入口に触れても通る
    'src/components/Screen/__tests__/open.integration.test.tsx': [
      `import { readTheme } from '@/lib/preferences'`,
      `import { useUiOnly } from '../hooks/use-ui-only'`,
      `import Screen from '@/components/Screen'`,
      `import { stepFrame } from './screen.test-helper'`,
      `globalThis.fetch = () => 0`,
    ].join('\n'),
    'src/components/Screen/components/Panel/index.integration.test.tsx': `import Screen from '@/components/Screen'`,
    'src/components/Screen/__tests__/index.fixture.ts': `import { readContent } from '@/lib/content/read'\nimport Screen from '@/components/Screen'`,
    'src/components/Screen/index.fixture.ts': `import { readContent } from '@/lib/content/read'\nimport Screen from './index'`,
    'src/components/Screen/__tests__/screen.test-helper.ts': `import { readTheme } from '@/lib/preferences'\nexport const stepFrame = () => sessionStorage`,
    'src/components/Screen/__tests__/data.ts': `import { readTheme } from '@/lib/preferences'\nexport const store = localStorage`,
    'src/components/Screen/screen.test-helper.ts': `import { readTheme } from '@/lib/preferences'\nconst store = sessionStorage`,
    // もとの名前の統合テストと、画面のフォルダの下でも統合テストと画面のフォルダのフィクスチャでないもの(部品・子のフォルダのフィクスチャ・
    // *.integration.test.ts)・ほかのフォルダ・名前の前の方が同じだけの別のフォルダは、テストの側でも画面のコンテナを描かない
    'src/components/Screen/container.browser.test.tsx': [
      `import { readTheme } from '@/lib/preferences'`,
      `import { useUiOnly } from './hooks/use-ui-only'`,
      `import Screen from './index'`,
      `globalThis.fetch = () => 0`,
    ].join('\n'),
    'src/components/Screen/__tests__/render.test-helper.ts': `import Screen from '../index'`,
    'src/components/Screen/components/Panel/index.fixture.ts': `import Screen from '../../index'`,
    'src/components/Screen/components/Panel/__tests__/index.fixture.ts': `import Screen from '../../../index'`,
    'src/components/Screen/__tests__/open.integration.test.ts': `import Screen from '@/components/Screen'`,
    'src/components/Gone/__tests__/open.integration.test.tsx': `import Screen from '@/components/Screen'`,
    'src/components/ScreenX/__tests__/open.integration.test.tsx': `import Screen from '../../Screen'`,
    'src/components/Screen/utils/build.test.ts': `import { parse } from '@/lib/content/parse'`,
    // ルートはローダーを指す(画面のコンテナは型だけなら指してよい)。src/app は大域の入口に触れても通る
    'src/app/page.tsx': [
      `import Screen from '@/app/fake-screen'`,
      `import { buildMetadata } from '@/lib/metadata'`,
      `import type Container from '@/components/Screen'`,
      `const socket = new WebSocket('ws://a')`,
    ].join('\n'),
    // 表示部品で通るもの: 型だけの import・注釈の中・純粋な lib と utils・自分の UI のフック・横断部品のコンテナ
    'src/components/Screen/components/Body/index.tsx': [
      `import type { Theme } from '@/lib/preferences'`,
      `import { type Precipitation } from '@/lib/weather'`,
      `import type { UiOnly } from '../../hooks/use-ui-only'`,
      `import type Container from '../../index'`,
      `// import { readTheme } from '@/lib/preferences'`,
      `/* import { fetchWeather } from '@/lib/weather' */`,
      `import Link from 'next/link'`,
      `import { grid } from '@/lib/village/grid'`,
      `import { clamp } from '../../../../utils/clamp'`,
      `import { useBody } from './hooks/use-body'`,
      `import Player from '@/components/ui/Player'`,
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
    // 横断部品のコンテナ(フォルダの index.tsx)。染まっているが、表示部品が描いてよい。その下の表示部品は入口に触れない
    'src/components/ui/Player/index.tsx': `import { useSources } from './hooks/use-sources'\nimport Stack from './components/Stack'`,
    'src/components/ui/Player/hooks/use-sources.ts': `import { fetchSvgSource } from '@/lib/fetch-svg-source'`,
    'src/components/ui/Player/components/Stack/index.tsx': `import { readTheme } from '@/lib/preferences'\nexport default function Stack() {}`,
    // content を読む I/O コンテナとその hooks/(サーバのローダーを src/components の中へ戻した形)。lib を挟んでも落ちる。
    // 外の世界のほかの入口は I/O コンテナが読んでよい
    'src/components/ui/Reader/index.tsx': `import { readContent } from '@/lib/content/read'\nimport { readTheme } from '@/lib/preferences'`,
    'src/components/ui/Reader/hooks/use-text.ts': `import { text } from '@/lib/text'`,
    'src/components/ui/Reader/hooks/use-theme-label.ts': `import { label } from '@/lib/theme-label'`,
    // 一覧の外のコンテナ(フックを使う index.tsx)は状態コンテナで、import の制限は表示部品と同じ
    'src/components/Screen/components/Card/index.tsx': `import { readTheme } from '@/lib/preferences'\nexport const load = () => fetch('/a')`,
    'src/components/Screen/components/Deck/index.tsx': `import Card from '../Card'\nimport { readContent } from '@/lib/content/read'`,
    // 状態コンテナで通るもの: 自分の隣の hooks/ の UI のフック・横断部品の I/O コンテナ・表示部品
    'src/components/Screen/components/Panel/index.tsx': [
      `import { usePanel } from './hooks/use-panel'`,
      `import Player from '@/components/ui/Player'`,
      `import Body from '../Body'`,
    ].join('\n'),
    'src/components/Screen/components/Panel/hooks/use-panel.ts': `import { useId } from 'react'`,
    // 状態コンテナで落ちるもの: 隣の hooks/ を挟んで入口へ届く(状態コンテナは染まりを先へ伝える)・I/O コンテナの隣の hooks/
    'src/components/Screen/components/Saved/index.tsx': `import { useSaved } from './hooks/use-saved'`,
    'src/components/Screen/components/Saved/hooks/use-saved.ts': `import { readTheme } from '@/lib/preferences'`,
    'src/components/Screen/components/Wrap/index.tsx': `import Saved from '../Saved'`,
    'src/components/Screen/components/Peek/index.tsx': `import { useUiOnly } from '../../hooks/use-ui-only'`,
    // どの I/O コンテナの下にも無い状態コンテナも、I/O の許しを受けない(隣の hooks/ も同じ)。
    // そのフォルダの統合テストはテストの側で通るが、画面のコンテナは描かない
    'src/components/ui/Logo/index.tsx': `import { useLogo } from './hooks/use-logo'\nexport const load = () => fetch('/a')`,
    'src/components/ui/Logo/hooks/use-logo.ts': `import { readTheme } from '@/lib/preferences'`,
    'src/components/Foo/components/Bar/index.tsx': `import { usePathname } from 'next/navigation'`,
    'src/components/ui/Logo/__tests__/show.integration.test.tsx': `import Logo from '@/components/ui/Logo'\nimport { readTheme } from '@/lib/preferences'`,
    'src/components/ui/Logo/__tests__/screen.integration.test.tsx': `import Screen from '@/components/Screen'`,
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
    'src/components/Bad/via-loader.tsx': `import Screen from '@/app/fake-screen'`,
    'src/components/Bad/screen-hook.tsx': `import { useUiOnly } from '@/components/Screen/hooks/use-ui-only'`,
    'src/components/Bad/screen-io-hook.tsx': `import { useWeather } from '../Screen/hooks/use-weather/use-weather'`,
    'src/components/Bad/index.tsx': `import { readContent } from '@/lib/content/read'`,
    'src/components/Bad/hooks/use-bad.ts': `import { fetchWeather } from '@/lib/weather'`,
    'src/components/Screen/components/Deep/hooks/use-deep.ts': `import { readTheme } from '@/lib/preferences'`,
    'src/utils/bad.ts': `import { readTheme } from '@/lib/preferences'`,
    // テストの側(__tests__/ の中)も、入口へ届けば染まりを伝える(表示部品が隣の __tests__/ の中のものを import すると落ちる)
    'src/components/Bad/test-data.tsx': `import { store } from '../Screen/__tests__/data'`,
    // 画面のコンテナを、そのローダー・統合テスト・フィクスチャの外から import する(許す側でも・ほかの画面のローダーでも落ちる)
    'src/components/Bad/screen-container.tsx': `import Screen from '@/components/Screen'`,
    'src/components/Bad/container.browser.test.tsx': `import Screen from '../Screen'`,
    'src/app/direct.tsx': `import Screen from '@/components/Screen/index'`,
    'src/app/other-screen.tsx': `import Screen from '@/components/Screen'`,
    // 大域の入口に触れる表示部品
    'src/components/Bad/global.tsx': GLOBAL_CASES.map(([line]) => line).join('\n'),
    'src/hooks/use-socket.ts': `export const useSocket = () => new WebSocket('ws://a')`,
    // 規則 7(import の向き)で落ちるもの: lib から components へ(別名・相対パス・再 export・型だけの相対パス・import() の相対パスのどれでも)、
    // utils から lib へ(相対パス)、content の外の lib から content の実データへ(相対パス)。
    // 上の src/utils/bad.ts(utils から lib)と src/components/Bad/via-loader.tsx(components から app)も、別名のまま規則 7 に掛かる
    'src/lib/layer/alias.ts': `import Logo from '@/components/ui/Logo'`,
    'src/lib/layer/relative.ts': `import Logo from '../../components/ui/Logo'`,
    'src/lib/layer/reexport.ts': `export { default as Logo } from '../../components/ui/Logo'`,
    'src/lib/layer/type-relative.ts': `import type Logo from '../../components/ui/Logo'`,
    'src/lib/layer/dynamic.ts': `export const load = () => import('../../components/ui/Logo')`,
    'src/utils/layer-relative.ts': `import { grid } from '../lib/village/grid'`,
    'src/lib/layer/content-data.ts': `import { profile } from '../../../content/ja/profile'`,
    // 規則 7 で通るもの: components から lib・utils へ、lib から utils へ(相対パス)、どこからでも content/types へ(相対パス。型だけでなくても)、
    // src/lib/content から content の実データへ(相対パスと別名)
    'src/components/Layer/index.tsx': [
      `import { grid } from '../../lib/village/grid'`,
      `import { clamp } from '../../utils/clamp'`,
      `import type { Locale } from '../../../content/types/content'`,
    ].join('\n'),
    'src/lib/layer/pure.ts': `import { clamp } from '../../utils/clamp'\nimport { LOCALES } from '../../../content/types/content'`,
    'src/utils/layer-types.ts': `export type { Locale } from '../../content/types/content'`,
    'src/hooks/use-layer.ts': `import type { Locale } from '../../content/types/content'`,
    'src/app/layer.tsx': `import { LOCALES } from '../../content/types/content'`,
    'src/lib/content/layer.ts': `import { profile } from '../../../content/ja/profile'\nimport { world } from '@content/world'`,
  })
)
// 偽の content のファイル(パス → 中身。実データ・型と、src の指定子の解決先)。content のコードのファイルは規則 7 でだけ見る:
// src を相対パスで指すと落ち(bad.ts・via-src.ts)、content/types を指すのは型だけでも通る(ok.ts)。規則 1〜6 の図と規則 5 には入れないので、
// 入口を import しても大域の入口に触れても、規則 7 のほかでは数えない(図に入れると via-src.ts が規則 1 でも、world.ts が規則 5 でも落ちる)
const FAKE_CONTENT = new Map(
  Object.entries({
    'content/ja/profile.ts': 'export const profile = {}',
    'content/world.ts': 'export const world = () => localStorage',
    'content/types/content.ts': `export type Work = { id: string }\nexport const LOCALES = ['ja']`,
    'content/ja/bad.ts': `import { clamp } from '../../src/utils/clamp'`,
    'content/ja/ok.ts': `import type { Work } from '../types/content'`,
    'content/ko/via-src.ts': `import { readTheme } from '../../src/lib/preferences'`,
    'content/README.md': undefined,
  })
)
const io = (file, ...chain) => keyOf({ rule: 'io', file, target: chain[0], chain })
const loader = (file, ...chain) => keyOf({ rule: 'loader', file, target: chain[0], chain })
const hooks = (file, target) => keyOf({ rule: 'hooks', file, target })
const screen = (file, target) => keyOf({ rule: 'screen', file, target })
const globalIo = (file, line, target) => keyOf({ rule: 'global', file, target, line })
const missingAt = file => keyOf({ rule: 'missing', file })
const layered = (file, target) => keyOf({ rule: 'layer', file, target })
const PREFERENCES = 'src/lib/preferences.ts'
const CONTENT_READ = 'src/lib/content/read.ts'
const CONTENT_PARSE = 'src/lib/content/parse.ts'
const SCREEN_CONTAINER = 'src/components/Screen/index.tsx'
const CARD_CONTAINER = 'src/components/Screen/components/Card/index.tsx'
const SAVED_CONTAINER = 'src/components/Screen/components/Saved/index.tsx'
const SAVED_HOOK = 'src/components/Screen/components/Saved/hooks/use-saved.ts'
const LOGO_CONTAINER = 'src/components/ui/Logo/index.tsx'
const LOGO_HOOK = 'src/components/ui/Logo/hooks/use-logo.ts'
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
  io('src/components/Bad/content.tsx', CONTENT_PARSE),
  io('src/components/Bad/metadata.ts', 'src/lib/metadata.ts'),
  io('src/components/Bad/store.tsx', 'src/components/VillagePage/hooks/use-village-time.ts'),
  io('src/components/Bad/via-lib.tsx', 'src/lib/theme-label.ts', PREFERENCES),
  io('src/components/Bad/via-hook.tsx', 'src/hooks/use-theme.ts', PREFERENCES),
  io('src/hooks/use-theme.ts', PREFERENCES),
  io('src/components/Bad/via-sibling.tsx', 'src/components/Bad/direct.tsx', PREFERENCES),
  io('src/components/Bad/via-loader.tsx', 'src/app/fake-screen.tsx', CONTENT_READ),
  hooks('src/components/Bad/screen-hook.tsx', 'src/components/Screen/hooks/use-ui-only.ts'),
  io(
    'src/components/Bad/screen-io-hook.tsx',
    'src/components/Screen/hooks/use-weather/use-weather.ts',
    'src/lib/weather.ts'
  ),
  io('src/components/Bad/index.tsx', CONTENT_READ),
  io('src/components/Bad/hooks/use-bad.ts', 'src/lib/weather.ts'),
  io('src/components/Screen/components/Deep/hooks/use-deep.ts', PREFERENCES),
  io('src/utils/bad.ts', PREFERENCES),
  io('src/components/Bad/test-data.tsx', 'src/components/Screen/__tests__/data.ts', PREFERENCES),
  io('src/components/ui/Player/components/Stack/index.tsx', PREFERENCES),
  loader('src/components/ui/Reader/index.tsx', CONTENT_READ),
  loader('src/components/ui/Reader/hooks/use-text.ts', 'src/lib/text.ts', CONTENT_READ),
  io(CARD_CONTAINER, PREFERENCES),
  globalIo(CARD_CONTAINER, 2, 'fetch'),
  io('src/components/Screen/components/Deck/index.tsx', CARD_CONTAINER, PREFERENCES),
  io('src/components/Screen/components/Deck/index.tsx', CONTENT_READ),
  io(SAVED_HOOK, PREFERENCES),
  io(SAVED_CONTAINER, SAVED_HOOK, PREFERENCES),
  io('src/components/Screen/components/Wrap/index.tsx', SAVED_CONTAINER, SAVED_HOOK, PREFERENCES),
  hooks(
    'src/components/Screen/components/Peek/index.tsx',
    'src/components/Screen/hooks/use-ui-only.ts'
  ),
  io(LOGO_HOOK, PREFERENCES),
  io(LOGO_CONTAINER, LOGO_HOOK, PREFERENCES),
  globalIo(LOGO_CONTAINER, 2, 'fetch'),
  io('src/components/Foo/components/Bar/index.tsx', 'next/navigation'),
  screen('src/components/ui/Logo/__tests__/screen.integration.test.tsx', SCREEN_CONTAINER),
  missingAt('src/components/Gone/index.tsx'),
  missingAt('src/app/gone-screen.tsx'),
  screen('src/components/Bad/screen-container.tsx', SCREEN_CONTAINER),
  screen('src/components/Bad/container.browser.test.tsx', SCREEN_CONTAINER),
  screen('src/app/direct.tsx', SCREEN_CONTAINER),
  screen('src/app/other-screen.tsx', SCREEN_CONTAINER),
  screen('src/components/Screen/container.browser.test.tsx', SCREEN_CONTAINER),
  screen('src/components/Screen/__tests__/render.test-helper.ts', SCREEN_CONTAINER),
  screen('src/components/Screen/components/Panel/index.fixture.ts', SCREEN_CONTAINER),
  screen('src/components/Screen/components/Panel/__tests__/index.fixture.ts', SCREEN_CONTAINER),
  screen('src/components/Screen/__tests__/open.integration.test.ts', SCREEN_CONTAINER),
  screen('src/components/Gone/__tests__/open.integration.test.tsx', SCREEN_CONTAINER),
  screen('src/components/ScreenX/__tests__/open.integration.test.tsx', SCREEN_CONTAINER),
  ...GLOBAL_CASES.map(([, name], index) =>
    globalIo('src/components/Bad/global.tsx', index + 1, name)
  ),
  globalIo('src/hooks/use-socket.ts', 1, 'WebSocket'),
  layered('src/lib/layer/alias.ts', LOGO_CONTAINER),
  layered('src/lib/layer/relative.ts', LOGO_CONTAINER),
  layered('src/lib/layer/reexport.ts', LOGO_CONTAINER),
  layered('src/lib/layer/type-relative.ts', LOGO_CONTAINER),
  layered('src/lib/layer/dynamic.ts', LOGO_CONTAINER),
  layered('src/utils/layer-relative.ts', 'src/lib/village/grid.ts'),
  layered('src/lib/layer/content-data.ts', 'content/ja/profile.ts'),
  layered('src/utils/bad.ts', PREFERENCES),
  layered('src/components/Bad/via-loader.tsx', 'src/app/fake-screen.tsx'),
  layered('content/ja/bad.ts', 'src/utils/clamp.ts'),
  layered('content/ko/via-src.ts', PREFERENCES),
].sort()
// [ローダーの対, 画面のフォルダ, 期待する理由]。画面のフォルダが足りない・余る・ローダーが src/app の <名前>-screen.tsx でない・重なるのは落ちる
const SCREEN_DIRS = ['src/components/A', 'src/components/B']
const LOADER_CASES = [
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/app/b-page-screen.tsx'],
    ]),
    SCREEN_DIRS,
    undefined,
  ],
  [new Map([['src/components/A', 'src/app/a-screen.tsx']]), SCREEN_DIRS, REASON_LOADERS],
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/app/b-screen.tsx'],
      ['src/components/C', 'src/app/c-screen.tsx'],
    ]),
    SCREEN_DIRS,
    REASON_LOADERS,
  ],
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/components/B/loader-screen.tsx'],
    ]),
    SCREEN_DIRS,
    REASON_LOADERS,
  ],
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/app/x/b-screen.tsx'],
    ]),
    SCREEN_DIRS,
    REASON_LOADERS,
  ],
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/app/b.tsx'],
    ]),
    SCREEN_DIRS,
    REASON_LOADERS,
  ],
  [
    new Map([
      ['src/components/A', 'src/app/a-screen.tsx'],
      ['src/components/B', 'src/app/a-screen.tsx'],
    ]),
    SCREEN_DIRS,
    REASON_LOADERS,
  ],
]
// 解決できない import は、見逃さないよう違反とは別に必ず拾う
const FAKE_UNRESOLVED = new Map(
  Object.entries({
    'src/components/A/index.tsx': `import Gone from './gone'\nimport { lost } from '@/lib/lost'\nconst load = name => import(name)`,
    'src/components/A/b.tsx': `import Link from 'next/link'\nimport type { Locale } from '@content/types/content'`,
    'src/components/A/__tests__/b.integration.test.tsx': `import { page } from 'vitest/browser'\nimport { step } from './gone.test-helper'\nimport A from '../gone'`,
  })
)
const EXPECTED_UNRESOLVED = [
  'src/components/A/index.tsx ./gone',
  'src/components/A/index.tsx @/lib/lost',
  'src/components/A/index.tsx (式で組んだ指定子)',
  'src/components/A/__tests__/b.integration.test.tsx ./gone.test-helper',
  'src/components/A/__tests__/b.integration.test.tsx ../gone',
]
// ESLint の設定が掛からないファイルの拾い方。上の偽の src と、content のコードのファイル1つとコードでないファイル1つに patterns を1つも渡さない
// (全部が lint の対象の外と同じ)ので、src と content のコードのファイルが全部並ぶ
const FAKE_UNLINTED_CONTENT = new Map([
  ['content/ja/lost.ts', 'export const lost = 0'],
  ['content/README.md', undefined],
])
const EXPECTED_UNLINTED = [...FAKE_UNRESOLVED.keys(), 'content/ja/lost.ts'].sort()
// lint の対象の外のパス(eslint.config.mjs の ignores の .claude/** の下。作業ツリーを .claude/ の下に置いた形)。ESLint が設定を返さない
// (patternsAt が undefined)ことを確かめる。空の patterns を返すようになると、lint の対象の外のファイルが規則 7 の外へ黙って抜ける
const IGNORED_PATHS = [
  '.claude/worktrees/fake/src/utils/bad.ts',
  '.claude/worktrees/fake/content/ja/bad.ts',
]

// 規則 7 が写せない欄の判定。文字列の pattern と group・regex・message・caseSensitive は写せ、ほかの欄は名前を返す
const UNSUPPORTED_PATTERNS = [
  '@/a/**',
  { group: ['@/b/**'], message: 'b', caseSensitive: true },
  { regex: '^@/c/', importNames: ['c'] },
  { group: ['@/d/**'], allowTypeImports: true, importNames: ['d'] },
]
const EXPECTED_UNSUPPORTED = ['allowTypeImports', 'importNames']

const fake = checkLayers(FAKE_SRC, FAKE_DIRS, {
  contentFiles: FAKE_CONTENT,
  patternsOf: await patternsFor([...FAKE_SRC, ...FAKE_CONTENT]),
})
const fakeViolations = fake.violations.map(keyOf).sort()
const fakeRun = checkLayers(FAKE_UNRESOLVED, FAKE_DIRS, {
  contentFiles: FAKE_UNLINTED_CONTENT,
  patternsOf: new Map(),
})
const fakeUnresolved = fakeRun.unresolved.map(({ file, specifier }) => `${file} ${specifier}`)
const fakeUnlinted = [...fakeRun.unlinted].sort()
const fakeUnsupported = unsupportedKeysOf(UNSUPPORTED_PATTERNS)
const ignoredPatterns = await Promise.all(
  IGNORED_PATHS.map(async file => [file, await patternsAt(file)])
)
const selfCheckFailures = [
  // 本物のローダーの対が、画面のフォルダの一覧と合わない
  ...(loadersViolationOf(SCREEN_LOADER_OF, SCREEN_CONTAINER_DIRS) === undefined
    ? []
    : [`画面のローダーの対 ${JSON.stringify([...SCREEN_LOADER_OF])}: ${REASON_LOADERS}`]),
  ...LOADER_CASES.filter(
    ([loaders, dirs, expected]) => loadersViolationOf(loaders, dirs) !== expected
  ).map(
    ([loaders, , expected]) => `ローダーの対の判定 ${JSON.stringify([...loaders])} → ${expected}`
  ),
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
  ...(fake.unlinted.length > 0
    ? [`偽の src・content に ESLint の設定が掛からないファイルがある: ${fake.unlinted.join(', ')}`]
    : []),
  ...(JSON.stringify(fakeUnlinted) !== JSON.stringify(EXPECTED_UNLINTED)
    ? [`ESLint の設定が掛からないファイルの拾い方 ${JSON.stringify(fakeUnlinted)}`]
    : []),
  ...ignoredPatterns
    .filter(([, patterns]) => patterns !== undefined)
    .map(
      ([file]) =>
        `lint の対象の外のパスに ESLint の設定が掛かる(lint の対象の外を拾えない): ${file}`
    ),
  ...(JSON.stringify(fakeUnsupported) !== JSON.stringify(EXPECTED_UNSUPPORTED)
    ? [`規則 7 が写せない欄の判定 ${JSON.stringify(fakeUnsupported)}`]
    : []),
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

// リポジトリ直下からのパス → 中身(import を読まないファイルは undefined)。パスの順に並べる
const readFiles = paths =>
  new Map(
    paths
      .map(file => toPosix(path.relative(ROOT, file)))
      .sort()
      .map(file => [
        file,
        CODE_FILE.test(file) ? readFileSync(path.join(ROOT, file), 'utf8') : undefined,
      ])
  )

const files = readFiles(
  SCAN_DIRS.filter(dir => existsSync(path.join(ROOT, dir))).flatMap(dir =>
    walk(path.join(ROOT, dir))
  )
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

// content のファイル(指定子の解決先。コードのファイルは import も読んで規則 7 で見る)。1件も無いと、content を指す import と
// content のファイルの import が全部規則 7 の外へ黙って抜ける
const contentDir = path.join(ROOT, CONTENT_SCAN_DIR)
const contentFiles = readFiles(existsSync(contentDir) ? walk(contentDir) : [])
if (contentFiles.size === 0) {
  console.error('check-layers: content にファイルが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

// 規則 7 で当てる patterns(src と content のコードのファイルごとに ESLint に聞く)。写せない欄があれば、先のファイルだけでは判定できないので落とす
const patternsOf = await patternsFor([...files, ...contentFiles])
const allPatterns = [...patternsOf.values()].flatMap(patterns => patterns ?? [])
const unsupported = unsupportedKeysOf(allPatterns)
if (unsupported.length > 0) {
  console.error(
    `check-layers: eslint.config.mjs の ${RESTRICTED_IMPORTS} の patterns に、規則 7 が写せない欄がある(${unsupported.join(', ')})。` +
      '取り出す名前や型だけかで判定が分かれる欄は、import の先のファイルだけでは決まらない。向きを決める patterns は group・regex(と message・caseSensitive)だけで書くか、規則 7 の写し方を直す'
  )
  process.exit(1)
}

const containerCount = SCREEN_CONTAINER_DIRS.length + SHARED_CONTAINER_DIRS.length
const dirs = {
  screenDirs: SCREEN_CONTAINER_DIRS,
  sharedDirs: SHARED_CONTAINER_DIRS,
  loaders: SCREEN_LOADER_OF,
}
const { violations, unresolved, unlinted, edgeCount, layerCount } = checkLayers(files, dirs, {
  contentFiles,
  patternsOf,
})

if (unlinted.length > 0) {
  console.error(
    `check-layers: ESLint の設定が掛からない(lint の対象の外の)src・content のコードのファイル ${unlinted.length} 件。import の向き(規則 7)を見られない(eslint.config.mjs の ignores か、基準のフォルダを疑う)`
  )
  for (const file of unlinted) console.error(`  - ${file}`)
  process.exit(1)
}

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
    // 規則 7 は ESLint の報告(当たった別名の指定子と eslint.config.mjs の message)を後ろに付ける
    console.error(
      `  - ${formatViolation(violation)}: ${REASONS.get(violation.rule)}${violation.message ?? ''}`
    )
  }
  process.exit(1)
}

const contentCodeCount = [...contentFiles.values()].filter(code => code !== undefined).length
console.log(
  `check-layers: src のファイル ${files.size} 件(import ${edgeCount} 本)・content のコードのファイル ${contentCodeCount} 件(import の向きは両方を合わせ、型だけ・content を指すものも含めて ${layerCount} 本)と I/O コンテナの一覧 ${containerCount} か所・画面のローダー ${SCREEN_LOADER_OF.size} 本を検査 — 違反なし`
)
