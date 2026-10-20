import { defineConfig, configDefaults } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { globSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import nextConfig from './next.config'
import unitConfig from './vitest.config'
import { findBrowserCode } from './scripts/find-browser-code.mjs'

// 画面(コンテナ)の props は node でしか組めない(fs・zlib・crypto を使う)ので、I/O コンテナのフォルダの
// index.fixture.ts(そのフォルダの __tests__/ の中か、index.tsx の隣)がテストの前に node で組んで provide する。
// コンテナを足すたびにここを直さずに済むよう、src の下から全部拾う。
// 置けるのは I/O コンテナの6つ(scripts/container-dirs.mjs)のフォルダだけで、ほかに置くと npm run test:boundary
// (scripts/check-test-boundary.mjs)が落とす(ここは全部拾うので、黙って走らせないため。ADR 0022)。
// 探す起点はこのファイルの場所にする(走らせた場所で拾う物が変わらないように)。順は名前で並べて、走るたびに揃える
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const CONTAINER_FIXTURES = globSync('src/**/index.fixture.ts', { cwd: ROOT })
  .sort()
  .map(file => fileURLToPath(new URL(file, import.meta.url)))
// 1 つも拾えないと globalSetup が空のまま進み、テストの inject が undefined を受けて分かりにくい所で落ちる。
// パターンや起点の誤りで黙って 0 個になるのを、設定を読む時点で止める
if (CONTAINER_FIXTURES.length === 0) {
  throw new Error(`src の下に index.fixture.ts が 1 つも見つからない(探した起点: ${ROOT})`)
}

// フックとコンポーネント(コンテナと表示部品)はファイルごとに、文・分岐・関数・行のすべてを100%にする
// (フックは docs/decisions/0018-move-e2e-and-gate-all-hooks.md、コンテナは docs/decisions/0019-hooks-make-containers.md、
// 表示部品は docs/decisions/0022-colocate-integration-tests.md、コンテナと表示部品を index.tsx に揃えたのは ADR 0024)。
// 対象は src の下の hooks フォルダの全部(src/hooks/ を含む)と、src/components の下の .tsx の全部(テストの側を除く)。
// コンテナ(フックを使う index.tsx と I/O コンテナの index.tsx)も表示部品(フックを使わない index.tsx)も同じ門に入るので、ここではどちらかを分けない
// (分けるのは scripts/find-containers.mjs で、テストの置き場の検査が使う)。
// 画面の3つのサーバのローダーは src/app/<名前>-screen.tsx にあり(ビルドの時に node で content を読むだけで、ブラウザでは測れない)、
// src/app/ のほかのファイルと同じく、この設定のカバレッジの分母に入らない(単体の vitest.config.ts が測る。下の COVERAGE_INCLUDE)。
// src/components の中にローダーを戻す(content を読む I/O コンテナ)と npm run test:boundary(scripts/check-layers.mjs の規則 6)が落とす。
// 一覧を手で並べず設定を読むたびに拾うので、新しいフック・コンテナ・表示部品は置いた時点で対象になる。
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
// src/components の下の .tsx のうち、テストの側(*.test.tsx と __tests__/ の中)でない物の全部。コンテナと表示部品がここに入る
const COMPONENT_FILES = globSync('src/components/**/*.tsx', {
  cwd: ROOT,
  exclude: ['src/components/**/*.test.tsx', 'src/components/**/__tests__/**'],
})
  .map(file => file.split(path.sep).join('/'))
  .sort()
// 1 つも拾えないと門が黙って空になる。パターンや起点の誤りを、設定を読む時点で止める
if (COMPONENT_FILES.length === 0) {
  throw new Error(`src/components の下にコンポーネントが 1 つも見つからない(探した起点: ${ROOT})`)
}
const PER_FILE_TARGETS = [...HOOK_FILES, ...COMPONENT_FILES]
// 1ファイルを文・分岐・関数・行のすべてで100%に固定するしきい値(単体の vitest.config.ts の FULL_COVERAGE と同じ)
const FULL_COVERAGE = { statements: 100, branches: 100, functions: 100, lines: 100 }

// 統合テストの名前(test.include)と、カバレッジで測る物・外す物。下の検査と test・coverage の設定が同じ一覧を使う。
// 統合テストはコンテナのフォルダ(コンテナの index.tsx の隣か、そのフォルダの __tests__/ の中)に置く(ADR 0022・ADR 0024)
const INTEGRATION_TESTS = ['src/**/*.integration.test.tsx']
// テストの側の物(統合テスト・テストの部品・フィクスチャ)も src の中にあるので、測る物から外して分母に入れない。
// *.test.{ts,tsx} は統合テスト(*.integration.test.tsx)にも当たる。__tests__/ の中はテストの側の物だけを置く所なので、名前を問わず外す
const COVERAGE_EXCLUDE = [
  'src/**/*.test.{ts,tsx}',
  'src/**/*.fixture.ts',
  'src/**/*.test-helper.ts',
  'src/**/__tests__/**',
]
// カバレッジで測る物の判定は Vitest と同じ当て方にする: coverage の include に当たり、exclude と test.include(Vitest が exclude へ足す)に当たらない物だけを測る。
// Vitest は picomatch を contains・dot 付きで絶対パスへ当てる(node_modules/vitest の coverage の isIncluded。4.1.10 で確認)。
// contains は前後を固定しないので、'src/**/*.fixture.ts' は x.fixture.tsx にも、'src/a.ts' は src/a.tsx にも当たる(node:path の matchesGlob では拾えない)。
// picomatch は Vitest の依存(型は入っていない)なので createRequire で読み、使う形だけを型に書く
type Matcher = (
  glob: string[],
  options: { contains: boolean; dot: boolean; ignore: string[] }
) => (file: string) => boolean
const picomatch: Matcher = createRequire(import.meta.url)('picomatch')
// include・exclude から、起点からの '/' 区切りのパスを測るかの判定を作る
const coverageMatcher = (include: string[], exclude: string[]) => {
  const matches = picomatch(include, { contains: true, dot: true, ignore: exclude })
  return (file: string) => matches(path.join(ROOT, file).split(path.sep).join('/'))
}
// src のコードのファイルの全部と、そのうちテストの側でない物(どちらかの設定で測るべき物)の判定
const SRC_CODE = ['src/**/*.{ts,tsx}']
const SRC_CODE_FILES = globSync(SRC_CODE, { cwd: ROOT })
  .map(file => file.split(path.sep).join('/'))
  .sort()
const isProductCode = coverageMatcher(SRC_CODE, [...COVERAGE_EXCLUDE, ...INTEGRATION_TESTS])

// 分母はブラウザで動くコードだけにする(ADR 0026)。統合テストはコンテナを実際の Chromium で描くので、ブラウザで読み込まれるのは、
// src/components の index.tsx とフック(hooks フォルダの use-*.ts(x))から実行時の import でたどって届くファイルだけ。
// 届かないファイル(src/app の全部・content の読み出し・スプライトの合成・props の組み立てなど。画面の props は上の index.fixture.ts が node で組む)は
// どの統合テストも通れないので分母に入れず、単体の vitest.config.ts が測る(下の UNMEASURED の検査で、どちらでも測らないファイルを残さない)。
// 入口とたどり方の正本は scripts/find-browser-code.mjs で、手で並べず設定を読むたびに求める(たどれない import があればそこで投げる)
const BROWSER_CODE = findBrowserCode(ROOT)
// 入口が1つも無いと分母が空になり、Vitest は空の表を100%と数えて黙って通す。入口の判定や起点の誤りを、設定を読む時点で止める
if (BROWSER_CODE.entries.length === 0) {
  throw new Error(
    `ブラウザで動くコードの入口(src/components の index.tsx・hooks フォルダの use-*.ts(x))が 1 つも見つからない(探した起点: ${ROOT})`
  )
}
const BROWSER_FILES = BROWSER_CODE.files.filter(isProductCode)
if (BROWSER_FILES.length === 0) {
  throw new Error(
    `入口から届く、テストの側でない src のコードのファイルが 1 つも無い(入口 ${BROWSER_CODE.entries.length} 個。探した起点: ${ROOT})`
  )
}
const BROWSER_FILE_SET = new Set(BROWSER_FILES)
// ファイルのパスをそのまま glob にする。glob で意味を持つ文字は前に \ を付けて文字として当てる
// (今の分母の道には無いが、ルートグループの (ja) や [slug] のような名前のフォルダが分母に入っても取り違えない)
const COVERAGE_INCLUDE = BROWSER_FILES.map(file => file.replace(/[\\*?[\]{}()!+@]/g, '\\$&'))
const isCovered = coverageMatcher(COVERAGE_INCLUDE, [...COVERAGE_EXCLUDE, ...INTEGRATION_TESTS])
// include をファイルのパスで並べても、contains は前後を固定しないので、名前の後ろに文字を足しただけの別のファイル(a.ts に対する a.tsx など)にも当たる。
// Vitest と同じ当て方で、src のコードのファイルの全部について「測る」と「ブラウザで動くコード」がぴったり重なるかを確かめる
const MISMATCHED = SRC_CODE_FILES.filter(file => isCovered(file) !== BROWSER_FILE_SET.has(file))
if (MISMATCHED.length > 0) {
  throw new Error(
    `カバレッジの include・exclude で測る物が、ブラウザで動くコード(scripts/find-browser-code.mjs)と食い違う: ${MISMATCHED.join(', ')}。` +
      '名前の後ろに文字を足しただけの別のファイル(a.ts に対する a.tsx など)が無いか、glob で意味を持つ文字を文字として当てているかを見る'
  )
}
// どちらの設定でも測らないファイルを残さない(ADR 0026)。ブラウザで動かないコードは、単体の vitest.config.ts の coverage に入っていなければならない。
// 単体の側の判定も Vitest と同じ当て方にし、include・exclude・test.include はその設定から読む(ここに書き写さない)
const UNIT_TEST = unitConfig.test
const UNIT_COVERAGE = UNIT_TEST?.coverage
if (UNIT_COVERAGE?.include === undefined) {
  throw new Error(
    '単体の設定(vitest.config.ts)の test.coverage.include を読めない。どちらの設定でも測らないファイルが無いかを確かめられない'
  )
}
const isUnitCovered = coverageMatcher(UNIT_COVERAGE.include, [
  ...(UNIT_COVERAGE.exclude ?? []),
  ...(UNIT_TEST?.include ?? []),
])
const UNMEASURED = SRC_CODE_FILES.filter(
  file => isProductCode(file) && !isCovered(file) && !isUnitCovered(file)
)
if (UNMEASURED.length > 0) {
  throw new Error(
    `統合の分母(ブラウザで動くコード)にも単体の設定(vitest.config.ts)の coverage にも入らないファイルがある(どちらの100%の門も通らない): ${UNMEASURED.join(', ')}。` +
      'ブラウザで動くなら入口から import で届くようにし、node でしか動かないなら単体の設定の coverage で測る(ADR 0026)'
  )
}
// フックとコンポーネント(コンテナと表示部品)が1つ残らずカバレッジで測られることも確かめる。thresholds の glob に当たるファイルがカバレッジの表に無いと、
// Vitest は空の表を100%と数えて黙って通す。exclude に掛かる名前のフック(hooks/ の下の *.fixture.ts など)や表示部品(*.fixture.tsx など)は、
// ファイル別100%の門を素通りする(入口から import で届かないフック・コンポーネントは、単体の設定も hooks/ と components の .tsx を外すので、上の UNMEASURED が先に落とす)
const isUncovered = (file: string) => !isCovered(file)
const UNCOVERED_HOOKS = HOOK_FILES.filter(isUncovered)
if (UNCOVERED_HOOKS.length > 0) {
  throw new Error(
    `カバレッジの include から外れるか exclude に掛かるフックがある(ファイル別100%の門を黙って素通りする): ${UNCOVERED_HOOKS.join(', ')}。` +
      'フックの名前を exclude に掛からない名前にするか、テストの部品なら hooks フォルダの外へ移す(ADR 0018)'
  )
}
const UNCOVERED_COMPONENTS = COMPONENT_FILES.filter(isUncovered)
if (UNCOVERED_COMPONENTS.length > 0) {
  throw new Error(
    `カバレッジの include から外れるか exclude に掛かるコンポーネント(コンテナ・表示部品)がある(ファイル別100%の門を黙って素通りする): ${UNCOVERED_COMPONENTS.join(', ')}。` +
      'コンポーネントの名前を exclude に掛からない名前にするか、テストの部品なら決まった名前(*.test-helper.ts・*.fixture.ts)と置き場に合わせる(ADR 0022・ADR 0024)'
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
// どのファイルが使うかは、ファイルが emulateTouch(src/components/VillagePage/__tests__/village-walk.test-helper.ts)の名前を書いているかで拾う。
// 名前を書かずに別の部品から呼ぶと拾えないので、emulateTouch は名前が TOUCH_PROJECT_PREFIX で始まる instance の外では投げる
const TOUCH_PROJECT_PREFIX = 'touch:'
const TOUCH_TESTS = globSync(INTEGRATION_TESTS, { cwd: ROOT, exclude: TEST_EXCLUDE })
  .map(file => file.split(path.sep).join('/'))
  .filter(file => /\bemulateTouch\b/.test(readFileSync(path.join(ROOT, file), 'utf8')))
  .sort()
// instance の名前(テストの結果の行頭に出る)。src/components/ と .integration.test.tsx を落とした残り
const touchProjectName = (file: string) =>
  TOUCH_PROJECT_PREFIX +
  file.replace(/^src\/components\//, '').replace(/\.integration\.test\.tsx$/, '')

// rAF が本物の時に村の統合テストがキーを押す手(src/components/VillagePage/__tests__/village-walk.test-helper.ts の press・walk・tapHeld)。
// 押す・待つ・離すを node の側でまとめて行い、待つ間はテストの iframe の中で見る(tester.evaluate に渡す関数は文字列にして送られるので、
// 外の名前を使わず、引数と iframe の大域だけで書く。渡せるのも直列化できる値だけ)。
// 決めた時間だけ待って離す形(E2E の tests/village.helpers.ts の press と同じく node の時計で HOLD_MS)は、負荷の高い時に歩行ループが見る
// フレームとずれたのでやめた(数字は village-walk.test-helper.ts の holdUntilStep の注)。
// 待つ間に落ちても(テストの iframe が外れたなど)押したままにせず、必ず離す。
// Vitest が userEvent で押したままのキーを離すのは各テストの前とファイルの終わりだけで(node_modules/@vitest/browser の tester の
// onBeforeTryTask・cleanup が呼ぶ userEvent.cleanup)、ここで押したキーはその数に入らない

// 歩き出しを見る相手(村の枠・主人公・ワールドの層の選択子)と、旋回の時間(TURN_MS)・待つ上限(SLACK_MS)
type StepWatch = { frame: string; player: string; layer: string; turnMs: number; slackMs: number }
// テストの iframe の中で、押す前に走らせる。押す前の立ち位置を控え、村の枠が受け取る keydown を待ち受け、
// 主人公が歩き出したら true、TURN_MS が経ったフレームから 2 フレーム先まで動かなければ false で終わる done を返す
// (判定の理由は village-walk.test-helper.ts の holdUntilStep の注)。押す前から見るのは、押す指示が node へ戻るまでの間に
// 歩き出した分を見落とさないためと、受け取る前に始まったフレームを数えないため
const watchStep = ({ frame, player, layer, key, turnMs, slackMs }: StepWatch & { key: string }) => {
  const required = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`${selector} が描かれていない`)
    return element
  }
  const village = required(frame)
  // 主人公がワールドの層のどこに立って見えるか(px)
  const place = () => {
    const playerBox = required(player).getBoundingClientRect()
    const layerBox = required(layer).getBoundingClientRect()
    return { x: playerBox.left - layerBox.left, y: playerBox.top - layerBox.top }
  }
  const from = place()
  let receivedAt: number | null = null
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === key && receivedAt === null) receivedAt = performance.now()
  }
  village.addEventListener('keydown', onKeyDown, true)
  // 歩き出したら、離す指示が Chromium へ届くのを待たずに押しっぱなしの向きを捨てさせる。焦点のある村の枠(か枠の中の要素)から
  // 焦点を一度外すと、村の枠の onBlur(use-village-input.ts)が押しっぱなしの向きを空にするので、すぐ同じ要素へ焦点を戻す。
  // 後から届く keyup は、向きが空なので何も変えない
  const letGo = () => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !village.contains(active)) return
    active.blur()
    active.focus({ preventScroll: true })
  }
  // 本物の次のフレームを待ち、そのフレームの時刻を返す。同じフレームの rAF(歩行ループの歩みと DOM への書き込み)が
  // 走り終えてから見るよう、1 タスク渡してから戻る
  const nextFrame = () =>
    new Promise<number>(resolve => {
      requestAnimationFrame(time => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => {
          channel.port1.close()
          resolve(time)
        }
        channel.port2.postMessage(null)
      })
    })
  const watch = async () => {
    // キーを受け取った後の最初のフレームの時刻と、TURN_MS が経ったフレームより後に動かないまま見たフレームの数(経つ前は null)
    let firstSeen: number | null = null
    let framesAfterTurn: number | null = null
    const until = performance.now() + slackMs
    while (performance.now() < until) {
      const time = await nextFrame()
      // 層と主人公の箱の引き算に残る端数(カメラだけが動いた時)を、歩いたと取り違えないよう 0.01px 未満は動いていないとみなす
      const now = place()
      if (Math.abs(now.x - from.x) >= 0.01 || Math.abs(now.y - from.y) >= 0.01) {
        letGo()
        return true
      }
      if (framesAfterTurn !== null) {
        framesAfterTurn += 1
        if (framesAfterTurn === 2) return false
        continue
      }
      // 受け取る前に始まったフレームは、歩行ループがキーを見たとは限らないので数えない
      if (receivedAt === null || time <= receivedAt) continue
      if (firstSeen === null) firstSeen = time
      if (time - firstSeen >= turnMs) framesAfterTurn = 0
    }
    return false
  }
  return { done: watch().finally(() => village.removeEventListener('keydown', onKeyDown, true)) }
}
// 方向キーを 1 マス分押す(holdUntilStep の手)。歩き出しを見届けたら押しっぱなしの向きを捨てさせて(watchStep の letGo)離し、歩き出したかを返す。
// 離す指示が Chromium へ届くまでの遅れが 1 マスの歩行(CELL_MS 256ms)を越えると、着いた時にまだ押されていて次のマスまで歩く。
// 2026-10-20 の実測(カバレッジ付きの全体。歩き出しを見てから keyup がテストの iframe に届くまで):
//   - 離すのをテストの iframe から頼む形(iframe → Vitest(node)→ Playwright → Chromium)は、10 回・1030 回で中央 8ms・最長 286ms(200ms を越えたのが 2 回)
//   - node の側で見届けの知らせを受けてすぐ離す形は、同じく 10 回・1030 回で中央 10ms・最長 631ms(1 回ごとの中央は 4〜26ms)。
//     機器が遅くなった後半の 6 回(1 回 66〜88 秒。前半は約 58 秒)に延びた。2 つの形を交互に 4 回ずつ回すと、iframe から頼む形は
//     1 回ごとの中央 32〜39ms・最長 398ms、node の側の形は中央 13〜27ms・最長 512ms で、どちらも卓上時計の前で 1 マス行き過ぎて落ちた回が 2 回あった
// 遅れはどちらの形でも 256ms を越えうるので、歩き出したら離す指示を待たずに押しっぱなしの向きを捨てさせる。node の側で離すのを 400ms 遅らせると、
// 捨てさせない形は卓上時計の2ファイル14件が全部時計の前で行き過ぎて落ち、捨てさせる形は14件とも通った
const holdUntilStep: BrowserCommand<[key: string, watch: StepWatch]> = async (
  { page, frame },
  key,
  watch
) => {
  const tester = await frame()
  const watcher = await tester.evaluateHandle(watchStep, { ...watch, key })
  try {
    await page.keyboard.down(key)
    try {
      return await watcher.evaluate(started => started.done)
    } finally {
      await page.keyboard.up(key)
    }
  } finally {
    await watcher.dispose()
  }
}

// キーを押したまま、テストの iframe の rAF を決めた数だけ数えてから離す手(tapHeld の手)。
// 押しっぱなしの向きを rAF で読む経路(会話窓の本文送り・窓の外から焦点を入れる方向)へ、押した瞬間の 1 回として読ませる。
// 離す指示が Chromium へ届くまでの遅れの分だけ長く押すので、その間のフレームの時刻が押し続けた時の繰り返しの間隔(300ms)を越えると、
// 1 回のつもりが繰り返しになる。繰り返さないことを確かめるテストは、rAF を偽の時計に載せて叩く(tapHeld の注)
const holdKey: BrowserCommand<[key: string, hold: { frames: number }]> = async (
  { page, frame },
  key,
  hold
) => {
  await page.keyboard.down(key)
  try {
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
  } finally {
    await page.keyboard.up(key)
  }
}

// 統合テスト(Vitest Browser Mode)の設定。画面単位のコンポーネントを実際の Chromium で、ビルド無しで描く
// (docs/decisions/0016-testing-trophy-browser-integration.md)。
// 単体の vitest.config.ts と別のファイルにするのは、変異テスト(stryker.config.mjs)が vitest.config.ts を読むため。
// Stryker の Browser Mode 対応は未実測なので、変異テストは node と happy-dom の単体だけで回す(ADR 0016)。
// 単体の設定は __tests__/ と *.integration.test.{ts,tsx} を exclude で外し、ここは src の下の *.integration.test.tsx だけを拾う(ADR 0022)。
// ほかの場所・名前の統合テスト(src の外・*.integration.test.ts・もとの名前の *.browser.test.*)はどちらの設定にも拾われず、
// src の下でもコンテナのフォルダの外(表示部品の隣・hooks の中など)に置いた物はここで走るが、どちらも
// npm run test:boundary(scripts/check-test-boundary.mjs)が落とすので、置き場の外のまま黙って残ることは無い
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
    // 上で拾った index.fixture.ts を、テストの前に node で走らせる
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
      // テストから commands.holdUntilStep・commands.holdKey で呼ぶ(上の注)
      commands: { holdUntilStep, holdKey },
    },
    // 測るのは --coverage を付けたときだけ。フックとコンポーネントもここで測る(単体の設定はフックと components の .tsx を外す)。
    // 測るのはブラウザで動くコードだけ(上の COVERAGE_INCLUDE。ADR 0026)。
    // フックとコンポーネント(コンテナと表示部品)は全部をファイル別100%で固める(上の HOOK_FILES・COMPONENT_FILES。ADR 0018・0019・0022・0024)。
    // フックとコンテナでは、統合テストで構造上届かない行(E2E だけが作れる場合)だけを、
    // その行を見ている E2E を名指しする注釈 `/* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */` で外し、
    // 名指しした E2E が実在するかを npm run test:boundary(scripts/check-coverage-ignores.mjs)が確かめる。表示部品にはこの注釈も置けない(同じ検査が落とす)
    coverage: {
      provider: 'v8',
      enabled: false,
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
      reporter: ['text-summary'],
      reportsDirectory: 'coverage/integration',
      // 全体の床は、2026-10-20 の実測(文 98.46%・分岐 96.2%・関数 99.56%・行 99.48%。統合テスト95ファイル・351件)を整数へ切り捨てた値(ADR 0026)。
      // 100にしないのは、届かない所(文 45・分岐 60・関数 3・行 13)がどれも、ブラウザで動く純粋モジュール(src/lib・src/utils・コンポーネントの utils)の
      // 28ファイルにある、画面からは届かない防御の分岐だから(製品の呼び出し元の無い関数・起きない値の検査・古い実行環境の代わりの道など。一覧は ADR 0026)。
      // その28ファイルは単体(vitest.config.ts の全体の100とファイル別100%)と変異テストの門で100%なので、どのファイルも少なくとも1か所で100%になる。
      // 目標値ではなく、統合テストを消したり、ブラウザで動くコードに統合テストの通らない所を増やしたりしたときに落とすための床
      thresholds: {
        statements: 98,
        branches: 96,
        functions: 99,
        lines: 99,
        // フックとコンポーネントのファイル別100%(一覧は上の HOOK_FILES・COMPONENT_FILES)
        ...Object.fromEntries(PER_FILE_TARGETS.map(file => [file, FULL_COVERAGE])),
      },
    },
  },
})
