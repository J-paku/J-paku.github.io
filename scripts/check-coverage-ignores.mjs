// カバレッジから行を外す注釈の検査(docs/decisions/0018-move-e2e-and-gate-all-hooks.md・docs/decisions/0019-hooks-make-containers.md)。
// フックとコンテナ(container.tsx)は統合テストのカバレッジでファイル別100%に固めている(vitest.integration.config.ts)。そこから外してよいのは、
// 統合テストで構造上届かず、E2E だけが作れる場合の行(IntersectionObserver の無い環境など)だけで、その行を見ている E2E を名指しする。
//
// 決まり:
//   - src で使ってよい外しの注釈は、次の形の1種だけ。1行のブロック注釈で、空白の数も含めてこのとおりに書く
//       /* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */
//   - <E2E のテスト名> は、test('…') に渡した名前そのもの。test.describe('…') の中のテストは、外側の describe の名前から順に
//     ' > ' でつないだ形(例: 'describe の名前 > テストの名前')だけを受け付ける(describe の中の名前だけでは受け付けない。
//     ほかの describe に同じ名前のテストがあると、どれを指すか決まらないため)
//   - 名指しした spec は git が追跡している tests/ の下の *.spec.ts で、その中にその名前のテストが実際にある。
//     数えるのは走るテストだけ: test('…')(test.skip・test.fixme・test.fail・test.only は数えない)と、
//     test.describe・test.describe.serial・test.describe.parallel の中のもの(test.describe.skip・fixme・only の中は数えない)。
//     名前を式で組んだテスト(`${prefix}…` の形)は名指しできない
//   - 置けるのは hooks フォルダの下のファイルと container.tsx だけ。門(ファイル別100%)が掛かるのはフックとコンテナで、
//     単体の門(純粋モジュールのファイル別100%と変異テスト)の対象を E2E で外すことはしない
//   - 注釈の直後(空白を飛ばした先)の字句から始まる構文は、始まりと終わりが同じ1行に収まるもの(if (…) return など)だけ。
//     v8 ignore next は、注釈の後の最初の字句から始まるいちばん外側の構文をまるごと外す(ast-v8-to-istanbul がその位置で探す)ので、
//     useEffect(…) の呼び出しやブロックを持つ if の前に置くと、その全体がカバレッジから消える。
//     直後に構文の無い注釈(閉じ括弧の前・別の注釈の前・ファイルの終わり)は何も外さないので、これも落とす
//   - それ以外の外しの言葉(v8・c8・istanbul・node:coverage の ignore。if・else・file・start・stop も)は、注釈の中でも文字列の中でも落とす。
//     カバレッジの変換(ast-v8-to-istanbul)は start・stop を、注釈かどうかを問わず行の中から拾うため
//
// 注釈が変換の後も効くこと(Vite 8 の変換を経ても v8 のカバレッジがこの形の注釈を読み、その行と分岐を外すこと)は、
// 2026-10-15 に注釈を外すとフックのファイル別100%が落ち、付けると通るのを見て確かめた(@preserve などの印は要らなかった)。
//
// 見るのは作業ツリーの src(check-test-boundary.mjs と同じ)。名指しされた spec は git の追跡を確かめてから作業ツリーの中身を読む。
// spec のテストの名前は TypeScript の構文木から集める(注釈・文字列の中の test( は数えない)。
// 判定の関数が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-coverage-ignores.mjs(npm run test:boundary)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parseSource } from './read-imports.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')
const SKIP_DIRS = new Set(['node_modules', '.git'])

// 中身を読むファイル(Vite が変換する名前)
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/
// 外しの言葉。カバレッジの変換が読む4つの名前(大文字小文字を問わず広めに拾う)
const IGNORE_WORD = /\b(?:istanbul|[cv]8|node:coverage)\s+ignore\b/gi
// 許す形。spec のパスとテストの名前を取り出す
const ALLOWED_NOTE = /^\/\* v8 ignore next -- e2e: (tests\/[^\s]+\.spec\.ts) > (\S(?:.*\S)?) \*\/$/
// 親フォルダのどれかが hooks であるパス(check-test-boundary.mjs と同じ。use-hooks/ のような名前は含めない)と、コンテナ
const HOOKS_DIR = /(^|\/)hooks\//
const CONTAINER_FILE = /(^|\/)container\.tsx$/
// 数えるテストと、その中を数える describe
const TEST_CALL = 'test'
const RUNNING_DESCRIBES = ['test.describe', 'test.describe.serial', 'test.describe.parallel']

// 違反ごとに出す理由。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const NOTE_FORM = '/* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */'
const REASON_FORM =
  `カバレッジから外す注釈は ${NOTE_FORM} の1行のブロック注釈だけ(空白もこのとおり)。理由(e2e の参照)の無い外し・別の形(if・else・file・start・stop・行注釈)・` +
  '文字列の中の外しの言葉は使わない。統合テストで届かない行でなければ、テストを足して通すか、起きない場合の防御なら分岐の生まれない形へ書き換える(ADR 0018)'
const REASON_PLACE =
  'e2e の注釈を置けるのは hooks フォルダの下のファイルと container.tsx だけ(ファイル別100%の門が掛かるもの)。' +
  '純粋モジュールは単体の門(ファイル別100%・変異テスト)で固め、E2E を理由に外さない。表示部品も外さない(ADR 0018・0019)'
const REASON_SPEC =
  '注釈が指す spec が、git が追跡している tests/ の下に無い。spec のパスを直すか、その E2E を残す(注釈が外す根拠は、その行を見ている E2E)(ADR 0018)'
const REASON_TEST =
  '注釈が指す spec に、その名前の走るテストが無い。test(…) に渡した名前をそのまま書く。describe の中なら外側から順に describe の名前を「 > 」でつなぐ。' +
  'test.skip・fixme・fail・only と、skip・fixme・only の describe の中は数えない(ADR 0018)'
const REASON_NEXT =
  'e2e の注釈の直後に置けるのは、1行に収まる文(if (…) return など)だけ。v8 ignore next は注釈の直後から始まる構文をまるごと外すので、' +
  '複数行の文(useEffect(…) の呼び出し・ブロックを持つ if など)の前に置くと、その全体がカバレッジから消える。直後に構文の無い注釈(閉じ括弧・別の注釈の前)は何も外さない。' +
  '外したい所を、注釈のすぐ下の1行の文に切り出す(ADR 0018)'

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

// 1 ファイルの注釈の範囲を [start, end] で返す。構文木のすべての字句の前後の注釈を集め、同じ範囲は1つにまとめる
const commentRangesOf = source => {
  const text = source.getFullText()
  const ranges = new Map()
  const add = list => {
    for (const range of list ?? []) ranges.set(range.pos, [range.pos, range.end])
  }
  const visit = node => {
    add(ts.getLeadingCommentRanges(text, node.pos))
    add(ts.getTrailingCommentRanges(text, node.end))
    for (const child of node.getChildren(source)) visit(child)
  }
  visit(source)
  return [...ranges.values()]
}

// 注釈の終わり(end)の後、空白を飛ばした先の字句から始まるいちばん外側の構文(無ければ undefined)。v8 ignore next が外すのはこの構文の全体
// (ast-v8-to-istanbul は注釈の後の最初の字句の位置を覚え、構文木を外側からたどって、その位置から始まる最初の構文を外す)。
// forEachChild は字句(閉じ括弧など)をたどらないので、閉じ括弧・別の注釈の前の注釈には構文が見つからない
const nextNodeOf = (source, end) => {
  const offset = source.text.slice(end).search(/\S/)
  if (offset === -1) return undefined
  const start = end + offset
  const find = node => {
    // 子は親の範囲の中にしか無い。start を含まない構文の下は探さない
    if (node.pos > start || node.end <= start) return undefined
    if (node.getStart(source) === start) return node
    return ts.forEachChild(node, find)
  }
  return ts.forEachChild(source, find)
}

// 構文が始まりと終わりで同じ1行に収まるか(構文が無ければ false)
const isOneLine = (source, node) =>
  node !== undefined &&
  source.getLineAndCharacterOfPosition(node.getStart(source)).line ===
    source.getLineAndCharacterOfPosition(node.end).line

// 1 ファイルの外しの言葉ごとに、その言葉を含む注釈の文字列(注釈の外なら undefined)と行番号、
// 注釈の直後から始まる構文が1行に収まるか(注釈の外なら false)を返す
const ignoreNotesOf = (file, code) => {
  const source = parseSource(file, code)
  const comments = commentRangesOf(source)
  return [...code.matchAll(IGNORE_WORD)].map(match => {
    const range = comments.find(([start, end]) => start <= match.index && match.index < end)
    const { line } = source.getLineAndCharacterOfPosition(match.index)
    return {
      note: range === undefined ? undefined : code.slice(range[0], range[1]),
      line: line + 1,
      nextIsOneLine: range !== undefined && isOneLine(source, nextNodeOf(source, range[1])),
    }
  })
}

// 呼び出しの名前(test・test.describe.serial など)。名前で書けない呼び出しは undefined
const calleeName = node => {
  if (ts.isIdentifier(node)) return node.text
  if (!ts.isPropertyAccessExpression(node)) return undefined
  const head = calleeName(node.expression)
  return head === undefined ? undefined : `${head}.${node.name.text}`
}

// 文字列で書いた名前(式で組んだ名前は undefined)
const literalOf = node =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined

// spec 1つの走るテストの名前を、describe の名前から ' > ' でつないだ形で集める
const testNamesOf = (file, code) => {
  const names = []
  const visit = (node, prefix) => {
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression)
      const title = literalOf(node.arguments[0])
      if (callee === TEST_CALL) {
        if (title !== undefined) names.push([...prefix, title].join(' > '))
        return
      }
      if (RUNNING_DESCRIBES.includes(callee)) {
        // 中を数えるのは、名前が文字列で書かれた describe だけ
        if (title === undefined) return
        const body = node.arguments.at(-1)
        if (body !== undefined) visit(body, [...prefix, title])
        return
      }
      // それ以外の test.* (skip・fixme・describe.skip など)の中は数えない
      if (callee !== undefined && callee.startsWith(`${TEST_CALL}.`)) return
    }
    ts.forEachChild(node, child => visit(child, prefix))
  }
  visit(parseSource(file, code), [])
  return names
}

// ファイル別100%の門が掛かるファイル(フックとコンテナ)か
const isGated = file => HOOKS_DIR.test(file) || CONTAINER_FILE.test(file)

// 1 ファイルの違反を { line, reason } で返す。specs は追跡されている spec のパス → 中身
const violationsOf = (file, code, specs) =>
  ignoreNotesOf(file, code).flatMap(({ note, line, nextIsOneLine }) => {
    const match = note === undefined ? null : ALLOWED_NOTE.exec(note)
    if (match === null) return [{ line, reason: REASON_FORM }]
    if (!isGated(file)) return [{ line, reason: REASON_PLACE }]
    const [, spec, name] = match
    const specCode = specs.get(spec)
    if (specCode === undefined) return [{ line, reason: REASON_SPEC }]
    if (!testNamesOf(spec, specCode).includes(name)) return [{ line, reason: REASON_TEST }]
    if (!nextIsOneLine) return [{ line, reason: REASON_NEXT }]
    return []
  })

// ---- 自己検査 ----
// 外しの言葉の拾い方・注釈の範囲の取り方・許す形・spec のテストの名前の集め方が壊れると、違反を見逃したまま「違反なし」で通る。
// そこで偽の spec と偽のフックを並べ、実際の検査と同じ関数でメモリの上で判定し、期待と違えば落とす
const FAKE_SPEC = [
  `import { test } from './village.helpers'`,
  `test('上の名前', async () => {})`,
  `test(\`文字列の型の名前\`, async () => {})`,
  `test.describe('外側', () => {`,
  `  test('中の名前', async () => {})`,
  `  test.describe.serial('内側', () => {`,
  `    test('奥の名前', { tag: '@a' }, async () => {})`,
  `  })`,
  `})`,
  `test.describe('飛ばす', () => {})`,
  `test.describe.skip('飛ばした describe', () => {`,
  `  test('飛ばした中の名前', async () => {})`,
  `})`,
  `test.skip('飛ばした名前', async () => {})`,
  `test.fixme('直す名前', async () => {})`,
  `for (const prefix of ['', '/ko']) test(\`\${prefix} 式の名前\`, async () => {})`,
  `// test('注釈の中の名前', async () => {})`,
  `const label = \`test('文字列の中の名前')\``,
].join('\n')
const EXPECTED_TEST_NAMES = [
  '上の名前',
  '文字列の型の名前',
  '外側 > 中の名前',
  '外側 > 内側 > 奥の名前',
]
const FAKE_SPECS = new Map([['tests/fake.spec.ts', FAKE_SPEC]])
const note = name => `/* v8 ignore next -- e2e: tests/fake.spec.ts > ${name} */`
const HOOK = 'src/components/A/hooks/use-a.ts'
// [パス, 中身, 期待する違反の理由(行の順)]
const NOTE_CASES = [
  [HOOK, `${note('上の名前')}\nif (a) return`, []],
  [HOOK, `${note('外側 > 内側 > 奥の名前')}\nif (a) return`, []],
  [HOOK, `${note('文字列の型の名前')}\nif (a) return`, []],
  ['src/hooks/use-b.ts', `const x = 1 ${note('外側 > 中の名前')}\nif (a) return`, []],
  [
    'src/components/A/hooks/use-a/use-c.tsx',
    `const v = <div>{${note('上の名前')} a && <b />}</div>`,
    [],
  ],
  // 外しの言葉を持たないファイルと、似ているだけの言葉
  [HOOK, '// v8 で無視する行は無い\nconst v8ignore = 1', []],
  // describe の中の名前だけ・無い名前・数えないテスト
  [HOOK, note('中の名前'), [REASON_TEST]],
  [HOOK, note('無い名前'), [REASON_TEST]],
  [HOOK, note('飛ばした中の名前'), [REASON_TEST]],
  [HOOK, note('飛ばした describe > 飛ばした中の名前'), [REASON_TEST]],
  [HOOK, note('飛ばした名前'), [REASON_TEST]],
  [HOOK, note('直す名前'), [REASON_TEST]],
  [HOOK, note('式の名前'), [REASON_TEST]],
  [HOOK, note('注釈の中の名前'), [REASON_TEST]],
  [HOOK, note('文字列の中の名前'), [REASON_TEST]],
  // 追跡されていない spec
  [HOOK, '/* v8 ignore next -- e2e: tests/gone.spec.ts > 上の名前 */', [REASON_SPEC]],
  // コンテナ(I/O コンテナも状態コンテナも)はフックと同じに置ける
  ['src/components/A/container.tsx', `${note('上の名前')}\nif (a) return`, []],
  ['src/components/A/components/B/container.tsx', `${note('上の名前')}\nif (a) return`, []],
  ['src/components/A/container.tsx', note('無い名前'), [REASON_TEST]],
  // フックとコンテナの外(名前の後ろが container.tsx なだけのもの・コンテナのテストも外)
  ['src/utils/a.ts', note('上の名前'), [REASON_PLACE]],
  ['src/components/A/index.tsx', note('上の名前'), [REASON_PLACE]],
  ['src/use-hooks/a.ts', note('上の名前'), [REASON_PLACE]],
  ['src/components/A/my-container.tsx', note('上の名前'), [REASON_PLACE]],
  ['src/components/A/container.test.tsx', note('上の名前'), [REASON_PLACE]],
  ['src/components/A/container.ts', note('上の名前'), [REASON_PLACE]],
  // 理由の無い外し・別の形・別の名前・文字列の中
  [HOOK, '/* v8 ignore next */\nif (a) return', [REASON_FORM]],
  [HOOK, '/* istanbul ignore next */', [REASON_FORM]],
  [HOOK, '/* c8 ignore next */', [REASON_FORM]],
  [HOOK, '/* node:coverage ignore next */', [REASON_FORM]],
  [HOOK, '/* v8 ignore if -- e2e: tests/fake.spec.ts > 上の名前 */', [REASON_FORM]],
  [HOOK, '/* v8 ignore file */', [REASON_FORM]],
  [HOOK, '/* v8 ignore start */\nif (a) return\n/* v8 ignore stop */', [REASON_FORM, REASON_FORM]],
  [HOOK, '// v8 ignore next -- e2e: tests/fake.spec.ts > 上の名前', [REASON_FORM]],
  [HOOK, '/*v8 ignore next -- e2e: tests/fake.spec.ts > 上の名前*/', [REASON_FORM]],
  [HOOK, '/* V8 Ignore next -- e2e: tests/fake.spec.ts > 上の名前 */', [REASON_FORM]],
  [HOOK, `${note('上の名前').slice(0, -3)} -- @preserve */`, [REASON_TEST]],
  [HOOK, '/* v8 ignore next -- e2e: tests/fake.spec.ts */', [REASON_FORM]],
  [HOOK, '/* v8 ignore next -- e2e: src/a.spec.ts > 上の名前 */', [REASON_FORM]],
  [HOOK, '/*\n * v8 ignore next -- e2e: tests/fake.spec.ts > 上の名前\n */', [REASON_FORM]],
  [HOOK, `const s = 'c8 ignore start'`, [REASON_FORM]],
  [HOOK, 'const s = `istanbul ignore else`', [REASON_FORM]],
  // 同じ行の2つの注釈は、それぞれを判定する
  [HOOK, `/* v8 ignore next */ ${note('上の名前')}\nif (a) return`, [REASON_FORM]],
  // 外れるのは注釈の直後から始まる構文の全体。1行に収まるものだけを許す(effect の中の1行の if は、外側の呼び出しではなく if だけ)
  [HOOK, `useEffect(() => {\n  ${note('上の名前')}\n  if (!can()) return\n  run()\n}, [])`, []],
  [HOOK, `${note('上の名前')}\nuseEffect(() => {\n  run()\n}, [])`, [REASON_NEXT]],
  [HOOK, `${note('上の名前')}\nif (a) {\n  return\n}`, [REASON_NEXT]],
  [HOOK, `${note('上の名前')}\nif (a) return\nelse run()`, [REASON_NEXT]],
  [HOOK, `${note('上の名前')}\nconst c = a\n  .b()`, [REASON_NEXT]],
  [HOOK, `const x = 1 ${note('上の名前')}\nrun(\n  a\n)`, [REASON_NEXT]],
  // 直後に構文の無い注釈(ファイルの終わり・閉じ括弧の前・別の注釈の前)は何も外さない
  [HOOK, note('上の名前'), [REASON_NEXT]],
  [HOOK, `if (a) {\n  run()\n  ${note('上の名前')}\n}`, [REASON_NEXT]],
  [HOOK, `${note('上の名前')}\n// 次の行\nif (a) return`, [REASON_NEXT]],
]
const selfCheckFailures = [
  ...(JSON.stringify(testNamesOf('tests/fake.spec.ts', FAKE_SPEC)) !==
  JSON.stringify(EXPECTED_TEST_NAMES)
    ? [`テストの名前の集め方 ${JSON.stringify(testNamesOf('tests/fake.spec.ts', FAKE_SPEC))}`]
    : []),
  ...NOTE_CASES.filter(
    ([file, code, expected]) =>
      JSON.stringify(violationsOf(file, code, FAKE_SPECS).map(({ reason }) => reason)) !==
      JSON.stringify(expected)
  ).map(([file, code]) => `注釈の判定 ${file} ${JSON.stringify(code)}`),
]
if (selfCheckFailures.length > 0) {
  throw new Error(
    `check-coverage-ignores: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

// git が追跡している tests/ の spec(作業ツリーの中身)。git が読めなければ落とす(spec の実在を確かめられないまま通さない)
const trackedSpecs = new Map(
  execFileSync('git', ['ls-files', '-z', '--', 'tests'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(file => file.endsWith('.spec.ts') && existsSync(path.join(ROOT, file)))
    .map(file => [file, readFileSync(path.join(ROOT, file), 'utf8')])
)

const codeFiles = (existsSync(SRC_DIR) ? walk(SRC_DIR) : [])
  .map(file => toPosix(path.relative(ROOT, file)))
  .filter(file => CODE_FILE.test(file))
  .sort()

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (codeFiles.length === 0 || trackedSpecs.size === 0) {
  console.error(
    `check-coverage-ignores: src のファイル ${codeFiles.length} 件・追跡されている spec ${trackedSpecs.size} 件。対象の指定を疑うこと`
  )
  process.exit(1)
}

let noteCount = 0
const failures = []
for (const file of codeFiles) {
  const code = readFileSync(path.join(ROOT, file), 'utf8')
  noteCount += ignoreNotesOf(file, code).length
  for (const { line, reason } of violationsOf(file, code, trackedSpecs)) {
    failures.push(`${file}:${line}: ${reason}`)
  }
}

if (failures.length > 0) {
  console.error(`check-coverage-ignores: ${failures.length} 件の違反`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(
  `check-coverage-ignores: src のファイル ${codeFiles.length} 件と追跡されている spec ${trackedSpecs.size} 件を検査(e2e の注釈 ${noteCount} 件) — 違反なし`
)
