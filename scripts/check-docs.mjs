// 文書の自己整合性検査。書いてある参照が実在するかだけを見る(内容の正しさは見ない)。
//
// 何を確かめるか:
//   1. 相対リンク   — [表示](path) の path が実在するファイル・ディレクトリか
//   2. 参照パス     — コードスパン `src/...` `content/...` などが実在するか
//   3. コマンド     — `npm run xxx` の xxx が package.json の scripts にあるか
//   4. frontmatter  — docs/ 配下の文書が status / read_when / source_of_truth / last_reviewed を持つか
//   5. 孤児         — docs/ 配下の文書がどこからもリンクされていないか
//   6. E2E 一覧     — docs/quality/test-strategy.md の一覧表と tests/**/*.spec.ts の実物が一致するか
//
// 実在判定は「作業ツリーにあるか」ではなく「git が追跡しているか」で行う。開発機にしか無いもの
// (.gitignore 済みのフォルダ、リポジトリの外)を実在と数えると、ローカルだけ通って CI で落ちる。
// 大文字小文字も git の記録どおりに区別されるので、区別しないファイルシステムでの取りこぼしも防げる。
//
// 使い方: node scripts/check-docs.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 検査対象の文書。docs/ 全体 + リポジトリ直下 + 各所の AGENTS.md
const ENTRY_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'content/AGENTS.md',
  'content/README.md',
]
const SCAN_DIRS = ['docs', 'src', 'scripts', 'tests', 'content']
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'out',
  'dist',
  'test-results',
  '.claude',
])

// 壊れたシンボリックリンクで statSync が例外を投げると、不整合ではなくスタックトレースが出る。
// 実体の無い入口はそもそも読めないので、集める前に落とす
const walk = dir =>
  readdirSync(dir).flatMap(name => {
    if (SKIP_DIRS.has(name)) return []
    const p = path.join(dir, name)
    const stat = statSync(p, { throwIfNoEntry: false })
    if (stat === undefined) return []
    return stat.isDirectory() ? walk(p) : [p]
  })

const toPosix = p => p.split(path.sep).join('/')

// ENTRY_FILES と SCAN_DIRS は重なるので、同じ文書を二重に数えないよう Set で畳む
const docFiles = [
  ...new Set([
    ...ENTRY_FILES.filter(rel => existsSync(path.join(ROOT, rel))),
    ...SCAN_DIRS.filter(dir => existsSync(path.join(ROOT, dir)))
      .flatMap(dir => walk(path.join(ROOT, dir)))
      .filter(p => p.endsWith('.md'))
      .map(p => toPosix(path.relative(ROOT, p))),
  ]),
]

const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).scripts
const STATUS_VALUES = ['active', 'deprecated', 'historical', 'generated']
const FRONTMATTER_KEYS = ['status', 'read_when', 'source_of_truth', 'last_reviewed']

// git が追跡しているパスの集合。CI のチェックアウトに実在するものと一致する
const trackedFiles = new Set(
  execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf-8' })
    .split('\0')
    .filter(line => line !== '')
)
const trackedDirs = new Set()
for (const file of trackedFiles) {
  const parts = file.split('/')
  for (let i = 1; i < parts.length; i += 1) trackedDirs.add(parts.slice(0, i).join('/'))
}

// 追跡対象外と決まっているもの。書いてあっても検査しない(実在を確かめる手段が無い)
const isUncheckable = relative =>
  relative.startsWith('..') ||
  path.isAbsolute(relative) ||
  SKIP_DIRS.has(toPosix(relative).split('/')[0])

// 引数はリポジトリ相対。追跡されていれば実在とみなす
const existsTracked = relative => {
  const normalized = toPosix(relative).replace(/\/$/, '')
  return trackedFiles.has(normalized) || trackedDirs.has(normalized)
}

// 参照パスとみなす条件: 拡張子付きか末尾がスラッシュ。glob・プレースホルダ・URL・絶対パスは対象外
const PATH_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.cjs',
  '.css',
  '.md',
  '.json',
  '.html',
  '.yml',
  '.yaml',
  '.png',
  '.svg',
]
const looksLikePath = value => {
  if (value.includes('://') || value.startsWith('/') || value.startsWith('#')) return false
  if (/[{}*<>,\s|]/.test(value)) return false
  if (!value.includes('/')) return false
  return value.endsWith('/') || PATH_EXTENSIONS.some(ext => value.endsWith(ext))
}

// エイリアスを実パスへ直す
const resolveAlias = value => {
  if (value.startsWith('@/')) return `src/${value.slice(2)}`
  if (value.startsWith('@content/')) return `content/${value.slice(9)}`
  return value
}

// フェンスドコードブロックは行数を保ったまま伏せる(中の例示リンクを実在扱いしないため)
const maskFences = raw => raw.replace(/```[\s\S]*?```/g, block => block.replace(/[^\n]/g, ' '))

const lineOf = (raw, index) => raw.slice(0, index).split('\n').length

const failures = []
const linkedTargets = new Set()
const linksByFile = new Map()
const fail = (file, line, message) => failures.push(`${file}:${line}: ${message}`)

for (const file of docFiles) {
  // CRLF のまま読むと frontmatter の判定が丸ごと外れる
  const raw = readFileSync(path.join(ROOT, file), 'utf-8').replace(/\r\n/g, '\n')
  const dir = path.dirname(path.join(ROOT, file))

  // 1. 相対リンク。( ) を1段だけ含む路(ルートグループ)と、CommonMark の title 構文に対応する
  for (const match of maskFences(raw).matchAll(
    /\[[^\]]*\]\(((?:[^()\s]|\([^()]*\))+)(?:\s+"[^"]*")?\)/g
  )) {
    const target = match[1].split('#')[0]
    if (target === '' || target.includes('://') || target.startsWith('mailto:')) continue
    const relative = path.relative(ROOT, path.resolve(dir, target))
    if (isUncheckable(relative)) continue
    if (!existsTracked(relative))
      fail(file, lineOf(raw, match.index), `リンク先が無い: ${match[1]}`)
    else linkedTargets.add(toPosix(relative))
  }

  // 2・3. コードスパンの参照パスと npm run
  for (const match of raw.matchAll(/`([^`\n]+)`/g)) {
    const value = match[1].trim()
    if (!looksLikePath(value)) continue
    const target = resolveAlias(value)
    // リポジトリ直下からと、その文書の位置からの両方で探す(入れ子の AGENTS.md は相対で書くため)
    const fromRoot = target
    const fromDoc = path.relative(ROOT, path.resolve(dir, target))
    if (isUncheckable(fromRoot) || isUncheckable(fromDoc)) continue
    if (!existsTracked(fromRoot) && !existsTracked(fromDoc))
      fail(file, lineOf(raw, match.index), `参照パスが無い: ${value}`)
  }
  for (const match of raw.matchAll(/npm run ([\w:.-]+)/g)) {
    if (scripts[match[1]] === undefined)
      fail(file, lineOf(raw, match.index), `package.json に無いコマンド: npm run ${match[1]}`)
  }

  // 4. frontmatter(docs/ 配下だけ必須)
  if (file.startsWith('docs/')) {
    const closing = raw.startsWith('---\n') ? raw.indexOf('\n---', 4) : -1
    if (closing < 0) {
      fail(file, 1, raw.startsWith('---\n') ? 'frontmatter が閉じていない' : 'frontmatter が無い')
      continue
    }
    const front = raw.slice(4, closing)
    for (const key of FRONTMATTER_KEYS) {
      if (!new RegExp(`^${key}:`, 'm').test(front)) fail(file, 1, `frontmatter に ${key} が無い`)
    }
    const status = /^status:\s*(\S+)/m.exec(front)
    if (status !== null && !STATUS_VALUES.includes(status[1]))
      fail(file, 1, `status が ${STATUS_VALUES.join(' / ')} のいずれでもない: ${status[1]}`)
    if (!/^last_reviewed:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(front))
      fail(file, 1, 'last_reviewed が YYYY-MM-DD ではない')
  }
}

// 5. 孤児(docs/ 配下でどこからもリンクされていない文書)。自分で自分を指しても孤児は解けない
for (const file of docFiles) {
  if (!file.startsWith('docs/')) continue
  const linkedFromOthers = docFiles.some(
    other => other !== file && linkedTargets.has(file) && readLinksOf(other).has(file)
  )
  if (!linkedFromOthers) fail(file, 1, 'どこからもリンクされていない')
}

// 6. E2E の一覧表と実ファイルの突き合わせ。spec を足しても消しても文書が追随しないと、
// 消えた経路が検査表に残って空回りする(03-pitfalls.md #11)。表に無い spec は
// 「走っているのに誰も知らない検査」、表にしか無い spec は「もう走らない検査」になる。
// 見出しの本数も数える — 表だけ直して見出しが「6本」のまま残る崩れ方が一番起きやすい
const TEST_STRATEGY = 'docs/quality/test-strategy.md'
// Playwright の testDir は tests なので、入れ子のフォルダ(tests/sub/x.spec.ts)も走る。直下だけを
// 数えると入れ子の spec が「走っているのに一覧に無い」まま通るので、深さを問わず拾う。
// 数えるのは git が追跡している spec だけ(未追跡の書きかけは CI では走らないので意図して除く)
const SPEC_PATTERN = /^tests\/(?:[^/]+\/)*[^/]+\.spec\.ts$/
// 文書ごと消えた・移された場合は突き合わせが丸ごと黙って飛ぶ。飛んだことに気づけるよう落とす
if (!docFiles.includes(TEST_STRATEGY)) {
  fail(TEST_STRATEGY, 1, 'この文書が無い。E2E 一覧の突き合わせが成立していない')
} else {
  const raw = readFileSync(path.join(ROOT, TEST_STRATEGY), 'utf-8').replace(/\r\n/g, '\n')
  const actualSpecs = [...trackedFiles].filter(file => SPEC_PATTERN.test(file)).sort()
  const heading = /^## E2E の(\d+)本 *$/m.exec(raw)
  if (heading === null) {
    fail(TEST_STRATEGY, 1, '「## E2E のN本」の見出しが無い。E2E 一覧の突き合わせができない')
  } else {
    const headingLine = lineOf(raw, heading.index)
    // 見出しから次の同階層見出しまでが一覧の範囲(### の小見出しは範囲に含めたままでよい)
    const section = raw.slice(heading.index + heading[0].length).split(/\n## [^#]/)[0]
    const listed = [
      ...new Set([...section.matchAll(/`(tests\/[^`\n]+\.spec\.ts)`/g)].map(match => match[1])),
    ].sort()
    for (const spec of actualSpecs) {
      if (!listed.includes(spec)) fail(TEST_STRATEGY, headingLine, `一覧に無い spec: ${spec}`)
    }
    for (const spec of listed) {
      if (!actualSpecs.includes(spec))
        fail(TEST_STRATEGY, headingLine, `一覧にあるが実在しない spec: ${spec}`)
    }
    if (Number(heading[1]) !== actualSpecs.length)
      fail(
        TEST_STRATEGY,
        headingLine,
        `見出しの本数が実際と違う: ${heading[1]}本 と書いてあるが tests/ には ${actualSpecs.length}本`
      )
  }
  if (actualSpecs.length === 0)
    fail(TEST_STRATEGY, 1, 'tests/**/*.spec.ts が1件も無い。突き合わせが成立していない')
}

// ある文書が指しているリンク先(リポジトリ相対)の集合。孤児判定でだけ使う
function readLinksOf(file) {
  const cached = linksByFile.get(file)
  if (cached !== undefined) return cached
  const raw = readFileSync(path.join(ROOT, file), 'utf-8').replace(/\r\n/g, '\n')
  const dir = path.dirname(path.join(ROOT, file))
  const set = new Set()
  for (const match of maskFences(raw).matchAll(
    /\[[^\]]*\]\(((?:[^()\s]|\([^()]*\))+)(?:\s+"[^"]*")?\)/g
  )) {
    const target = match[1].split('#')[0]
    if (target === '' || target.includes('://') || target.startsWith('mailto:')) continue
    const relative = toPosix(path.relative(ROOT, path.resolve(dir, target)))
    if (!isUncheckable(relative)) set.add(relative)
  }
  linksByFile.set(file, set)
  return set
}

if (docFiles.length === 0) {
  console.error('check-docs: 検査対象の文書が1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

if (failures.length > 0) {
  console.error(`check-docs: ${failures.length} 件の不整合`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(`check-docs: ${docFiles.length} 件の文書を検査 — 不整合なし`)
