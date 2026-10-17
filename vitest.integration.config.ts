import { defineConfig, configDefaults } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { globSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import nextConfig from './next.config'

// 画面(コンテナ)の props は node でしか組めない(fs・zlib・crypto を使う)ので、I/O コンテナの単位フォルダ(__tests__/<unit>/)の
// container.fixture.ts がテストの前に node で組んで provide する。コンテナを足すたびにここを直さずに済むよう、__tests__ の下から全部拾う。
// 置けるのは単位フォルダの直下だけで、ほかに置くと npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とす(ここは全部拾うので、黙って走らせないため。docs/decisions/0019-hooks-make-containers.md)。
// 探す起点はこのファイルの場所にする(走らせた場所で拾う物が変わらないように)。順は名前で並べて、走るたびに揃える
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const CONTAINER_FIXTURES = globSync('__tests__/**/container.fixture.ts', { cwd: ROOT })
  .sort()
  .map(file => fileURLToPath(new URL(file, import.meta.url)))
// 1 つも拾えないと globalSetup が空のまま進み、テストの inject が undefined を受けて分かりにくい所で落ちる。
// パターンや起点の誤りで黙って 0 個になるのを、設定を読む時点で止める
if (CONTAINER_FIXTURES.length === 0) {
  throw new Error(
    `__tests__ の下に container.fixture.ts が 1 つも見つからない(探した起点: ${ROOT})`
  )
}

// フックとコンテナはファイルごとに、文・分岐・関数・行のすべてを100%にする
// (フックは docs/decisions/0018-move-e2e-and-gate-all-hooks.md、コンテナは docs/decisions/0019-hooks-make-containers.md)。
// 対象は src の下の hooks フォルダの全部(src/hooks/ を含む)と、src の下の container.tsx の全部(I/O コンテナも状態コンテナも)。
// 一覧を手で並べず設定を読むたびに拾うので、新しいフック・コンテナは置いた時点で対象になる。表示部品は下の全体の床にだけ入る。
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
const CONTAINER_FILES = globSync('src/**/container.tsx', { cwd: ROOT })
  .map(file => file.split(path.sep).join('/'))
  .sort()
if (CONTAINER_FILES.length === 0) {
  throw new Error(`src の下に container.tsx が 1 つも見つからない(探した起点: ${ROOT})`)
}
const PER_FILE_TARGETS = [...HOOK_FILES, ...CONTAINER_FILES]
// 1ファイルを文・分岐・関数・行のすべてで100%に固定するしきい値(単体の vitest.config.ts の FULL_COVERAGE と同じ)
const FULL_COVERAGE = { statements: 100, branches: 100, functions: 100, lines: 100 }

// 統合テストの名前(test.include)と、カバレッジで測る物・外す物。下の検査と test・coverage の設定が同じ一覧を使う
const INTEGRATION_TESTS = ['__tests__/**/*.integration.test.tsx']
const COVERAGE_INCLUDE = ['src/**/*.{ts,tsx}']
const COVERAGE_EXCLUDE = [
  'src/**/*.test.{ts,tsx}',
  'src/**/*.fixture.ts',
  'src/**/*.test-helper.ts',
]
// フックとコンテナが1つ残らずカバレッジで測られることを、設定を読む時点で確かめる。thresholds の glob に当たるファイルがカバレッジの表に無いと、
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
const isUncovered = (file: string) => !isCovered(path.join(ROOT, file).split(path.sep).join('/'))
const UNCOVERED_HOOKS = HOOK_FILES.filter(isUncovered)
if (UNCOVERED_HOOKS.length > 0) {
  throw new Error(
    `カバレッジの include から外れるか exclude に掛かるフックがある(ファイル別100%の門を黙って素通りする): ${UNCOVERED_HOOKS.join(', ')}。` +
      'フックの名前を exclude に掛からない名前にするか、テストの部品なら hooks フォルダの外へ移す(ADR 0018)'
  )
}
const UNCOVERED_CONTAINERS = CONTAINER_FILES.filter(isUncovered)
if (UNCOVERED_CONTAINERS.length > 0) {
  throw new Error(
    `カバレッジの include から外れるか exclude に掛かるコンテナがある(ファイル別100%の門を黙って素通りする): ${UNCOVERED_CONTAINERS.join(', ')}。` +
      'コンテナ(container.tsx)を exclude に掛からない場所へ置く(ADR 0019)'
  )
}

// 統合テストとして拾わない物。下の instances の 1 つ目(タッチの模擬を使わないファイル)は、これにタッチのファイルを足して外す
const TEST_EXCLUDE = [...configDefaults.exclude, '**/.claude/**', 'tests/**']

// タッチの模擬(CDP の Emulation.setTouchEmulationEnabled)を使うファイルは、1 ファイルずつ自分だけのページで走らせる。
// Vitest はブラウザのページ(セッション)をファイルをまたいで使い回し、ファイルごとに作り直すのは中の iframe だけ
// (node_modules/vitest の BrowserPool。4.1.10 で確認)。CDP で替えた環境はページ全体に掛かるので、次のファイルへ持ち越す。
// 動きを控える設定(setEmulatedMedia)は features を空で送れば開いた時の値へ戻るが、タッチの模擬は一度入れると、切っても
// pointer・hover が開いた時の fine・hover へ戻らず none のまま残る(2026-10-17 の実測。入れる前は fine・hover、入れると coarse・none、
// 切ると none・none。切った後に setEmitTouchEventsForMouse・setDeviceMetricsOverride と clearDeviceMetricsOverride・
// setEmulatedMedia の pointer と hover・Page.setTouchEmulationEnabled などを送っても none のまま)。
// 同じページで後に走るファイルは、(hover: hover) and (pointer: fine) で出し分ける CSS(一覧のカードなど)をタッチ端末の形で描いてしまう。
// そこで、タッチの模擬を使うファイルにはそれぞれ別のブラウザの instance を割り当て、ほかのファイルとページを共にさせない。
// instance は Vitest の project として数えられ、それぞれのブラウザを開き、globalSetup(上の CONTAINER_FIXTURES)も走らせる。
// どのファイルが使うかは、ファイルが emulateTouch(__tests__/village-page/village-walk.test-helper.ts)の名前を書いているかで拾う。
// 名前を書かずに別の部品から呼ぶと拾えないので、emulateTouch は名前が TOUCH_PROJECT_PREFIX で始まる instance の外では投げる
const TOUCH_PROJECT_PREFIX = 'touch:'
const TOUCH_TESTS = globSync(INTEGRATION_TESTS, { cwd: ROOT, exclude: TEST_EXCLUDE })
  .map(file => file.split(path.sep).join('/'))
  .filter(file => /\bemulateTouch\b/.test(readFileSync(path.join(ROOT, file), 'utf8')))
  .sort()
// instance の名前(テストの結果の行頭に出る)。__tests__/ と .integration.test.tsx を落とした残り
const touchProjectName = (file: string) =>
  TOUCH_PROJECT_PREFIX + file.replace(/^__tests__\//, '').replace(/\.integration\.test\.tsx$/, '')

// キーを押したまま待って離す手。村の統合テストが rAF の本物の時に使う(__tests__/village-page/village-walk.test-helper.ts の press・tapHeld)。
// 押す・待つ・離すを node の側でまとめて行い、E2E(tests/village.helpers.ts の press)と同じく node の時計で待つ。
// テストの iframe の中で待ってから離すと、離す指示が iframe から Vitest(node)・Playwright を回って Chromium へ届くまでの遅れが
// 押す長さに足される。負荷が高いと 1 マス分(150ms)のつもりの押下が 1 マスの歩行(256ms)より長く続き、次のマスまで歩いた
// (2026-10-17 の実測。2 コアに 8 ページで全体を回し、keydown から keyup までをテストの iframe で測ると、
// iframe の中で待つ形は中央 233ms・最長 915ms で、卓上時計の前へ歩く 16 回のうち 6 回が 1〜2 マス行き過ぎた。
// node の側で待つ形は中央 185ms・最長 451ms で、13 回とも行き過ぎなかった)。
// 待ち方は ms(node の時計で待つ)か frames(テストの iframe の rAF を数える。rAF を偽の時計に載せていない時だけ使える)
type Hold = { ms: number } | { frames: number }
// 待つ間に落ちても(テストの iframe が外れたなど)押したままにせず、必ず離す。
// Vitest が userEvent で押したままのキーを離すのは各テストの前とファイルの終わりだけで(node_modules/@vitest/browser の tester の
// onBeforeTryTask・cleanup が呼ぶ userEvent.cleanup)、ここで押したキーはその数に入らない
const holdKey: BrowserCommand<[key: string, hold: Hold]> = async ({ page, frame }, key, hold) => {
  await page.keyboard.down(key)
  try {
    if ('ms' in hold) {
      await new Promise(resolve => setTimeout(resolve, hold.ms))
    } else {
      const tester = await frame()
      await tester.evaluate(
        count =>
          new Promise<void>(resolve => {
            const next = (left: number) => {
              if (left === 0) resolve()
              else requestAnimationFrame(() => next(left - 1))
            }
            next(count)
          }),
        hold.frames
      )
    }
  } finally {
    await page.keyboard.up(key)
  }
}

// 統合テスト(Vitest Browser Mode)の設定。画面単位のコンポーネントを実際の Chromium で、ビルド無しで描く
// (docs/decisions/0016-testing-trophy-browser-integration.md)。
// 単体の vitest.config.ts と別のファイルにするのは、変異テスト(stryker.config.mjs)が vitest.config.ts を読むため。
// Stryker の Browser Mode 対応は未実測なので、変異テストは node と happy-dom の単体だけで回す(ADR 0016)。
// 単体の設定は __tests__ と *.integration.test.{ts,tsx} を exclude で外し、ここはリポジトリ直下の __tests__ の *.integration.test.tsx だけを拾う(ADR 0019)。
// ほかの場所・名前の統合テスト(src の下・*.integration.test.ts・もとの名前の *.browser.test.*)はどちらの設定にも拾われないが、
// npm run test:boundary(scripts/check-test-boundary.mjs)が落とすので、走らないまま黙って残ることは無い
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
    exclude: TEST_EXCLUDE,
    // 上で拾った container.fixture.ts を、テストの前に node で走らせる
    globalSetup: CONTAINER_FIXTURES,
    // 落ちた時の画面の写しは、既定だとテストの隣(__tests__ の中)とリポジトリ直下に出る。git が無視する test-results/ へ寄せる
    attachmentsDir: 'test-results/vitest-attachments',
    browser: {
      enabled: true,
      // 既定は process.env.CI なので、手元(WSL)で窓を開こうとしないよう明示する
      headless: true,
      // TZ=UTC(package.json の scripts と vitest.config.ts の env)は node のプロセスにしか効かない。
      // ブラウザの時間帯は context で別に固定し、機器の時間帯に結果を左右させない
      provider: playwright({ contextOptions: { timezoneId: 'UTC' } }),
      // 1 つ目はタッチの模擬を使わないファイルの全部で、ページを使い回す。続きはタッチの模擬を使うファイル 1 つずつ
      // (上の TOUCH_TESTS)。instance の exclude・include は親の値を足し込まず置き換える
      // (node_modules/vitest の cloneConfig。4.1.10 で確認)ので、1 つ目は TEST_EXCLUDE ごと書く
      instances: [
        { browser: 'chromium', exclude: [...TEST_EXCLUDE, ...TOUCH_TESTS] },
        ...TOUCH_TESTS.map(file => ({
          browser: 'chromium' as const,
          name: touchProjectName(file),
          include: [file],
        })),
      ],
      screenshotDirectory: 'test-results/vitest-screenshots',
      // テストから commands.holdKey で呼ぶ(上の holdKey の注)
      commands: { holdKey },
    },
    // 測るのは --coverage を付けたときだけ。フックとコンポーネントもここで測る(単体の設定はフックと components の .tsx を外す)。
    // フックとコンテナは全部をファイル別100%で固める(上の HOOK_FILES・CONTAINER_FILES。ADR 0018・0019)。統合テストで構造上届かない行(E2E だけが作れる場合)だけを、
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
        // フックとコンテナのファイル別100%(一覧は上の HOOK_FILES・CONTAINER_FILES)
        ...Object.fromEntries(PER_FILE_TARGETS.map(file => [file, FULL_COVERAGE])),
      },
    },
  },
})
