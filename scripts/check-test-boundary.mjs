// テストの置き場の境界検査。フック(hooks/ 配下)に単体テストを置いていないかと、
// フックを renderHook で呼ぶテストが src のどこにも無いかを見る。
//
// 決まり: ロジックは純粋関数(src/lib/・utils/)に置き、単体テストと変異テストで固める。
// フックは単体テストを置かない層で、動きはそのフックを使うコンポーネントを統合テスト(*.browser.test.tsx)で描いて見る
// (統合テストへ移し終えるまでは E2E が見る。vitest.config.ts のカバレッジでも測らない)。
// hooks/ の外へテストを移しても、renderHook でフックを呼べば同じことになるので、それも落とす。
// ストアを import して getState() で状態を戻すだけのテストは、フックを描かないので落とさない。
// 例外を許す一覧は持たない(移し終えて 0 件になった。足したくなったら、ロジックを純粋関数へ切り出してそちらで測る)。
//
// 見るのは git の追跡ではなく作業ツリー。書いたばかりの未追跡のテストも Vitest は拾って走らせるため。
// 正規表現や注釈の外し方が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」)。
//
// 使い方: node scripts/check-test-boundary.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')

// Vitest が拾う名前(vitest.config.ts の include と同じ *.test.ts / *.test.tsx)
const TEST_FILE = /\.test\.tsx?$/
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

// ---- 自己検査 ----
// 正規表現や注釈の外し方が壊れると、違反を見逃したまま「違反なし」で通る(下の 0 件の検査は、src を見失ったときしか落ちない)。
// そこで違反と分かっている文字列と違反でない文字列を、実際の検査と同じ関数でメモリの上で判定し、期待と違えば落とす
const TEST_FILE_CASES = [
  ['src/a.test.ts', true],
  ['src/a.test.tsx', true],
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
const selfCheckFailures = [
  ...TEST_FILE_CASES.filter(([file, expected]) => TEST_FILE.test(file) !== expected).map(
    ([file, expected]) => `テストの名前の判定 ${file} → ${expected}`
  ),
  ...VIOLATION_CASES.filter(
    ([file, code, expected]) => violationOf(file, () => code) !== expected
  ).map(([file, code, expected]) => `違反の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
]
if (selfCheckFailures.length > 0) {
  throw new Error(
    `check-test-boundary: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

const testFiles = (existsSync(SRC_DIR) ? walk(SRC_DIR) : [])
  .map(file => toPosix(path.relative(ROOT, file)))
  .filter(file => TEST_FILE.test(file))
  .sort()

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (testFiles.length === 0) {
  console.error('check-test-boundary: src にテストが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

// 1 ファイル 1 件で数える
const failures = []
for (const file of testFiles) {
  const reason = violationOf(file, () => readFileSync(path.join(ROOT, file), 'utf8'))
  if (reason !== undefined) failures.push(`${file}: ${reason}`)
}

if (failures.length > 0) {
  console.error(`check-test-boundary: ${failures.length} 件の違反`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(`check-test-boundary: src のテスト ${testFiles.length} 件を検査 — 違反なし`)
