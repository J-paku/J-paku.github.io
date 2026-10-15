import { defineConfig, configDefaults } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { globSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import nextConfig from './next.config'

// 画面(コンテナ)の props は node でしか組めない(fs・zlib・crypto を使う)ので、各コンテナの隣の container.fixture.ts が
// テストの前に node で組んで provide する。コンテナを足すたびにここを直さずに済むよう、src の下から全部拾う。
// 置けるのはコンテナの一覧(scripts/container-dirs.mjs)のフォルダだけで、ほかに置くと npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とす(ここは全部拾うので、黙って走らせないため)。
// 探す起点はこのファイルの場所にする(走らせた場所で拾う物が変わらないように)。順は名前で並べて、走るたびに揃える
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const CONTAINER_FIXTURES = globSync('src/**/container.fixture.ts', { cwd: ROOT })
  .sort()
  .map(file => fileURLToPath(new URL(file, import.meta.url)))
// 1 つも拾えないと globalSetup が空のまま進み、テストの inject が undefined を受けて分かりにくい所で落ちる。
// パターンや起点の誤りで黙って 0 個になるのを、設定を読む時点で止める
if (CONTAINER_FIXTURES.length === 0) {
  throw new Error(`src の下に container.fixture.ts が 1 つも見つからない(探した起点: ${ROOT})`)
}

// フックはファイルごとに、文・分岐・関数・行のすべてを100%にする(docs/decisions/0018-move-e2e-and-gate-all-hooks.md)。
// 対象は src の下の hooks フォルダの全部(src/hooks/ を含む)。一覧を手で並べず設定を読むたびに拾うので、新しいフックは置いた時点で対象になる。
// Vitest の thresholds の perFile は glob ごとには分けられず、上の全体の床までファイル別にしてしまう
// (node_modules/vitest の coverage の checkThresholds が thresholds.perFile だけを見る。4.1.10 で確認)。
// そこでファイルのパスを1つずつ glob として並べてファイル別にする(単体の vitest.config.ts の COVERAGE_TARGETS と同じ形)。
// パスは起点からの '/' 区切り。Vitest は glob を root からの相対パスに当てる(root は走らせた場所で、npm run の入口ではこのファイルの場所)
const HOOK_FILES = globSync('src/**/hooks/**/*.{ts,tsx}', { cwd: ROOT })
  .map(file => file.split(path.sep).join('/'))
  .sort()
// 1 つも拾えないと門が黙って空になる。パターンや起点の誤りを、設定を読む時点で止める
if (HOOK_FILES.length === 0) {
  throw new Error(`src の下の hooks フォルダにフックが 1 つも見つからない(探した起点: ${ROOT})`)
}
// 1ファイルを文・分岐・関数・行のすべてで100%に固定するしきい値(単体の vitest.config.ts の FULL_COVERAGE と同じ)
const FULL_COVERAGE = { statements: 100, branches: 100, functions: 100, lines: 100 }

// 統合テストの名前(test.include)と、カバレッジで測る物・外す物。下の検査と test・coverage の設定が同じ一覧を使う
const INTEGRATION_TESTS = ['src/**/container.browser.test.tsx']
const COVERAGE_INCLUDE = ['src/**/*.{ts,tsx}']
const COVERAGE_EXCLUDE = [
  'src/**/*.test.{ts,tsx}',
  'src/**/*.fixture.ts',
  'src/**/*.test-helper.ts',
]
// フックが1つ残らずカバレッジで測られることを、設定を読む時点で確かめる。thresholds の glob に当たるファイルがカバレッジの表に無いと、
// Vitest は空の表を100%と数えて黙って通す。exclude に掛かる名前のフック(hooks/ の下の *.fixture.ts など)は、ファイル別100%の門を素通りする。
// 当て方は Vitest と同じにする: coverage の include に当たり、exclude と test.include(Vitest が exclude へ足す)に当たらない物だけを測る。
// Vitest は picomatch を contains・dot 付きで絶対パスへ当てる(node_modules/vitest の coverage の isIncluded。4.1.10 で確認)。
// contains は前後を固定しないので、'src/**/*.fixture.ts' は x.fixture.tsx にも当たる(node:path の matchesGlob では拾えない)。
// picomatch は Vitest の依存(型は入っていない)なので createRequire で読み、使う形だけを型に書く
type Matcher = (
  glob: string[],
  options: { contains: boolean; dot: boolean; ignore: string[] }
) => (file: string) => boolean
const picomatch: Matcher = createRequire(import.meta.url)('picomatch')
const isCovered = picomatch(COVERAGE_INCLUDE, {
  contains: true,
  dot: true,
  ignore: [...COVERAGE_EXCLUDE, ...INTEGRATION_TESTS],
})
const UNCOVERED_HOOKS = HOOK_FILES.filter(
  file => !isCovered(path.join(ROOT, file).split(path.sep).join('/'))
)
if (UNCOVERED_HOOKS.length > 0) {
  throw new Error(
    `カバレッジの include から外れるか exclude に掛かるフックがある(ファイル別100%の門を黙って素通りする): ${UNCOVERED_HOOKS.join(', ')}。` +
      'フックの名前を exclude に掛からない名前にするか、テストの部品なら hooks フォルダの外へ移す(ADR 0018)'
  )
}

// 統合テスト(Vitest Browser Mode)の設定。画面単位のコンポーネントを実際の Chromium で、ビルド無しで描く
// (docs/decisions/0016-testing-trophy-browser-integration.md)。
// 単体の vitest.config.ts と別のファイルにするのは、変異テスト(stryker.config.mjs)が vitest.config.ts を読むため。
// Stryker の Browser Mode 対応は未実測なので、変異テストは node と happy-dom の単体だけで回す(ADR 0016)。
// 単体の設定は *.browser.test.{ts,tsx} を exclude で外し、ここはコンテナの隣の container.browser.test.tsx だけを拾う(ADR 0017 の D5)。
// ほかの名前の *.browser.test.ts・*.browser.test.tsx はどちらの設定にも拾われないが、npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とすので、走らないまま黙って残ることは無い
export default defineConfig({
  // next/link などは Next のビルドが process.env.X を値へ置き換える前提で書かれていて、ブラウザには process が無い。
  // ここで process.env の中身を決める。中身は Next のビルドが next.config から入れる値のうち、テストの結果に表れるものだけ:
  //   __NEXT_TRAILING_SLASH: next.config の trailingSlash(next/dist/build/define-env.js と同じ元)。無いと next/link が
  //   href の末尾のスラッシュを落とし、配信物と違う href になる
  // 先に束ねた依存(next/link)の中の process.env.X はこの置き換えを受けない。それでも効くのは、Vite がブラウザで最初に読む
  // /@vite/env(vite/dist/client/env.mjs)が define の値を globalThis.process.env へ書き、束の中の process.env.X が
  // 実行時にそれを読むため(2026-10-14 の実測。テストごとに process を差し替えなくてよい)
  define: {
    'process.env': JSON.stringify({ __NEXT_TRAILING_SLASH: nextConfig.trailingSlash }),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
      // 下の globalSetup が node で content を読む(src/lib/content/read.ts)。server-only は react-server 以外の
      // 条件では import しただけで投げるので、中身の無い版(パッケージ同梱の empty.js)へ向ける。単体テストの vi.mock と同じ扱い
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: INTEGRATION_TESTS,
    exclude: [...configDefaults.exclude, '**/.claude/**', 'tests/**'],
    // 上で拾った container.fixture.ts を、テストの前に node で走らせる
    globalSetup: CONTAINER_FIXTURES,
    // 落ちた時の画面の写しは、既定だとテストの隣(src の中)とリポジトリ直下に出る。git が無視する test-results/ へ寄せる
    attachmentsDir: 'test-results/vitest-attachments',
    browser: {
      enabled: true,
      // 既定は process.env.CI なので、手元(WSL)で窓を開こうとしないよう明示する
      headless: true,
      // TZ=UTC(package.json の scripts と vitest.config.ts の env)は node のプロセスにしか効かない。
      // ブラウザの時間帯は context で別に固定し、機器の時間帯に結果を左右させない
      provider: playwright({ contextOptions: { timezoneId: 'UTC' } }),
      instances: [{ browser: 'chromium' }],
      screenshotDirectory: 'test-results/vitest-screenshots',
    },
    // 測るのは --coverage を付けたときだけ。フックもここで測る(単体の設定はフックを外す)。
    // フックは全部をファイル別100%で固める(上の HOOK_FILES。ADR 0018)。統合テストで構造上届かない行(E2E だけが作れる場合)だけを、
    // その行を見ている E2E を名指しする注釈 `/* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */` で外し、
    // 名指しした E2E が実在するかを npm run test:boundary(scripts/check-coverage-ignores.mjs)が確かめる
    coverage: {
      provider: 'v8',
      enabled: false,
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
      reporter: ['text-summary'],
      reportsDirectory: 'coverage/integration',
      // 2026-10-15の実測(statements 76.55%・branches 79.21%・functions 77.03%・lines 77.81%)から2pt引いて切り捨てた値。
      // 測る対象は src の全部で、統合テストが通らない純粋モジュール(単体の門で100%に固めている)も分母に入るので低く見える。
      // 目標値ではなく、統合テストを消したり使われないコードを増やしたりしたときに落とすための床(ADR 0017)
      thresholds: {
        statements: 74,
        branches: 77,
        functions: 75,
        lines: 75,
        // フックのファイル別100%(一覧は上の HOOK_FILES)
        ...Object.fromEntries(HOOK_FILES.map(file => [file, FULL_COVERAGE])),
      },
    },
  },
})
