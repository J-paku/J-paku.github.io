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
// 返すパスはリポジトリ直下からの '/' 区切りで、並べ替え済み。
//
// 使い方: import { MUTATION_TARGETS, COVERAGE_TARGETS } from './scripts/gate-targets.mjs'
import { existsSync, readdirSync, statSync } from 'node:fs'
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
  // 振る舞いは守れない。専用のテストも持たず、ADR 0011 の門でも対象外だった(ファイル別100%で固めるかは決めていない)
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

// 名指しが空振りしていないか、読み込む時点で確かめる
const missing = [...OUTSIDE_GATES, ...COVERAGE_ONLY].filter(
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

export const MUTATION_TARGETS = walk(SRC_DIR)
  .map(file => toPosix(path.relative(ROOT, file)))
  .filter(file => IN_PURE_DIR.test(file) && !NOT_MODULE.test(file) && !named.has(file))
  .sort()

// 1件も拾えないときは、対象が無いのではなく見る場所を間違えている。門が空のまま通らないよう落とす
if (MUTATION_TARGETS.length === 0) {
  throw new Error(
    'scripts/gate-targets.mjs: 変異テストの対象が1件も無い。src の場所か規則を疑うこと'
  )
}

export const COVERAGE_TARGETS = [...MUTATION_TARGETS, ...COVERAGE_ONLY].sort()
