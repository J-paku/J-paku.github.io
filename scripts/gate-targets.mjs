// 変異テスト100%(stryker.config.mjs の mutate)とファイル別カバレッジ100%(vitest.config.ts)の対象の正本。
// 一覧を手で並べると、新しいファイルを足し忘れたときに黙って門の外へ出る。そこで設定を読むたびに src をたどり、
// 純粋モジュールの置き場にある .ts を下の規則で選ぶ。新しい純粋モジュールは、置いた時点で両方の門の対象になる
// (docs/decisions/0014-gate-all-pure-modules.md)。
//
// 規則:
//   含める: src/lib/**/*.ts・src/utils/**/*.ts・src/components/**/utils/**/*.ts(ロジックを置く場所。AGENTS.md の不変ルール7)
//   外す:   *.test.ts(テスト)・*.d.ts(型の宣言)・*.fixture.ts(テストが読むデータ)・*.test-helper.ts(テストの部品)・
//           types.ts(型だけのファイル)・hooks/ の下(単体テストを置かない層で、動きは E2E が見る)
//   名指し: 下の OUTSIDE_GATES はどちらの門にも入れない。COVERAGE_ONLY は変異テストから外し、ファイル別100%だけで固める
//
// 名指ししたパスが1つでも実在しないと、読み込む時点で落とす。移動・改名・打ち間違いで名指しが空振りすると、
// 外したつもりのファイルが門に入る(または外れる)のに気付けないため。
// 規則やたどり方が壊れて対象が黙って減ったときも、読み込む時点で落とす(下の「自己検査」)。
// 返すパスはリポジトリ直下からの '/' 区切りで、並べ替え済み。
//
// 使い方: import { MUTATION_TARGETS, COVERAGE_TARGETS } from './scripts/gate-targets.mjs'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る(Stryker の作業用の写しの中でも、写しの直下を見る)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')
const SKIP_DIRS = new Set(['node_modules', '.git'])

// 純粋モジュールの置き場(含める規則)
const IN_PURE_DIR = /^src\/(?:lib|utils)\/.+\.ts$|^src\/components\/(?:.+\/)?utils\/.+\.ts$/
// 置き場の中でも、ロジックのモジュールではない名前(外す規則)
const NOT_MODULE = /\.(?:test|d|fixture|test-helper)\.ts$|(?:^|\/)types\.ts$|(?:^|\/)hooks\//

// どちらの門にも入れないもの
const OUTSIDE_GATES = [
  // ブラウザ向けの束でだけ linkedom の代わりに読み込まれる差し替え(next.config.ts の alias が指す)。
  // window の DOMParser を渡す1行だけで、守るロジックを持たない
  'src/utils/linkedom-browser-stub.ts',
  // ドット絵を文字列の行列で持つ絵のデータ。文字を消した変異体を見抜くには絵を丸ごと写したテストが要るだけで、
  // 振る舞いは守れない。専用のテストも持たず、ADR 0011 の門でも対象外だった(ファイル別100%で固めるかは決めていない)。
  // 主人公(actors.ts)は絵の行列と組み立ての呼び出しだけを持ち、組み立ての手順は門の中の compose-player.ts に置く
  'src/lib/pixel/actors.ts',
  'src/lib/pixel/fishing-art.ts',
  'src/lib/pixel/structures.ts',
  'src/lib/pixel/terrain.ts',
  'src/lib/pixel/umbrella-original.ts',
  'src/lib/pixel/weather-art.ts',
]

// 変異テストから外し、ファイル別100%だけで固めるもの(どちらもデータ)
const COVERAGE_ONLY = [
  // 飛ぶ主人公のドット絵の行列。外す理由は上の絵のデータと同じ。専用のテストがあり、ADR 0011 の時点からファイル別100%で固めている
  'src/lib/pixel/flight-art.ts',
  // 1文字 → 色の表。変異体はどれもモジュールを読む時に1回だけ評価される静的な変異体で、2026-10-11 の実測では
  // 82体のうち6体が生き残った。夜だけ出る絵にしか使わないキー '#' の昼の値と、どこからも読まれていない roofColors を
  // 変えるもので、絵にも振る舞いにも表れず、表を丸ごと写したテストでしか落とせない
  'src/lib/pixel/palette.ts',
]

// ---- 自己検査 ----
// 規則やたどり方が壊れて対象が黙って減っても、1件以上拾えている限りどの門も通ってしまう
// (例: 含める規則からコンポーネントの utils の項を消すと約40ファイルが門の外へ出るのに、0件の検査では気付けない)。
// そこで読み込む時点で下の4つを確かめ、外れたら落とす。1 は実際の一覧づくりと同じ判定(isMutationTarget)を、
// 2・3 はできあがった一覧そのものを見る

// 1. 規則の各項に当たる架空のパスの判定(実在しなくてよい。規則そのものの書き換えを見る)
const RULE_CASES = [
  // 含める
  ['src/lib/a.ts', true],
  ['src/lib/x/a.ts', true],
  ['src/utils/a.ts', true],
  ['src/utils/x/a.ts', true],
  ['src/components/utils/a.ts', true],
  ['src/components/A/utils/a.ts', true],
  ['src/components/A/B/utils/x/a.ts', true],
  // 外す名前はフォルダ名・ファイル名の全体で見る(名前の一部に含むだけなら含める)
  ['src/lib/my-types.ts', true],
  ['src/lib/use-hooks/a.ts', true],
  // 置き場の外
  ['src/lib/a.tsx', false],
  ['src/components/A/a.ts', false],
  ['src/hooks/use-a.ts', false],
  ['src/app/a.ts', false],
  // 置き場の中でも外す名前
  ['src/lib/a.test.ts', false],
  ['src/lib/a.d.ts', false],
  ['src/lib/a.fixture.ts', false],
  ['src/lib/a.test-helper.ts', false],
  ['src/lib/types.ts', false],
  ['src/components/A/utils/types.ts', false],
  ['src/lib/hooks/use-a.ts', false],
  ['src/components/A/hooks/utils/a.ts', false],
]

// 2. 実在するファイルの判定(src のたどり方まで含めて見る)。名指しと同じく、実在しないと落とす
// 含まれるべきもの: lib の直下・lib の下のフォルダ・utils・コンポーネントの utils の直下・utils の下のフォルダ
const MUST_INCLUDE = [
  'src/lib/preferences.ts',
  'src/lib/pixel/art.ts',
  'src/utils/day-phase.ts',
  'src/components/VillagePage/utils/sprite-css.ts',
  'src/components/VillagePage/components/Village/utils/walk-loop/tick-frame.ts',
]
// 外れるべきもの(どちらの門にも入らない): テスト・テストが読むデータ・テストの部品・型だけのファイル・フック
const MUST_EXCLUDE = [
  'src/lib/preferences.test.ts',
  'src/lib/pixel/sprites.fixture.ts',
  'src/lib/pixel/png.test-helper.ts',
  'src/components/VillagePage/components/Village/utils/walk-loop/types.ts',
  'src/hooks/use-reveal.ts',
  'src/components/VillagePage/components/Village/hooks/use-village.ts',
]

// 3. 置き場ごとの変異テストの対象の件数の下限。2026-10-11 の実測は lib 31・utils 8・components 42 で、
// 下限はそれぞれその 81%・63%・71%。目標ではなく、規則やたどり方が壊れて大きく減ったときに落とすための床
const FLOORS = [
  ['src/lib/', 25],
  ['src/utils/', 5],
  ['src/components/', 30],
]

// 4. types.ts は型だけのファイルとして名前で外す。名前だけで外すと、そこへ関数や定数を書いても門の外に残るので、
// 置き場の中の types.ts に値の宣言(関数・定数・クラス・enum)が無いかを中身で確かめる。
// 判定の正規表現そのものも、下の DECLARATION_CASES で固定する
const RUNTIME_DECLARATION =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|enum)\b/m
const DECLARATION_CASES = [
  ['export type A = { b: number }', false],
  [`import type { A } from './a'`, false],
  ['// const a = 1', false],
  ['export const a = 1', true],
  ['  let a = 1', true],
  ['export default function a() {}', true],
  ['export async function a() {}', true],
  ['class A {}', true],
  ['export enum A { B }', true],
]

// 名指しが空振りしていないか、読み込む時点で確かめる
const missing = [...OUTSIDE_GATES, ...COVERAGE_ONLY, ...MUST_INCLUDE, ...MUST_EXCLUDE].filter(
  file => !existsSync(path.join(ROOT, file))
)
if (missing.length > 0) {
  throw new Error(`scripts/gate-targets.mjs: 名指ししたパスが実在しない: ${missing.join(', ')}`)
}

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

const named = new Set([...OUTSIDE_GATES, ...COVERAGE_ONLY])

// 変異テストの対象か(リポジトリ直下からの '/' 区切りのパスで判定する)
const isMutationTarget = file =>
  IN_PURE_DIR.test(file) && !NOT_MODULE.test(file) && !named.has(file)

// 自己検査の失敗。どの検査が何に外れたかを添えて落とす
const failSelfCheck = (what, items) => {
  if (items.length > 0) {
    throw new Error(`scripts/gate-targets.mjs: 自己検査に失敗(${what}): ${items.join(', ')}`)
  }
}

failSelfCheck(
  '規則の判定が期待と違うパス → 期待',
  RULE_CASES.filter(([file, expected]) => isMutationTarget(file) !== expected).map(
    ([file, expected]) => `${file} → ${expected}`
  )
)
failSelfCheck(
  '値の宣言の判定が期待と違う行 → 期待',
  DECLARATION_CASES.filter(([code, expected]) => RUNTIME_DECLARATION.test(code) !== expected).map(
    ([code, expected]) => `${code} → ${expected}`
  )
)

const SRC_FILES = walk(SRC_DIR).map(file => toPosix(path.relative(ROOT, file)))

export const MUTATION_TARGETS = SRC_FILES.filter(isMutationTarget).sort()

// 1件も拾えないときは、対象が無いのではなく見る場所を間違えている。門が空のまま通らないよう落とす
if (MUTATION_TARGETS.length === 0) {
  throw new Error(
    'scripts/gate-targets.mjs: 変異テストの対象が1件も無い。src の場所か規則を疑うこと'
  )
}

export const COVERAGE_TARGETS = [...MUTATION_TARGETS, ...COVERAGE_ONLY].sort()

failSelfCheck(
  '変異テストの対象に入っていない',
  MUST_INCLUDE.filter(file => !MUTATION_TARGETS.includes(file))
)
failSelfCheck(
  '門の対象から外れていない',
  MUST_EXCLUDE.filter(file => COVERAGE_TARGETS.includes(file))
)
failSelfCheck(
  '置き場の件数が下限を割った 置き場 件数 < 下限',
  FLOORS.flatMap(([dir, floor]) => {
    const count = MUTATION_TARGETS.filter(file => file.startsWith(dir)).length
    return count < floor ? [`${dir} ${count} < ${floor}`] : []
  })
)
failSelfCheck(
  'types.ts に値の宣言がある。型以外は別の名前のファイルへ移すこと',
  SRC_FILES.filter(
    file =>
      IN_PURE_DIR.test(file) &&
      path.posix.basename(file) === 'types.ts' &&
      RUNTIME_DECLARATION.test(readFileSync(path.join(ROOT, file), 'utf8'))
  )
)
