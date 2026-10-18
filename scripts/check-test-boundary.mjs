// テストの置き場の境界検査。フック(hooks/ 配下)に単体テストを置いていないかと、
// フックを renderHook で呼ぶテストがどこにも無いかと、コンポーネントを描くテストがコンテナのフォルダの統合テストの外に無いかを見る。
//
// 決まり: ロジックは純粋関数(src/lib/・utils/)に置き、単体テストと変異テストで固める。
// フックは単体テストを置かない層で、動きはそのフックを呼ぶコンテナ(フックを呼ぶ index.tsx)を統合テスト(*.integration.test.tsx)で描いて見る
// (vitest.config.ts のカバレッジでも測らない。統合のカバレッジ vitest.integration.config.ts がファイル別100%で固める)。
// hooks/ の外へテストを移しても、renderHook でフックを呼べば同じことになるので、それも落とす。
// テストの部品・フィクスチャ(*.test-helper.ts・*.fixture.ts)も hooks/ 配下に置かない。統合のカバレッジ(vitest.integration.config.ts)は
// この名前を exclude で外すので、hooks/ の下に置くとフックのファイル別100%の門(ADR 0018)の外に黙って残る。
// ストアを import して getState() で状態を戻すだけのテストは、フックを描かないので落とさない。
// 例外を許す一覧は持たない(移し終えて 0 件になった。足したくなったら、ロジックを純粋関数へ切り出してそちらで測る)。
//
// 加えて、コンポーネントを描くテストの置き場を見る(ADR 0022・ADR 0024。ADR 0019 のリポジトリ直下の __tests__/ を置き換えた)。
// コンポーネントのフォルダの入口はいつも index.tsx で、コンテナかどうかは scripts/find-containers.mjs が決める
// (src/components の下の index.tsx(hooks/ と __tests__/ の中は除く)でフックを使うものと、I/O コンテナの一覧のフォルダの index.tsx がコンテナ。ほかの index.tsx は表示部品)。
// コンポーネントを描くのは統合テストだけで、置けるのはコンテナの index.tsx のあるフォルダ(コンテナのフォルダ)だけ。
// 表示部品は自分のテストを持たず、それを描く親のコンテナの統合テストで覆う。表示部品がフックを呼び始めるとコンテナになり、
// 統合テストが無ければ下の「コンテナごとに統合テストが1本以上要る」で落ちる。
//   - そのコンテナの統合テストが1本なら、index.tsx の隣の index.integration.test.tsx(対のファイル)。
//     2本以上なら、そのフォルダの __tests__/ の直下の <動作>.integration.test.tsx(kebab-case。対のファイルの名前は使わない)。
//     対のファイルと __tests__/ を同じフォルダに両方置かない。__tests__/ の統合テストが1本だけなら落とす(対のファイルにする)
//   - __tests__/ を置けるのはコンテナのフォルダの直下だけで、その下にフォルダを作らない。
//     リポジトリ直下の __tests__/ は無くした(中にファイルがあれば落とす)
//   - 統合テストに見える名前(*.integration.test.ts・*.integration.test.tsx)は、上の2つの所の外(表示部品の隣・hooks/ の中・
//     コンテナのフォルダでない所の __tests__/・tests も)と *.integration.test.ts を落とす
//     (統合の設定 vitest.integration.config.ts は src の下の *.integration.test.tsx を全部拾う)
//   - もとの名前 *.browser.test.*(container.browser.test.tsx)は、どこにあっても落とす
//   - もとの名前 container.tsx・container.integration.test.tsx・container.fixture.ts(ADR 0019・ADR 0022)は、どこにあっても落とす
//     (src・リポジトリ直下の __tests__/・tests/ のどこでも)。入口は index.tsx、対のファイルは index.integration.test.tsx、フィクスチャは index.fixture.ts
//   - *.test.tsx(単体の設定 vitest.config.ts が拾う名前)は、統合テストのほかには src のどこにも置かない。__tests__/ には統合テスト以外のテストを置かない
//   - __tests__/ に置ける名前は、統合テスト(*.integration.test.tsx)・統合テストだけが使う部品(*.test-helper.ts)・
//     index.fixture.ts・文書(*.md)だけ。ほかの名前(*.ts・*.tsx・*.test-helper.tsx・ほかの *.fixture.ts・データなど)は落とす
//   - コンテナごとに統合テストが1本以上要る(I/O コンテナの一覧のフォルダは index.tsx が無くても数える)
//   - 統合テストは、自分のフォルダのコンテナを(型だけでなく)別名 @/components/<フォルダ> で import する(そのコンテナを描く)。
//     相対パス(./index・../index)と …/index で指しても数えない(どのテストも同じ書き方で、検索で描く所を拾えるように)
//   - 統合テストの外(src の *.test.ts・*.test-helper.ts・*.fixture.ts と、__tests__/ の *.integration.test.tsx でないファイル全部)は、
//     コンポーネントを描く道具(@testing-library/react・react-dom とその下)を import しない(型だけの import も)。
//     happy-dom でコンポーネントを描くと、名前を *.test.ts にするだけで上の置き場の決まりをすり抜けるため
//   - index.fixture.ts は、I/O コンテナ(scripts/container-dirs.mjs の一覧。check-layers.mjs と同じもの)のフォルダの
//     index.tsx の隣か、そのフォルダの __tests__/ の直下にだけ置ける。統合の設定が src の下の index.fixture.ts を
//     全部 globalSetup に入れるので、ほかの所に置くと黙って走る
//   - 統合テストの側(*.integration.test.tsx と __tests__/ の中のコード)が import するテストの部品・フィクスチャ
//     (*.test-helper.ts・*.fixture.ts。部品が import する部品もたどる)は、コンテナのフォルダの __tests__/ の直下か
//     コンテナの index.tsx の隣にだけ置ける。src の単体テスト(*.test.ts)だけが使う部品は、今のまま対象の隣に置ける
//   - コンテナは src/components/<名前>/ か src/components/ui/<名前>/ の下にだけ置ける(src/components/・src/components/ui/ の直下には置かない)。
//     src/components の外の index.tsx はフックを呼べず(ESLint の layer/hook-only-in-container)コンテナにならないが、
//     I/O コンテナの一覧のフォルダが外にあれば落とす。check-layers.mjs は src/app/・src/lib/ を許す側として見るので、
//     そこにコンテナを置くと、外の世界に触れるのは I/O コンテナの6つだけという決まりをすり抜ける
//   - hooks/ フォルダはコンテナのフォルダ(コンテナの index.tsx があるフォルダ)にだけ置ける(例外は src/hooks/ だけ)。
//     表示部品のフォルダに hooks/ があれば落とす
//   - index.tsx のあるフォルダには、ほかの入口の名前(index.ts・index.d.ts・index.js・index.jsx)を置かない。
//     フォルダの名前の指定子(@/components/<フォルダ>)を index.tsx より先にそちらへ解決する道具があり、型の検査や統合テストが見るつもりの index.tsx が入れ替わる。
//     tsc(tsconfig.json の moduleResolution: bundler・allowJs: true)は index.ts を、単体・統合のテストを束ねる Vite(resolve.extensions は既定のまま)は
//     index.js・index.ts・index.jsx を index.tsx より先に拾う(2026-10-18 に TypeScript 6.0.3・Vite 8.2.0 で5つの名前を並べて実測)。
//     index.d.ts はどちらも index.tsx より先には拾わない(tsc は index.tsx の後、Vite は拾わない)が、入口の名前を index.tsx の1つにするため一緒に落とす。
//     next build(Turbopack)の順は確かめていない(next.config.ts は resolveExtensions を指定しない)。
//     もとは「状態コンテナのフォルダに index.tsx を置かない」の決まりの一部(ADR 0019)で、ADR 0024 で入口が index.tsx に揃ったので index.tsx のある全部のフォルダへ広げた
// 部品(*.test-helper.ts)を、それを使うコンテナを囲む一番近いコンテナの側に置いているかまでは見ない
// (コンテナのフォルダにあるかだけを見る。import の向きは check-layers.mjs も見ない)。
// 状態コンテナが外の世界の入口を import しないことは check-layers.mjs が見る。
// import は scripts/read-imports.mjs で構文木から読む(注釈・文字列の中は数えない)。
//
// 見るのは git の追跡ではなく作業ツリー。書いたばかりの未追跡のテストも Vitest は拾って走らせるため。
// 正規表現や注釈の外し方・import の判定・コンテナの判定が壊れて違反を見逃すようになっていないかは、走るたびに最初に確かめる(下の「自己検査」。
// コンテナの判定そのものは scripts/find-containers.mjs が読み込んだ時に自分でも確かめる)。
// I/O コンテナの一覧(scripts/container-dirs.mjs)も自己検査で写し(EXPECTED_IO_DIRS)と比べ、一覧だけを書き換えて
// I/O コンテナを黙って増やす・移すことを落とす
//
// 使い方: node scripts/check-test-boundary.mjs(npm run test:boundary)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTAINER_DIRS, TESTS_DIR, inTestsDir } from './container-dirs.mjs'
import { CONTAINER_ENTRY, isContainer } from './find-containers.mjs'
import { importsOf, parseSource } from './read-imports.mjs'

// cwd に依存しない。どこから呼んでもリポジトリ直下を見る
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 中身まで見るフォルダ(src と、無くしたリポジトリ直下の __tests__/。直下の __tests__/ は中にファイルがあれば落とす)
const SCAN_DIRS = ['src', TESTS_DIR]
// 統合テストともとの名前だけを見るフォルダ(E2E。ここに置いた統合テストはどの設定にも拾われない)
const NAME_SCAN_DIRS = ['tests']

// Vitest が拾う名前(vitest.config.ts の include と同じ *.test.ts / *.test.tsx)
const TEST_FILE = /\.test\.tsx?$/
// テストが読むファイル(フィクスチャ・テストの部品)。統合テストの外として描く道具の import を見る
const TEST_SUPPORT = /\.(?:fixture|test-helper)\.ts$/
// 統合テストの名前(統合の設定が拾うもの)と、統合テストに見える名前の全部(*.integration.test.ts も)
const INTEGRATION_TEST = /\.integration\.test\.tsx$/
const INTEGRATION_NAME = /\.integration\.test\.tsx?$/
// __tests__/ の中の統合テストの名前(kebab-case の <動作>.integration.test.tsx)
const KEBAB_INTEGRATION_TEST = /^[a-z0-9]+(?:-[a-z0-9]+)*\.integration\.test\.tsx$/
// もとの統合テストの名前(拡張子を問わない)
const BROWSER_TEST = /\.browser\.test\./
const UNIT_TEST_TSX = /\.test\.tsx$/
// 統合テストが1本のコンテナの、index.tsx の隣の統合テスト(対のファイル)
const PAIR_TEST = 'index.integration.test.tsx'
const CONTAINER_FIXTURE = 'index.fixture.ts'
// もとの名前(ADR 0019 のコンテナ・ADR 0022 の対のファイルとフィクスチャ)。どこにあっても落とす
const OLD_NAMES = new Set([
  'container.tsx',
  'container.integration.test.tsx',
  'container.fixture.ts',
])
// __tests__/ に置ける名前(統合テスト・統合テストだけが使う部品・フィクスチャ・文書)。ファイルの名前に当てる
const TESTS_DIR_NAMES = [INTEGRATION_TEST, /\.test-helper\.ts$/, /^index\.fixture\.ts$/, /\.md$/]
// import を読むコード(__tests__/ のデータなど、コードでないファイルは読まない)
const CODE_FILE = /\.[cm]?[jt]sx?$/
// 相対パスの指定子(./ と ../)
const RELATIVE = /^\.\.?(?:\/|$)/
// 隣にコンテナが無くても置ける、ただ1つの hooks/ フォルダ(ルートの共用のフック)
const ROOT_HOOKS_DIR = 'src/hooks'
// コンテナを置けるフォルダの根(この下の <名前>/ の下にだけ置ける)と、横断部品のフォルダの名前(この下は ui/<名前>/ の下)
const COMPONENTS_DIR = 'src/components'
const SHARED_DIR = 'ui'
// I/O コンテナの一覧(scripts/container-dirs.mjs の CONTAINER_DIRS)の写し。並びも同じでなければ自己検査で落とす。
// 外の世界に触れてよいコンテナを足す・移す・消すのは利用者の決定が要るので、一覧だけを直しても通らないようにここに固定する
const EXPECTED_IO_DIRS = [
  'src/components/VillagePage',
  'src/components/Directory',
  'src/components/Story',
  'src/components/ui/SettingsMenu',
  'src/components/ui/PageviewCounter',
  'src/components/ui/ScenePlayer',
]
// index.tsx のあるフォルダに置けない、ほかの入口の名前(フォルダの名前の指定子 …/<名前> を、道具によっては index.tsx より先に解決する先。どの道具がどれを先に拾うかは冒頭の注釈)
const OTHER_ENTRY = /^index\.(?:d\.ts|ts|js|jsx)$/
// コンポーネントを描く道具。前方一致で見る(react-dom/client・react-dom/server・@testing-library/react/pure も)
const RENDER_PACKAGES = ['@testing-library/react', 'react-dom']
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
const PLACES =
  '統合テストはコンテナ(フックを使う index.tsx と、I/O コンテナの一覧のフォルダの index.tsx)のフォルダに置く。そのコンテナの統合テストが1本なら index.tsx の隣の ' +
  'index.integration.test.tsx(対のファイル)、2本以上ならそのフォルダの __tests__/ の直下の <動作>.integration.test.tsx(kebab-case)'
const REASON_HOOK_TEST =
  'hooks/ 配下にテストは置かない(統合テストも)。ロジックを純粋関数(src/lib/ か utils/)へ移してそちらで測り、フックの動きは、そのフックを呼ぶコンテナを、そのコンテナのフォルダの統合テスト(*.integration.test.tsx)で描いて見る'
const REASON_HOOK_SUPPORT =
  'hooks/ 配下にテストの部品・フィクスチャ(*.test-helper.ts・*.fixture.ts)は置かない。統合のカバレッジ(vitest.integration.config.ts)はこの名前を exclude で外すので、' +
  'hooks/ の下に置くとフックのファイル別100%の門の外に黙って残る。テストが読む部品はテストの側(hooks/ の外)に置き、フックの中身ならフックの名前にする(ADR 0018)'
const REASON_RENDER_HOOK =
  'renderHook でフックを呼ぶテストは置かない(hooks/ の外でも同じ)。ロジックを純粋関数へ移してそちらで測り、フックの動きは、そのフックを呼ぶコンテナを、そのコンテナのフォルダの統合テスト(*.integration.test.tsx)で描いて見る'
const REASON_UNIT_TSX =
  '*.test.tsx(単体の設定が拾う名前)は、統合テストのほかには src に置かない。コンポーネントを描くテストは、そのコンポーネントを描くコンテナの統合テストに書く(表示部品は自分のテストを持たない)。' +
  `純粋関数のテストなら *.test.ts にする。${PLACES}(ADR 0022・ADR 0024)`
const REASON_BROWSER_OLD =
  '*.browser.test.*(もとの統合テストの名前。container.browser.test.tsx も)は、どこにも置かない(どちらの設定にも拾われない)。' +
  `${PLACES}(ADR 0022・ADR 0024)`
const REASON_OLD_NAME =
  'もとの名前 container.tsx・container.integration.test.tsx・container.fixture.ts は使わない(ADR 0024)。コンポーネントのフォルダの入口は index.tsx で、' +
  'フックを使う index.tsx がコンテナになる。対のファイルは index.integration.test.tsx、I/O コンテナのフィクスチャは index.fixture.ts にする。' +
  'container.tsx を移すなら、同じフォルダの index.tsx にする(表示部品だった index.tsx の中身は components/<名前>/index.tsx へ移す)'
const REASON_INTEGRATION_PLACE =
  '統合テスト(*.integration.test.ts・*.integration.test.tsx)を置けるのは、コンテナのフォルダの index.integration.test.tsx(対のファイル)と、' +
  'コンテナのフォルダの __tests__/ の直下の kebab-case の <動作>.integration.test.tsx(対のファイルの名前は使わない)だけ。' +
  '表示部品(フックを使わない index.tsx)の隣・コンテナのフォルダでない所・tests/ には置かず、*.integration.test.ts にしない(表示部品は、それを描く親のコンテナの統合テストで覆う)。' +
  `${PLACES}(ADR 0022・ADR 0024)`
const REASON_ROOT_TESTS =
  'リポジトリ直下の __tests__/ は無くした。統合テストと、その部品・フィクスチャは、そのコンテナのフォルダへ移す(部品・フィクスチャは __tests__/ の中かコンテナの index.tsx の隣)。' +
  `${PLACES}(ADR 0022)`
const REASON_TESTS_SUBDIR =
  '__tests__/ の下にフォルダを作らない(ファイルは __tests__/ の直下に置く)。子のコンテナのテストなら、その子のフォルダ(コンテナの index.tsx のあるフォルダ)へ移す。' +
  `${PLACES}(ADR 0022)`
const REASON_TESTS_NOT_CONTAINER =
  '__tests__/ を置けるのは、コンテナの index.tsx のあるフォルダ(コンテナのフォルダ)の直下だけ。表示部品(フックを使わない index.tsx)・utils・lib などのフォルダには置かない。' +
  `表示部品のテストは、それを描く親のコンテナの統合テストに書く。${PLACES}(ADR 0022・ADR 0024)`
const REASON_PAIR_AND_DIR =
  'このコンテナのフォルダに、対のファイル index.integration.test.tsx と __tests__/ が両方ある。統合テストが1本なら対のファイルだけにし、' +
  '部品は index.tsx の隣へ移して __tests__/ を無くす。2本以上なら、対のファイルにも動作の名前を付けて全部を __tests__/<動作>.integration.test.tsx にする(ADR 0022)'
const REASON_LONE_IN_DIR =
  'この __tests__/ の統合テストは1本だけ。統合テストが1本のコンテナは __tests__/ を作らず、index.tsx の隣の index.integration.test.tsx(対のファイル)にし、' +
  '部品・フィクスチャは index.tsx の隣へ移す(ADR 0022)'
const REASON_TESTS_UNIT =
  '__tests__/ には統合テスト(*.integration.test.tsx)のほかのテストを置かない(どちらの設定にも拾われない)。単体テストは src の対象の隣に *.test.ts で置き、' +
  'コンポーネントを描くテストは <動作>.integration.test.tsx にする(ADR 0022)'
const REASON_TESTS_NAME =
  '__tests__/ に置ける名前は、統合テスト(<動作>.integration.test.tsx)・統合テストだけが使う部品(<名前>.test-helper.ts)・index.fixture.ts・文書(*.md)だけ。' +
  'コンポーネントを描くテストなら <動作>.integration.test.tsx に、統合テストが共有する部品なら <名前>.test-helper.ts(.tsx にしない。JSX を書かない)に、' +
  'node で props を組むフィクスチャなら I/O コンテナのフォルダの index.fixture.ts にまとめる。src の単体テストも使う部品・データなら、src の対象の隣に置く(ADR 0022・ADR 0024)'
const REASON_NO_TESTS =
  `コンテナ(フックを使う index.tsx と、I/O コンテナの一覧のフォルダの index.tsx)には統合テストが1本以上要る。${PLACES}。` +
  'コンテナをフック・子と一緒に実ブラウザで描く統合テストを書く。表示部品がフックを呼び始めたなら、その index.tsx はコンテナになったので統合テストを足す。' +
  'フックが要らないなら、フックを外して表示部品に戻し、値は props で受け取る(ADR 0022・ADR 0024)'
const REASON_NOT_OWN_CONTAINER =
  '統合テスト(*.integration.test.tsx)は、自分のフォルダのコンテナを(型だけでなく)別名 @/components/<フォルダのパス> で import して描く' +
  '(対のファイルも __tests__/ の中も同じ書き方。./index・../index・…/index では数えない)。ほかのコンテナの動きなら、そのコンテナのフォルダに書く(ADR 0022・ADR 0024)'
const REASON_FIXTURE_PLACE =
  'index.fixture.ts を置けるのは、I/O コンテナの6つ(scripts/container-dirs.mjs の一覧)のフォルダの index.tsx の隣か、そのフォルダの __tests__/ の直下だけ。' +
  '統合の設定(vitest.integration.config.ts)が src の下の index.fixture.ts を全部 globalSetup に入れるので、ほかの所に置くと黙って走る。' +
  'src の単体テストが読むデータなら、対象の隣に別の名前の *.fixture.ts で置く(ADR 0022・ADR 0024)'
const REASON_SUPPORT_PLACE =
  '統合テストの側(*.integration.test.tsx と __tests__/ の中のファイル)が import するテストの部品・フィクスチャ(*.test-helper.ts・*.fixture.ts。部品が import する部品も)は、' +
  'コンテナのフォルダ(コンテナの index.tsx のあるフォルダ)の __tests__/ の直下かコンテナの index.tsx の隣にだけ置ける(表示部品・utils・lib などのフォルダには置かない)。' +
  'いくつかのコンテナのテストが一緒に使う部品は、そのコンテナたちを囲む一番近いコンテナの側に置く。src の単体テスト(*.test.ts)だけが使う部品なら、対象の隣のままでよい(ADR 0022)'
const REASON_CONTAINER_PLACE =
  'コンテナは src/components/<名前>/ か src/components/ui/<名前>/ の下にだけ置ける(src/components/ の外と、src/components/・src/components/ui/ の直下には置かない)。' +
  'src/app/・src/lib/ は import の検査(check-layers.mjs)が外の世界の入口を import してよい側として見るので、そこにコンテナを置くと、外の世界に触れるのは I/O コンテナの6つだけという決まりをすり抜ける。' +
  'フックを呼ぶ部品なら src/components/ の下のコンポーネントのフォルダの index.tsx へ移し、フックを呼ばない部品ならフックを外して表示部品にする(ADR 0019・ADR 0024)'
const REASON_IO_DIRS =
  'I/O コンテナの一覧(scripts/container-dirs.mjs の CONTAINER_DIRS)が、この検査の写し EXPECTED_IO_DIRS と違う(並びも見る)。' +
  '外の世界に触れてよいコンテナを足す・移す・消すのは利用者の決定が要る。決まったなら ADR 0019 と、この検査の EXPECTED_IO_DIRS を合わせて直す' +
  '(一覧だけを書き換えて I/O コンテナを黙って増やさない)'
const REASON_UNIT_RENDER =
  '統合テストの外(src の *.test.ts・*.test-helper.ts・*.fixture.ts と、__tests__/ の *.integration.test.tsx でないファイル全部)は、コンポーネントを描く道具(@testing-library/react・react-dom とその下)を import しない(型だけの import も)。' +
  'コンポーネントを描くテストは、そのコンポーネントを描くコンテナのフォルダの統合テスト(*.integration.test.tsx)に書く(ADR 0019・ADR 0022)'
const REASON_LONELY_HOOKS =
  'hooks/ フォルダはコンテナのフォルダ(フックを使う index.tsx か、I/O コンテナの一覧のフォルダの index.tsx があるフォルダ)にだけ置ける(例外は src/hooks/ だけ)。' +
  '表示部品のフォルダには置かない。フックを呼ぶ所をそのフォルダの index.tsx(コンテナ)に移して統合テストを足すか、' +
  'フックを、それを呼ぶコンテナの hooks/ か src/hooks/ へ移す(ADR 0019・ADR 0024)'
const REASON_OTHER_ENTRY =
  'index.tsx のあるフォルダには、ほかの入口の名前(index.ts・index.d.ts・index.js・index.jsx)を置かない。フォルダの名前の指定子(@/components/<フォルダ>)を' +
  ' index.tsx より先にそちらへ解決する道具がある(tsc は index.ts を、テストを束ねる Vite は index.js・index.ts・index.jsx を先に拾う)ので、型の検査や統合テストが見るつもりのコンテナ・表示部品が入れ替わる。' +
  'index.d.ts は先には拾われないが、入口の名前を index.tsx の1つにするため一緒に落とす。' +
  'コンポーネントのフォルダの入口は index.tsx だけにし、ほかのものは別の名前にする(ADR 0024)'

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

// テストの部品・フィクスチャの違反の理由(違反でなければ undefined)。hooks/ 配下の部品は、それだけで違反
const supportViolationOf = file =>
  TEST_SUPPORT.test(file) && HOOKS_DIR.test(file) ? REASON_HOOK_SUPPORT : undefined

// テストの側のファイルが属するコンテナのフォルダ(の候補)。__tests__/ の直下なら __tests__/ の親、ほかは自分のフォルダ
const ownerDirOf = file => {
  const dir = path.posix.dirname(file)
  return path.posix.basename(dir) === TESTS_DIR ? path.posix.dirname(dir) : dir
}

// __tests__/ の中のファイルの置き場の違反の理由(__tests__/ の外か、違反でなければ undefined)。
// リポジトリ直下の __tests__/ の中は全部落とす。ほかは、一番外の __tests__/ の直下でなければ下にフォルダを作っていて、
// 直下なら __tests__/ の親がコンテナのフォルダかを見る
const testsDirViolationOf = (file, containerDirs) => {
  if (!inTestsDir(file)) return undefined
  if (file.startsWith(`${TESTS_DIR}/`)) return REASON_ROOT_TESTS
  const parts = path.posix.dirname(file).split('/')
  if (parts.indexOf(TESTS_DIR) !== parts.length - 1) return REASON_TESTS_SUBDIR
  return containerDirs.has(ownerDirOf(file)) ? undefined : REASON_TESTS_NOT_CONTAINER
}

// 統合テストに見える名前のファイルが置ける所にあるか。__tests__/ の直下なら kebab-case の <動作>.integration.test.tsx
// (対のファイルの名前は使わない)、ほかはコンテナの index.tsx の隣の対のファイルだけ。どちらもコンテナのフォルダのもの
const isIntegrationPlace = (file, containerDirs) => {
  const name = path.posix.basename(file)
  const named =
    path.posix.basename(path.posix.dirname(file)) === TESTS_DIR
      ? KEBAB_INTEGRATION_TEST.test(name) && name !== PAIR_TEST
      : name === PAIR_TEST
  return named && containerDirs.has(ownerDirOf(file))
}

// テスト・フィクスチャの置き場の違反の理由(違反でなければ undefined)。もとの名前はどこにあっても先に落とす。
// containerDirs はコンテナのフォルダ(コンテナの index.tsx のあるフォルダと I/O コンテナの一覧)、ioDirs は I/O コンテナの一覧
const placementViolationOf = (file, { containerDirs, ioDirs }) => {
  const name = path.posix.basename(file)
  if (OLD_NAMES.has(name)) return REASON_OLD_NAME
  const testsDir = testsDirViolationOf(file, containerDirs)
  if (testsDir !== undefined) return testsDir
  if (BROWSER_TEST.test(name)) return REASON_BROWSER_OLD
  if (INTEGRATION_NAME.test(name)) {
    return isIntegrationPlace(file, containerDirs) ? undefined : REASON_INTEGRATION_PLACE
  }
  if (TEST_FILE.test(name) && inTestsDir(file)) return REASON_TESTS_UNIT
  if (UNIT_TEST_TSX.test(name)) return REASON_UNIT_TSX
  if (name === CONTAINER_FIXTURE && !ioDirs.has(ownerDirOf(file))) return REASON_FIXTURE_PLACE
  return undefined
}

// __tests__/ の中のファイルの名前の違反の理由(違反でなければ undefined)。置ける名前は TESTS_DIR_NAMES だけ
const testsNameViolationOf = file =>
  inTestsDir(file) && !TESTS_DIR_NAMES.some(pattern => pattern.test(path.posix.basename(file)))
    ? REASON_TESTS_NAME
    : undefined

// 指定子が指す src の中のパス(拡張子は付けない)。@/ は src から、./ と ../ は file のフォルダから。どちらでもなければ undefined
const importTargetOf = (file, specifier) => {
  if (specifier === undefined) return undefined
  if (specifier.startsWith('@/')) return path.posix.normalize(`src/${specifier.slice(2)}`)
  if (RELATIVE.test(specifier)) return path.posix.join(path.posix.dirname(file), specifier)
  return undefined
}

// 指定子が、フォルダ dir のコンテナを別名(@/ から始まり、そのフォルダを指す)で指すか。…/index・相対パスは数えない。
// コンテナは src/components の下にしか置けない(置けない所のコンテナは layoutOf が落とす)ので、これは @/components/<フォルダのパス> のこと
const isOwnAlias = (specifier, dir) =>
  specifier !== undefined &&
  specifier.startsWith('@/') &&
  importTargetOf(undefined, specifier) === dir

// 中身の import の違反の理由(違反でなければ undefined)。統合テストは自分のフォルダのコンテナを描くか、
// 統合テストの外は描く道具を使わないかを見る。containerDirs は placementViolationOf と同じ
const importViolationOf = (file, code, containerDirs) => {
  const imports = importsOf(parseSource(file, code))
  if (INTEGRATION_TEST.test(file)) {
    const own = ownerDirOf(file)
    const drawsOwn =
      containerDirs.has(own) &&
      imports.some(({ specifier, typeOnly }) => !typeOnly && isOwnAlias(specifier, own))
    return drawsOwn ? undefined : REASON_NOT_OWN_CONTAINER
  }
  const renders = imports.some(
    ({ specifier }) =>
      specifier !== undefined && RENDER_PACKAGES.some(name => specifier.startsWith(name))
  )
  return renders ? REASON_UNIT_RENDER : undefined
}

// 統合テストの側のファイル(統合テストと、__tests__/ の中のコード)から import でたどれるテストの部品・フィクスチャ。
// 部品が import する部品もたどる(コンテナの index.tsx の隣の部品が読む部品も、統合テストの側の部品)。
// 指定子は importTargetOf で解き(@/ と相対パス)、.ts を付けて作業ツリーにあるものだけを数える。型だけの import も数える
const integrationSupportsOf = (files, readCode) => {
  const fileSet = new Set(files)
  const found = new Set()
  const visit = file => {
    const supports = importsOf(parseSource(file, readCode(file))).flatMap(({ specifier }) => {
      const target = importTargetOf(file, specifier)
      return target === undefined ? [] : [`${target}.ts`]
    })
    for (const support of supports) {
      if (found.has(support) || !TEST_SUPPORT.test(support) || !fileSet.has(support)) continue
      found.add(support)
      visit(support)
    }
  }
  files
    .filter(file => CODE_FILE.test(file) && (INTEGRATION_TEST.test(file) || inTestsDir(file)))
    .forEach(visit)
  return found
}

// 統合テストの側が import する部品・フィクスチャの置き場の違反の理由(違反でなければ undefined)。
// 置けるのはコンテナのフォルダの __tests__/ の直下かコンテナの index.tsx の隣で、どちらも ownerDirOf がコンテナのフォルダになる
// (__tests__/ の下のフォルダとコンテナのフォルダでない所の __tests__/ は、先に testsDirViolationOf が落とす)。
// containerDirs は placementViolationOf と同じ、integrationSupports は integrationSupportsOf の結果
const supportPlaceViolationOf = (file, containerDirs, integrationSupports) =>
  integrationSupports.has(file) && !containerDirs.has(ownerDirOf(file))
    ? REASON_SUPPORT_PLACE
    : undefined

// 1 ファイルのパスの途中にある hooks/ フォルダ(src/a/hooks/b/hooks/use-c.ts なら src/a/hooks と src/a/hooks/b/hooks)
const hooksDirsInPath = file => {
  const parts = file.split('/').slice(0, -1)
  return parts.flatMap((part, index) =>
    part === 'hooks' ? [parts.slice(0, index + 1).join('/')] : []
  )
}

// src の下の hooks/ フォルダ
const hooksDirsOf = files =>
  new Set(files.filter(file => file.startsWith('src/')).flatMap(hooksDirsInPath))

// コンテナのフォルダ dir がコンテナを置ける所か。src/components/<名前>/ の下(<名前> のフォルダ自身も)で、
// <名前> が ui なら src/components/ui/<名前>/ の下。名前の前の方が同じだけのフォルダ(src/componentsX/)は数えない
const isContainerPlace = dir => {
  if (!dir.startsWith(`${COMPONENTS_DIR}/`)) return false
  const [top, ...rest] = dir.slice(COMPONENTS_DIR.length + 1).split('/')
  return top !== SHARED_DIR || rest.length > 0
}

// I/O コンテナの一覧が写し EXPECTED_IO_DIRS と違うときの理由(並びまで同じなら undefined)
const ioDirsViolationOf = dirs =>
  JSON.stringify(dirs) === JSON.stringify(EXPECTED_IO_DIRS) ? undefined : REASON_IO_DIRS

// コンテナ(scripts/find-containers.mjs の判定)と、そのフォルダと、コンテナのフォルダごとに見る違反(置ける所かと、対のファイルと __tests__/ の数え方)。
// 置けない所のコンテナは、その index.tsx の1件だけを落とす(隣のテストはコンテナのフォルダのものとして数え、
// テストの数え方は見ない。直すのはコンテナを移すことなので、テストの側まで重ねて落とさない)。
// files は src とリポジトリ直下の __tests__/ のファイル(リポジトリ直下からのパス)、ioDirs は I/O コンテナの一覧、
// readCode はパス → 中身(コンテナの判定が、フックを使えばコンテナになる入口だけを読む)
const layoutOf = (files, ioDirs, readCode) => {
  const fileSet = new Set(files)
  const containers = new Set(files.filter(file => isContainer(file, ioDirs, readCode)))
  const containerDirs = new Set([
    ...[...containers].map(file => path.posix.dirname(file)),
    ...ioDirs,
  ])
  const violations = []
  const atContainer = (dir, reason) => ({ file: `${dir}/${CONTAINER_ENTRY}`, reason })
  for (const dir of [...containerDirs].sort()) {
    if (!isContainerPlace(dir)) {
      violations.push(atContainer(dir, REASON_CONTAINER_PLACE))
      continue
    }
    const testsDir = `${dir}/${TESTS_DIR}`
    const hasPair = fileSet.has(`${dir}/${PAIR_TEST}`)
    const hasTestsDir = files.some(file => file.startsWith(`${testsDir}/`))
    const testsInDir = files.filter(
      file => path.posix.dirname(file) === testsDir && INTEGRATION_TEST.test(file)
    ).length
    if (hasPair && hasTestsDir) violations.push(atContainer(dir, REASON_PAIR_AND_DIR))
    else if (!hasPair && testsInDir === 0) violations.push(atContainer(dir, REASON_NO_TESTS))
    else if (!hasPair && testsInDir === 1) {
      violations.push({ file: `${testsDir}/`, reason: REASON_LONE_IN_DIR })
    }
  }
  return { violations, containers, containerDirs, ioDirs: new Set(ioDirs) }
}

// hooks/ フォルダの置き場の違反。containers はコンテナの index.tsx のパス(layoutOf の結果)
const hooksViolationsOf = (files, containers) => {
  // 隣にコンテナの index.tsx の無い hooks/ フォルダ(src/hooks/ は除く。表示部品の index.tsx の隣も落とす)
  const isLonely = dir =>
    dir !== ROOT_HOOKS_DIR && !containers.has(`${path.posix.dirname(dir)}/${CONTAINER_ENTRY}`)
  return [...hooksDirsOf(files)]
    .filter(isLonely)
    .map(dir => ({ file: `${dir}/`, reason: REASON_LONELY_HOOKS }))
}

// index.tsx のあるフォルダの、ほかの入口の名前(index.ts・index.d.ts・index.js・index.jsx)の違反
const otherEntryViolationsOf = files => {
  const entryDirs = new Set(
    files
      .filter(file => path.posix.basename(file) === CONTAINER_ENTRY)
      .map(file => path.posix.dirname(file))
  )
  return files
    .filter(
      file => entryDirs.has(path.posix.dirname(file)) && OTHER_ENTRY.test(path.posix.basename(file))
    )
    .map(file => ({ file, reason: REASON_OTHER_ENTRY }))
}

// 1 ファイルずつ見るファイルか。src のテスト・部品・フィクスチャ・もとの名前と、__tests__/ の中のファイルの全部
const isPerFileTarget = file =>
  TEST_FILE.test(file) ||
  TEST_SUPPORT.test(file) ||
  BROWSER_TEST.test(file) ||
  OLD_NAMES.has(path.posix.basename(file)) ||
  inTestsDir(file)

// 名前だけを見るファイルか(tests/ の統合テストに見える名前と、もとの名前)
const isNameOnlyTarget = file =>
  INTEGRATION_NAME.test(file) || BROWSER_TEST.test(file) || OLD_NAMES.has(path.posix.basename(file))

// 全体の検査。files は src とリポジトリ直下の __tests__/ のファイル、nameOnlyFiles は名前だけを見るファイル(tests/ の統合テストに見える名前ともとの名前)、
// ioDirs は I/O コンテナのフォルダの一覧。
// 1 ファイル 1 件で数える。hooks/ と renderHook の理由を先に出し、無ければ置き場(もとの名前・統合テストの側の部品の置き場も)、
// その次に中身の import(コードのときだけ)、最後に __tests__/ の中の名前を見る。名前より import を先に見るのは、
// __tests__/ の部品の名前を直しただけで描く道具の import が残るのを、最初の報告で分かるようにするため。返すのは { file, reason } の一覧
const checkTree = (files, nameOnlyFiles, ioDirs, readCode) => {
  const layout = layoutOf(files, ioDirs, readCode)
  const integrationSupports = integrationSupportsOf(files, readCode)
  const perFile = files.filter(isPerFileTarget).flatMap(file => {
    const reason =
      (TEST_FILE.test(file) ? violationOf(file, () => readCode(file)) : supportViolationOf(file)) ??
      placementViolationOf(file, layout) ??
      supportPlaceViolationOf(file, layout.containerDirs, integrationSupports) ??
      (CODE_FILE.test(file)
        ? importViolationOf(file, readCode(file), layout.containerDirs)
        : undefined) ??
      testsNameViolationOf(file)
    return reason === undefined ? [] : [{ file, reason }]
  })
  const nameOnly = nameOnlyFiles.flatMap(file => {
    const reason = placementViolationOf(file, layout)
    return reason === undefined ? [] : [{ file, reason }]
  })
  return [
    ...perFile,
    ...nameOnly,
    ...layout.violations,
    ...hooksViolationsOf(files, layout.containers),
    ...otherEntryViolationsOf(files),
  ]
}

// ---- 自己検査 ----
// 正規表現や注釈の外し方・import の判定・コンテナのフォルダの数え方・__tests__/ の名前の判定が壊れると、違反を見逃したまま「違反なし」で通る
// (下の 0 件の検査は、src を見失ったときしか落ちない)。そこで違反と分かっている文字列と違反でない文字列を、
// 実際の検査と同じ関数でメモリの上で判定し、期待と違えば落とす
const TEST_FILE_CASES = [
  ['src/a.test.ts', true],
  ['src/a.test.tsx', true],
  ['src/a.browser.test.tsx', true],
  ['src/a.browser.test.ts', true],
  ['src/components/A/__tests__/b.integration.test.tsx', true],
  ['src/components/A/index.integration.test.tsx', true],
  ['src/a.ts', false],
  ['src/a.test.ts.snap', false],
]
// [パス, 中身, 期待する理由]
const VIOLATION_CASES = [
  ['src/hooks/use-a.test.ts', '', REASON_HOOK_TEST],
  ['src/components/A/hooks/use-b/use-b.test.tsx', '', REASON_HOOK_TEST],
  ['src/components/A/hooks/use-b.integration.test.tsx', '', REASON_HOOK_TEST],
  ['src/components/A/hooks/__tests__/b.integration.test.tsx', '', REASON_HOOK_TEST],
  ['src/use-hooks/a.test.ts', '', undefined],
  ['src/a.test.ts', `import { renderHook } from '@testing-library/react'`, REASON_RENDER_HOOK],
  ['src/a.test.tsx', 'const r = rtl.renderHook(() => useA())', REASON_RENDER_HOOK],
  [
    'src/components/A/__tests__/b.integration.test.tsx',
    'const r = renderHook(() => useA())',
    REASON_RENDER_HOOK,
  ],
  [
    'src/components/A/index.integration.test.tsx',
    'const r = renderHook(() => useA())',
    REASON_RENDER_HOOK,
  ],
  // URL の :// は行注釈ではないので、その後ろの renderHook を拾う
  ['src/a.test.ts', `const r = load('https://example.com/', renderHook)`, REASON_RENDER_HOOK],
  ['src/a.test.ts', '// renderHook を使わない', undefined],
  ['src/a.test.ts', 'const a = 1 // renderHook を使わない', undefined],
  ['src/a.test.ts', '/*\n * renderHook を使わない\n */', undefined],
  ['src/a.test.ts', 'const renderHooked = 1', undefined],
]
// [パス, 期待する理由]
const SUPPORT_CASES = [
  ['src/hooks/a.test-helper.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/use-b/b.fixture.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/index.fixture.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/__tests__/a.test-helper.ts', REASON_HOOK_SUPPORT],
  ['src/components/A/hooks/use-b.ts', undefined],
  ['src/use-hooks/a.test-helper.ts', undefined],
  ['src/components/A/a.fixture.ts', undefined],
  ['src/components/A/__tests__/a.test-helper.ts', undefined],
]
// [パス, 期待する理由]。__tests__/ に置ける名前(統合テスト・部品・フィクスチャ・文書)と、それ以外
const NAME_CASES = [
  ['src/components/A/__tests__/b.integration.test.tsx', undefined],
  ['src/components/A/__tests__/b.test-helper.ts', undefined],
  ['src/components/A/__tests__/index.fixture.ts', undefined],
  ['src/components/A/__tests__/README.md', undefined],
  ['src/components/A/__tests__/render.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/render.tsx', REASON_TESTS_NAME],
  ['src/components/A/__tests__/index.tsx', REASON_TESTS_NAME],
  ['src/components/A/__tests__/container.tsx', REASON_TESTS_NAME],
  ['src/components/A/__tests__/container.fixture.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.test-helper.tsx', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.test-helpers.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.helper.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/data.fixture.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/x.index.fixture.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/index.fixture.tsx', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.integration.test.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.test.ts', REASON_TESTS_NAME],
  ['src/components/A/__tests__/data.json', REASON_TESTS_NAME],
  ['src/components/A/__tests__/b.integration.test.tsx.snap', REASON_TESTS_NAME],
  ['__tests__/a/render.ts', REASON_TESTS_NAME],
  // __tests__/ の外(名前の前の方が同じだけのフォルダも)は見ない
  ['src/components/A/render.ts', undefined],
  ['src/components/A/__tests__x/render.ts', undefined],
  ['tests/a.ts', undefined],
]

// 偽の作業ツリー(パス → 中身)と I/O コンテナの一覧。Lonely は一覧にあるのに index.tsx もテストも無い
const FAKE_IO_DIRS = ['src/components/Screen', 'src/components/ui/Player', 'src/components/Lonely']
// フックを呼ぶ index.tsx の中身(コンテナになる)
const HOOKED = 'const [open] = useState(false)'
const SCREEN_IMPORT = `import Screen from '@/components/Screen'`
const RTL_IMPORT = `import { render } from '@testing-library/react'`
const FAKE_TREE = new Map(
  Object.entries({
    // I/O コンテナで通るもの: フックを使わなくても一覧のフォルダの index.tsx はコンテナ・__tests__/ に統合テストが2本以上
    // (どちらも別名で自分のコンテナを描く)・その中のフィクスチャ・部品・文書
    'src/components/Screen/index.tsx': 'export default function Screen() {}',
    'src/components/Screen/hooks/use-screen.ts': '',
    'src/components/Screen/__tests__/open.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/__tests__/close.integration.test.tsx': `const Screen = await import('@/components/Screen')`,
    'src/components/Screen/__tests__/index.fixture.ts': `import type Screen from '@/components/Screen'`,
    'src/components/Screen/__tests__/screen.test-helper.ts': `import { page } from 'vitest/browser'`,
    'src/components/Screen/__tests__/README.md': '',
    // 横断部品の I/O コンテナで通るもの: 対のファイルと、index.tsx の隣のフィクスチャ・部品
    'src/components/ui/Player/index.tsx': '',
    'src/components/ui/Player/index.integration.test.tsx': `import Player from '@/components/ui/Player'`,
    'src/components/ui/Player/index.fixture.ts': '',
    'src/components/ui/Player/player.test-helper.ts': `import { page } from 'vitest/browser'`,
    // 状態コンテナ(フックを使う index.tsx)で通るもの: 対のファイル・__tests__/ に2本以上と部品・I/O コンテナの外で自分のフォルダに置くもの
    'src/components/Screen/components/StoryBody/index.tsx': HOOKED,
    'src/components/Screen/components/StoryBody/hooks/use-story-body.ts': '',
    'src/components/Screen/components/StoryBody/index.integration.test.tsx': `import StoryBody from '@/components/Screen/components/StoryBody'`,
    'src/components/Screen/components/StoryBody/components/Inner/index.tsx': '',
    'src/components/Screen/components/Tabs/index.tsx': `const id = React.useId()`,
    'src/components/Screen/components/Tabs/__tests__/switch.integration.test.tsx': `import Tabs from '@/components/Screen/components/Tabs'`,
    'src/components/Screen/components/Tabs/__tests__/focus.integration.test.tsx': `${RTL_IMPORT}\nimport Tabs from '@/components/Screen/components/Tabs'`,
    'src/components/Screen/components/Tabs/__tests__/tabs.test-helper.ts': '',
    'src/components/ui/Badge/index.tsx': `import { useBadge } from './hooks/use-badge'\nexport const Badge = () => useBadge()`,
    'src/components/ui/Badge/hooks/use-badge.ts': '',
    'src/components/ui/Badge/index.integration.test.tsx': `import Badge from '@/components/ui/Badge'`,
    'src/components/ui/Badge/index.module.css': '',
    // 単体テストの側で通るもの: 対象の隣のテスト・部品・データ
    'src/lib/png.test.ts': '',
    'src/lib/png.test-helper.ts': '',
    'src/lib/sprites.fixture.ts': '',
    'src/hooks/use-theme.ts': '',
    // index.tsx の無いフォルダの index.ts は入口の名前の決まりに掛からない
    'src/lib/village/index.ts': '',
    // 対のファイルと __tests__/ を同じフォルダに両方置く
    'src/components/Screen/components/Both/index.tsx': HOOKED,
    'src/components/Screen/components/Both/index.integration.test.tsx': `import Both from '@/components/Screen/components/Both'`,
    'src/components/Screen/components/Both/__tests__/extra.integration.test.tsx': `import Both from '@/components/Screen/components/Both'`,
    // __tests__/ に統合テストが1本だけ
    'src/components/Screen/components/Lone/index.tsx': HOOKED,
    'src/components/Screen/components/Lone/__tests__/only.integration.test.tsx': `import Lone from '@/components/Screen/components/Lone'`,
    'src/components/Screen/components/Lone/__tests__/lone.test-helper.ts': '',
    // 表示部品(フックを使わない index.tsx。注釈と文字列の中のフックは数えない)の隣の統合テストと __tests__/
    'src/components/Screen/components/Label/index.tsx': `// useState(0)\nexport const label = 'useRef()'`,
    'src/components/Screen/components/Label/index.integration.test.tsx': `import Label from '@/components/Screen/components/Label'`,
    'src/components/Screen/components/Label/__tests__/show.integration.test.tsx': `import Label from '@/components/Screen/components/Label'`,
    // コンテナの隣でも対のファイルの名前でないもの・*.integration.test.ts・kebab-case でない名前・__tests__/ の中の対のファイルの名前
    'src/components/Screen/components/StoryBody/scroll.integration.test.tsx': `import StoryBody from '@/components/Screen/components/StoryBody'`,
    'src/components/Screen/__tests__/open.integration.test.ts': SCREEN_IMPORT,
    'src/components/Screen/__tests__/OpenModal.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/__tests__/index.integration.test.tsx': SCREEN_IMPORT,
    // hooks/ の中の統合テスト
    'src/components/Screen/hooks/use-screen.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/hooks/__tests__/a.integration.test.tsx': SCREEN_IMPORT,
    // リポジトリ直下の __tests__/(文書も)
    '__tests__/screen/open.integration.test.tsx': SCREEN_IMPORT,
    '__tests__/screen/index.fixture.ts': '',
    '__tests__/AGENTS.md': '',
    // __tests__/ の下のフォルダ
    'src/components/Screen/__tests__/deep/a.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/__tests__/deep/b.test-helper.ts': '',
    // コンテナのフォルダでない所の __tests__/
    'src/lib/__tests__/a.test-helper.ts': '',
    'src/components/__tests__/a.integration.test.tsx': SCREEN_IMPORT,
    // 自分のフォルダのコンテナを別名で描かない(型だけ・ほかのコンテナ・相対パス・…/index)
    'src/components/Screen/__tests__/typed.integration.test.tsx': `import type Screen from '@/components/Screen'`,
    'src/components/Screen/components/Tabs/__tests__/other.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/components/Tabs/__tests__/relative.integration.test.tsx': `import Tabs from '../index'`,
    'src/components/Screen/components/Tabs/__tests__/index-path.integration.test.tsx': `import Tabs from '@/components/Screen/components/Tabs/index'`,
    // テストの無いコンテナ(別名で受けたフックを呼ぶもの・__tests__/ に部品だけがあるもの・I/O コンテナの外で自分のフォルダに置くものも)
    'src/components/Screen/components/Card/index.tsx': `import { useState as state } from 'react'\nconst [open] = state(false)`,
    'src/components/Screen/components/Helped/index.tsx': HOOKED,
    'src/components/Screen/components/Helped/__tests__/helped.test-helper.ts': '',
    'src/components/ui/Mute/index.tsx': `const ref = React.useRef<HTMLDivElement>(null)`,
    // 表示部品がフックを呼び始めた(テストは無い。表示部品の隣の部品・CSS はそのまま)
    'src/components/Screen/components/Started/index.tsx': `export default function Started() {\n  const [open] = useState(false)\n  return open\n}`,
    'src/components/Screen/components/Started/started.module.css': '',
    // __tests__/ に置けない名前(描く道具を import するものは、名前より先にそちらで落ちる)と、置ける名前で描く道具を import するもの
    'src/components/Screen/__tests__/render.ts': RTL_IMPORT,
    'src/components/Screen/__tests__/draw.test-helper.tsx': `import { createRoot } from 'react-dom/client'`,
    'src/components/Screen/__tests__/paint.test-helper.ts': RTL_IMPORT,
    'src/components/Screen/__tests__/data.ts': 'export const data = 1',
    'src/components/Screen/__tests__/view.test-helper.tsx': 'export const view = 1',
    'src/components/Screen/__tests__/screen.test-helpers.ts': '',
    'src/components/Screen/__tests__/data.fixture.ts': '',
    'src/components/Screen/__tests__/data.json': '{}',
    'src/components/Screen/__tests__/math.test.ts': '',
    'src/components/Screen/__tests__/index.tsx': HOOKED,
    // I/O コンテナのフォルダでない所の index.fixture.ts
    'src/components/ui/Badge/index.fixture.ts': '',
    'src/components/Screen/components/Tabs/__tests__/index.fixture.ts': '',
    'src/lib/index.fixture.ts': '',
    // もとの名前(I/O コンテナのフォルダの中でも・中身がフックを呼んでも・__tests__/ の中でも)
    'src/components/Screen/container.browser.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/components/Old/container.tsx': HOOKED,
    'src/components/Screen/components/Old/container.integration.test.tsx': `import Old from './container'`,
    'src/components/ui/Player/container.fixture.ts': '',
    'src/components/Screen/__tests__/container.integration.test.tsx': SCREEN_IMPORT,
    'src/components/Screen/__tests__/container.fixture.ts': '',
    // hooks/ フォルダ: src/hooks/ は通り、隣にコンテナの index.tsx の無いもの(表示部品の隣も)は落ちる。
    // hooks/ の中の index.tsx はフックを呼んでも入口でない(ESLint の規則が落とす)
    'src/components/Screen/components/View/index.tsx': '',
    'src/components/Screen/components/View/hooks/use-view.ts': '',
    'src/lib/hooks/use-lib.ts': '',
    'src/components/Screen/hooks/index.tsx': HOOKED,
    // index.tsx のあるフォルダの、ほかの入口の名前(コンテナの隣も表示部品の隣も)
    'src/components/Screen/components/StoryBody/index.js': '',
    'src/components/ui/Badge/index.ts': '',
    'src/components/Screen/components/View/index.d.ts': '',
    // 統合テストの側が import する部品・フィクスチャ: コンテナのフォルダの __tests__/ の中とコンテナの index.tsx の隣は通り
    // (自分のでないコンテナのものも)、表示部品の隣・lib のものは落ちる。__tests__/ の中の部品と、コンテナの index.tsx の隣の部品が
    // import するものも同じ(部品から部品へたどる)
    'src/components/Screen/__tests__/helpers.integration.test.tsx': [
      SCREEN_IMPORT,
      `import { step } from './screen.test-helper'`,
      `import type { Data } from './index.fixture'`,
      `import { tab } from '../components/Tabs/__tests__/tabs.test-helper'`,
      `import { play } from '@/components/ui/Player/player.test-helper'`,
      `import { near } from '../near.test-helper'`,
      `import { shot } from '../components/Shot/shot.test-helper'`,
      `import { fly } from '@/lib/flight.test-helper'`,
    ].join('\n'),
    'src/components/Screen/near.test-helper.ts': `export { lamp } from '../../lib/lamp.test-helper'`,
    'src/components/Screen/__tests__/walk.test-helper.ts': `import { route } from '@/lib/route.fixture'`,
    'src/components/Screen/components/Shot/index.tsx': '',
    'src/components/Screen/components/Shot/shot.test-helper.ts': '',
    'src/lib/flight.test-helper.ts': '',
    'src/lib/lamp.test-helper.ts': '',
    'src/lib/route.fixture.ts': '',
    // 単体テストだけが使う部品は、表示部品・utils・lib のフォルダに置いても通る
    'src/lib/sprites.test.ts': `import { sprites } from './sprites.fixture'\nimport { decode } from './png.test-helper'`,
    'src/components/Screen/utils/walk-loop/tick.test.ts': `import { frame } from './walk-loop.test-helper'`,
    'src/components/Screen/utils/walk-loop/walk-loop.test-helper.ts': '',
  })
)
const FAKE_NAME_ONLY = [
  'tests/a.integration.test.tsx',
  'tests/b.browser.test.ts',
  'tests/container.fixture.ts',
]
const at = (file, reason) => `${file}: ${reason}`
const EXPECTED_TREE = [
  at('src/components/Screen/components/Label/index.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at(
    'src/components/Screen/components/Label/__tests__/show.integration.test.tsx',
    REASON_TESTS_NOT_CONTAINER
  ),
  at(
    'src/components/Screen/components/StoryBody/scroll.integration.test.tsx',
    REASON_INTEGRATION_PLACE
  ),
  at('src/components/Screen/__tests__/open.integration.test.ts', REASON_INTEGRATION_PLACE),
  at('src/components/Screen/__tests__/OpenModal.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('src/components/Screen/__tests__/index.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('src/components/Screen/hooks/use-screen.integration.test.tsx', REASON_HOOK_TEST),
  at('src/components/Screen/hooks/__tests__/a.integration.test.tsx', REASON_HOOK_TEST),
  at('__tests__/screen/open.integration.test.tsx', REASON_ROOT_TESTS),
  at('__tests__/screen/index.fixture.ts', REASON_ROOT_TESTS),
  at('__tests__/AGENTS.md', REASON_ROOT_TESTS),
  at('src/components/Screen/__tests__/deep/a.integration.test.tsx', REASON_TESTS_SUBDIR),
  at('src/components/Screen/__tests__/deep/b.test-helper.ts', REASON_TESTS_SUBDIR),
  at('src/lib/__tests__/a.test-helper.ts', REASON_TESTS_NOT_CONTAINER),
  at('src/components/__tests__/a.integration.test.tsx', REASON_TESTS_NOT_CONTAINER),
  at('src/components/Screen/__tests__/typed.integration.test.tsx', REASON_NOT_OWN_CONTAINER),
  at(
    'src/components/Screen/components/Tabs/__tests__/other.integration.test.tsx',
    REASON_NOT_OWN_CONTAINER
  ),
  at(
    'src/components/Screen/components/Tabs/__tests__/relative.integration.test.tsx',
    REASON_NOT_OWN_CONTAINER
  ),
  at(
    'src/components/Screen/components/Tabs/__tests__/index-path.integration.test.tsx',
    REASON_NOT_OWN_CONTAINER
  ),
  at('src/components/Screen/components/Both/index.tsx', REASON_PAIR_AND_DIR),
  at('src/components/Screen/components/Lone/__tests__/', REASON_LONE_IN_DIR),
  at('src/components/Screen/components/Card/index.tsx', REASON_NO_TESTS),
  at('src/components/Screen/components/Helped/index.tsx', REASON_NO_TESTS),
  at('src/components/ui/Mute/index.tsx', REASON_NO_TESTS),
  at('src/components/Lonely/index.tsx', REASON_NO_TESTS),
  at('src/components/Screen/components/Started/index.tsx', REASON_NO_TESTS),
  at('src/components/Screen/__tests__/render.ts', REASON_UNIT_RENDER),
  at('src/components/Screen/__tests__/draw.test-helper.tsx', REASON_UNIT_RENDER),
  at('src/components/Screen/__tests__/paint.test-helper.ts', REASON_UNIT_RENDER),
  at('src/components/Screen/__tests__/data.ts', REASON_TESTS_NAME),
  at('src/components/Screen/__tests__/view.test-helper.tsx', REASON_TESTS_NAME),
  at('src/components/Screen/__tests__/screen.test-helpers.ts', REASON_TESTS_NAME),
  at('src/components/Screen/__tests__/data.fixture.ts', REASON_TESTS_NAME),
  at('src/components/Screen/__tests__/data.json', REASON_TESTS_NAME),
  at('src/components/Screen/__tests__/math.test.ts', REASON_TESTS_UNIT),
  at('src/components/Screen/__tests__/index.tsx', REASON_TESTS_NAME),
  at('src/components/ui/Badge/index.fixture.ts', REASON_FIXTURE_PLACE),
  at('src/components/Screen/components/Tabs/__tests__/index.fixture.ts', REASON_FIXTURE_PLACE),
  at('src/lib/index.fixture.ts', REASON_FIXTURE_PLACE),
  at('src/components/Screen/container.browser.test.tsx', REASON_BROWSER_OLD),
  at('src/components/Screen/components/Old/container.tsx', REASON_OLD_NAME),
  at('src/components/Screen/components/Old/container.integration.test.tsx', REASON_OLD_NAME),
  at('src/components/ui/Player/container.fixture.ts', REASON_OLD_NAME),
  at('src/components/Screen/__tests__/container.integration.test.tsx', REASON_OLD_NAME),
  at('src/components/Screen/__tests__/container.fixture.ts', REASON_OLD_NAME),
  at('tests/a.integration.test.tsx', REASON_INTEGRATION_PLACE),
  at('tests/b.browser.test.ts', REASON_BROWSER_OLD),
  at('tests/container.fixture.ts', REASON_OLD_NAME),
  at('src/components/Screen/components/View/hooks/', REASON_LONELY_HOOKS),
  at('src/lib/hooks/', REASON_LONELY_HOOKS),
  at('src/components/Screen/components/StoryBody/index.js', REASON_OTHER_ENTRY),
  at('src/components/ui/Badge/index.ts', REASON_OTHER_ENTRY),
  at('src/components/Screen/components/View/index.d.ts', REASON_OTHER_ENTRY),
  at('src/components/Screen/components/Shot/shot.test-helper.ts', REASON_SUPPORT_PLACE),
  at('src/lib/flight.test-helper.ts', REASON_SUPPORT_PLACE),
  at('src/lib/lamp.test-helper.ts', REASON_SUPPORT_PLACE),
  at('src/lib/route.fixture.ts', REASON_SUPPORT_PLACE),
].sort()
// コンテナを置けない所のコンテナ(対のファイルがあっても、落ちるのはその index.tsx の1件だけ)。上の偽の作業ツリーに入れると
// src/components がコンテナのフォルダになり、そこの __tests__/ の例の意味が変わるので分ける。
// src/components の外にコンテナができるのは、I/O コンテナの一覧のフォルダが外にあるときだけ(外の index.tsx はフックを呼んでもコンテナに数えない。
// ESLint の規則が落とす)なので、偽の一覧に外のフォルダを入れて見る
const FAKE_OUTSIDE_IO_DIRS = ['src/app/x', 'src/app/y', 'src/lib/a', 'src/hooks']
const FAKE_OUTSIDE_TREE = new Map(
  Object.entries({
    'src/app/x/index.tsx': '',
    'src/app/x/index.integration.test.tsx': `import X from '@/app/x'`,
    'src/lib/a/index.tsx': '',
    'src/lib/a/index.integration.test.tsx': `import A from '@/lib/a'`,
    // src/hooks/ の中の統合テストは、それだけで hooks/ の決まりでも落ちる
    'src/hooks/index.tsx': '',
    'src/hooks/index.integration.test.tsx': `import H from '@/hooks'`,
    'src/components/index.tsx': HOOKED,
    'src/components/index.integration.test.tsx': `import C from '@/components'`,
    'src/components/ui/index.tsx': HOOKED,
    'src/components/ui/index.integration.test.tsx': `import U from '@/components/ui'`,
    // テストが無くても、落ちるのは置き場の1件だけ(テストの数え方は見ない)
    'src/app/y/index.tsx': '',
    // src/components の外の index.tsx は、フックを呼んでもコンテナに数えない(テストも要らない)
    'src/app/z/index.tsx': HOOKED,
    // 置ける所(比べる相手。<名前> のフォルダ自身と ui/<名前> のフォルダ自身)。hooks/ の中の index.tsx はコンテナに数えない
    'src/components/Foo/index.tsx': HOOKED,
    'src/components/Foo/index.integration.test.tsx': `import Foo from '@/components/Foo'`,
    'src/components/Foo/hooks/index.tsx': HOOKED,
    'src/components/ui/Bar/index.tsx': HOOKED,
    'src/components/ui/Bar/index.integration.test.tsx': `import Bar from '@/components/ui/Bar'`,
  })
)
const EXPECTED_OUTSIDE_TREE = [
  at('src/app/x/index.tsx', REASON_CONTAINER_PLACE),
  at('src/app/y/index.tsx', REASON_CONTAINER_PLACE),
  at('src/lib/a/index.tsx', REASON_CONTAINER_PLACE),
  at('src/hooks/index.tsx', REASON_CONTAINER_PLACE),
  at('src/hooks/index.integration.test.tsx', REASON_HOOK_TEST),
  at('src/components/index.tsx', REASON_CONTAINER_PLACE),
  at('src/components/ui/index.tsx', REASON_CONTAINER_PLACE),
].sort()
// [コンテナのフォルダ, 置けるか]
const CONTAINER_PLACE_CASES = [
  ['src/components/Foo', true],
  ['src/components/Foo/components/Bar', true],
  ['src/components/ui/Logo', true],
  ['src/components/ui/Logo/components/Mark', true],
  ['src/components/uiX', true],
  ['src/components/uiX/components/A', true],
  ['src/app/x', false],
  ['src/lib/a', false],
  ['src/hooks', false],
  ['src', false],
  ['src/components', false],
  ['src/components/ui', false],
  ['src/componentsX/A', false],
  ['lib/components/Foo', false],
]
// [I/O コンテナの一覧, 期待する理由]。7つ目を足す・1つ消す・1つ差し替える・並びを変えるのは落ちる
const IO_DIRS_CASES = [
  [[...EXPECTED_IO_DIRS], undefined],
  [[...EXPECTED_IO_DIRS, 'src/components/ui/Extra'], REASON_IO_DIRS],
  [EXPECTED_IO_DIRS.slice(1), REASON_IO_DIRS],
  [[...EXPECTED_IO_DIRS.slice(0, -1), 'src/components/ui/Other'], REASON_IO_DIRS],
  [[...EXPECTED_IO_DIRS].reverse(), REASON_IO_DIRS],
]
const readFake = file => FAKE_TREE.get(file) ?? ''
const FAKE_LAYOUT = layoutOf([...FAKE_TREE.keys()], FAKE_IO_DIRS, readFake)
// コンテナの数え方(フックを使う index.tsx と I/O コンテナの一覧の index.tsx。表示部品・もとの名前・__tests__/ と hooks/ の中は数えない)
const EXPECTED_CONTAINERS = [
  'src/components/Screen/index.tsx',
  'src/components/ui/Player/index.tsx',
  'src/components/Screen/components/StoryBody/index.tsx',
  'src/components/Screen/components/Tabs/index.tsx',
  'src/components/ui/Badge/index.tsx',
  'src/components/Screen/components/Both/index.tsx',
  'src/components/Screen/components/Lone/index.tsx',
  'src/components/Screen/components/Card/index.tsx',
  'src/components/Screen/components/Helped/index.tsx',
  'src/components/ui/Mute/index.tsx',
  'src/components/Screen/components/Started/index.tsx',
].sort()
// [パス, 期待する理由]。コンテナのフォルダは上の偽の作業ツリーのもの
const PLACEMENT_CASES = [
  ['src/components/Screen/__tests__/open.integration.test.tsx', undefined],
  ['src/components/Screen/__tests__/a1-b2.integration.test.tsx', undefined],
  ['src/components/Screen/components/StoryBody/index.integration.test.tsx', undefined],
  ['src/components/ui/Player/index.integration.test.tsx', undefined],
  ['src/components/ui/Badge/index.integration.test.tsx', undefined],
  // I/O コンテナの一覧のフォルダは、index.tsx が無くてもコンテナのフォルダに数える(無いことは別に落とす)
  ['src/components/Lonely/index.integration.test.tsx', undefined],
  ['src/components/Screen/__tests__/index.fixture.ts', undefined],
  ['src/components/ui/Player/index.fixture.ts', undefined],
  ['src/components/ui/Player/__tests__/index.fixture.ts', undefined],
  ['src/components/Lonely/__tests__/index.fixture.ts', undefined],
  ['src/components/Screen/__tests__/screen.test-helper.ts', undefined],
  ['src/components/Screen/components/Tabs/__tests__/tabs.test-helper.ts', undefined],
  ['src/components/ui/Player/player.test-helper.ts', undefined],
  ['src/components/Screen/__tests__/README.md', undefined],
  ['src/lib/png.test-helper.ts', undefined],
  ['src/lib/a.fixture.ts', undefined],
  ['src/utils/a.test.ts', undefined],
  ['src/components/A/index.tsx', undefined],
  // もとの名前(どこにあっても。中身も置き場も見ない)
  ['src/components/A/container.tsx', REASON_OLD_NAME],
  ['src/components/Screen/container.tsx', REASON_OLD_NAME],
  ['src/components/Screen/components/StoryBody/container.integration.test.tsx', REASON_OLD_NAME],
  ['src/components/Screen/container.fixture.ts', REASON_OLD_NAME],
  ['src/components/Screen/__tests__/container.fixture.ts', REASON_OLD_NAME],
  ['src/app/x/container.tsx', REASON_OLD_NAME],
  ['__tests__/container.fixture.ts', REASON_OLD_NAME],
  ['tests/container.integration.test.tsx', REASON_OLD_NAME],
  // リポジトリ直下の __tests__/
  ['__tests__/screen/open.integration.test.tsx', REASON_ROOT_TESTS],
  ['__tests__/index.fixture.ts', REASON_ROOT_TESTS],
  ['__tests__/AGENTS.md', REASON_ROOT_TESTS],
  // __tests__/ の下のフォルダ(__tests__/ の下の __tests__/ も)
  ['src/components/Screen/__tests__/deep/a.integration.test.tsx', REASON_TESTS_SUBDIR],
  ['src/components/Screen/__tests__/__tests__/a.integration.test.tsx', REASON_TESTS_SUBDIR],
  ['src/components/Screen/__tests__/deep/index.fixture.ts', REASON_TESTS_SUBDIR],
  // コンテナのフォルダでない所の __tests__/(表示部品の隣・lib・名前の前の方が同じだけのフォルダ)
  [
    'src/components/Screen/components/Label/__tests__/show.integration.test.tsx',
    REASON_TESTS_NOT_CONTAINER,
  ],
  ['src/lib/__tests__/a.test-helper.ts', REASON_TESTS_NOT_CONTAINER],
  ['src/__tests__/a.integration.test.tsx', REASON_TESTS_NOT_CONTAINER],
  ['src/components/ScreenX/__tests__/index.fixture.ts', REASON_TESTS_NOT_CONTAINER],
  // 統合テストの置き場と名前
  ['src/components/Screen/components/Label/index.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/components/Label/show.integration.test.tsx', REASON_INTEGRATION_PLACE],
  [
    'src/components/Screen/components/StoryBody/scroll.integration.test.tsx',
    REASON_INTEGRATION_PLACE,
  ],
  ['src/components/Screen/index.integration.test.ts', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/__tests__/open.integration.test.ts', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/__tests__/OpenModal.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/__tests__/open_modal.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/__tests__/-open.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/components/Screen/__tests__/index.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/lib/open.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['src/lib/index.integration.test.tsx', REASON_INTEGRATION_PLACE],
  ['tests/a.integration.test.tsx', REASON_INTEGRATION_PLACE],
  // もとの統合テストの名前・__tests__/ の中の単体テスト・src の *.test.tsx
  ['src/components/Screen/container.browser.test.tsx', REASON_BROWSER_OLD],
  ['src/components/Screen/__tests__/container.browser.test.tsx', REASON_BROWSER_OLD],
  ['src/a.browser.test.ts', REASON_BROWSER_OLD],
  ['tests/b.browser.test.js', REASON_BROWSER_OLD],
  ['src/components/Screen/__tests__/math.test.ts', REASON_TESTS_UNIT],
  ['src/components/Screen/__tests__/view.test.tsx', REASON_TESTS_UNIT],
  ['src/components/A/components/X/index.test.tsx', REASON_UNIT_TSX],
  ['src/components/A/index.test.tsx', REASON_UNIT_TSX],
  ['src/utils/a.test.tsx', REASON_UNIT_TSX],
  // I/O コンテナのフォルダでない所の index.fixture.ts(状態コンテナの隣・その __tests__/・名前の前の方が同じだけのフォルダ・lib)
  ['src/components/ui/Badge/index.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/components/Screen/components/Tabs/__tests__/index.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/components/Screen/components/StoryBody/index.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/components/ScreenX/index.fixture.ts', REASON_FIXTURE_PLACE],
  ['src/lib/index.fixture.ts', REASON_FIXTURE_PLACE],
]
// [パス, 中身, 期待する理由]。コンテナのフォルダは上の偽の作業ツリーのもの
const OPEN = 'src/components/Screen/__tests__/open.integration.test.tsx'
const PAIR = 'src/components/Screen/components/StoryBody/index.integration.test.tsx'
const STORY_BODY_IMPORT = `import StoryBody from '@/components/Screen/components/StoryBody'`
const IMPORT_CASES = [
  // 自分のフォルダのコンテナを別名で描く(動的な import・寄り道した別名・ほかのものも描く)
  [OPEN, `${RTL_IMPORT}\n${SCREEN_IMPORT}`, undefined],
  [OPEN, `const Screen = await import('@/components/Screen')`, undefined],
  [OPEN, `import Screen from '@/components/Screen/.'`, undefined],
  [OPEN, `import Screen from '@/components/Screen/../Screen'`, undefined],
  [PAIR, STORY_BODY_IMPORT, undefined],
  [PAIR, `${STORY_BODY_IMPORT}\n${SCREEN_IMPORT}`, undefined],
  [
    PAIR,
    `import { type Props, default as StoryBody } from '@/components/Screen/components/StoryBody'`,
    undefined,
  ],
  // 型だけ・相対パス・…/index・フォルダの中のほかのもの・フィクスチャ・ほかのコンテナ・注釈と文字列の中
  [OPEN, `import type Screen from '@/components/Screen'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import { type Props } from '@/components/Screen'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '../index'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '..'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '@/components/Screen/index'`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `import Screen from '@/components/Screen/container'`, REASON_NOT_OWN_CONTAINER],
  [
    OPEN,
    `import data from '@/components/Screen/__tests__/index.fixture'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [
    OPEN,
    `import StoryBody from '@/components/Screen/components/StoryBody'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  [OPEN, `import Screen from '@/components/ScreenX'`, REASON_NOT_OWN_CONTAINER],
  [PAIR, SCREEN_IMPORT, REASON_NOT_OWN_CONTAINER],
  [PAIR, `import StoryBody from './index'`, REASON_NOT_OWN_CONTAINER],
  [PAIR, `// ${STORY_BODY_IMPORT}`, REASON_NOT_OWN_CONTAINER],
  [OPEN, `const name = '@/components/Screen'`, REASON_NOT_OWN_CONTAINER],
  // コンテナのフォルダでない所の統合テストは、描くべきコンテナが無い
  [
    'src/components/Screen/components/Label/index.integration.test.tsx',
    `import Label from '@/components/Screen/components/Label'`,
    REASON_NOT_OWN_CONTAINER,
  ],
  ['src/lib/index.integration.test.tsx', `import A from '@/lib'`, REASON_NOT_OWN_CONTAINER],
  // 統合テストの外は描く道具を import しない
  ['src/utils/a.test.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { createRoot } from 'react-dom/client'`, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { flushSync } from 'react-dom'`, REASON_UNIT_RENDER],
  [
    'src/utils/a.test.ts',
    `const { renderToString } = await import('react-dom/server')`,
    REASON_UNIT_RENDER,
  ],
  [
    'src/utils/a.test.ts',
    `import type { RenderResult } from '@testing-library/react'`,
    REASON_UNIT_RENDER,
  ],
  ['src/utils/a.test.ts', `export * from '@testing-library/react/pure'`, REASON_UNIT_RENDER],
  ['src/lib/a.test-helper.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/lib/a.fixture.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/components/Screen/__tests__/screen.test-helper.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/components/ui/Player/player.test-helper.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  // __tests__/ の中は、統合テストでないファイルの全部(置けない名前も)が描く道具を import しない。フィクスチャも同じ
  ['src/components/Screen/__tests__/render.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  [
    'src/components/Screen/__tests__/draw.test-helper.tsx',
    `import { createRoot } from 'react-dom/client'`,
    REASON_UNIT_RENDER,
  ],
  ['src/components/Screen/__tests__/index.fixture.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/components/ui/Player/index.fixture.ts', RTL_IMPORT, REASON_UNIT_RENDER],
  ['src/utils/a.test.ts', `import { screen } from '@testing-library/dom'`, undefined],
  ['src/utils/a.test.ts', `// ${RTL_IMPORT}`, undefined],
  ['src/utils/a.test.ts', `const name = 'react-dom/client'`, undefined],
  [
    'src/components/Screen/__tests__/index.fixture.ts',
    `import type Screen from '@/components/Screen'`,
    undefined,
  ],
]
const fakeFound = checkTree([...FAKE_TREE.keys()].sort(), FAKE_NAME_ONLY, FAKE_IO_DIRS, readFake)
const fakeTree = fakeFound.map(({ file, reason }) => at(file, reason)).sort()
const outsideTree = checkTree(
  [...FAKE_OUTSIDE_TREE.keys()].sort(),
  [],
  FAKE_OUTSIDE_IO_DIRS,
  file => FAKE_OUTSIDE_TREE.get(file) ?? ''
)
  .map(({ file, reason }) => at(file, reason))
  .sort()
const fakeContainers = [...FAKE_LAYOUT.containers].sort()
const selfCheckFailures = [
  // 本物の I/O コンテナの一覧が写しと違う
  ...(ioDirsViolationOf(CONTAINER_DIRS) === undefined
    ? []
    : [`I/O コンテナの一覧 ${JSON.stringify(CONTAINER_DIRS)}: ${REASON_IO_DIRS}`]),
  ...IO_DIRS_CASES.filter(([dirs, expected]) => ioDirsViolationOf(dirs) !== expected).map(
    ([dirs, expected]) => `I/O コンテナの一覧の判定 ${JSON.stringify(dirs)} → ${expected}`
  ),
  ...CONTAINER_PLACE_CASES.filter(([dir, expected]) => isContainerPlace(dir) !== expected).map(
    ([dir, expected]) => `コンテナを置ける所の判定 ${dir} → ${expected}`
  ),
  ...(JSON.stringify(fakeContainers) === JSON.stringify(EXPECTED_CONTAINERS)
    ? []
    : [`偽の作業ツリーのコンテナの数え方 ${JSON.stringify(fakeContainers)}`]),
  ...(JSON.stringify(outsideTree) === JSON.stringify(EXPECTED_OUTSIDE_TREE)
    ? []
    : [`置けない所のコンテナの偽の作業ツリー ${JSON.stringify(outsideTree)}`]),
  ...TEST_FILE_CASES.filter(([file, expected]) => TEST_FILE.test(file) !== expected).map(
    ([file, expected]) => `テストの名前の判定 ${file} → ${expected}`
  ),
  ...VIOLATION_CASES.filter(
    ([file, code, expected]) => violationOf(file, () => code) !== expected
  ).map(([file, code, expected]) => `違反の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...SUPPORT_CASES.filter(([file, expected]) => supportViolationOf(file) !== expected).map(
    ([file, expected]) => `部品の置き場の判定 ${file} → ${expected}`
  ),
  ...NAME_CASES.filter(([file, expected]) => testsNameViolationOf(file) !== expected).map(
    ([file, expected]) => `__tests__/ の名前の判定 ${file} → ${expected}`
  ),
  ...PLACEMENT_CASES.filter(
    ([file, expected]) => placementViolationOf(file, FAKE_LAYOUT) !== expected
  ).map(([file, expected]) => `置き場の判定 ${file} → ${expected}`),
  ...IMPORT_CASES.filter(
    ([file, code, expected]) =>
      importViolationOf(file, code, FAKE_LAYOUT.containerDirs) !== expected
  ).map(([file, code, expected]) => `import の判定 ${file} ${JSON.stringify(code)} → ${expected}`),
  ...EXPECTED_TREE.filter(line => !fakeTree.includes(line)).map(
    line => `偽の作業ツリーで拾うべき違反を拾わない: ${line}`
  ),
  ...fakeTree
    .filter(line => !EXPECTED_TREE.includes(line))
    .map(line => `偽の作業ツリーで違反でないものを拾う: ${line}`),
  // 同じ行を2回拾う(数え違い)も、上の2つでは見えないので数で見る
  ...(fakeTree.length !== EXPECTED_TREE.length
    ? [`偽の作業ツリーの違反の数 ${fakeTree.length}(期待 ${EXPECTED_TREE.length})`]
    : []),
]
if (selfCheckFailures.length > 0) {
  throw new Error(
    `check-test-boundary: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}

const filesUnder = dir =>
  existsSync(path.join(ROOT, dir))
    ? walk(path.join(ROOT, dir)).map(file => toPosix(path.relative(ROOT, file)))
    : []
const files = SCAN_DIRS.flatMap(filesUnder).sort()
const nameOnlyFiles = NAME_SCAN_DIRS.flatMap(filesUnder).filter(isNameOnlyTarget).sort()
const srcTestFiles = files.filter(file => file.startsWith('src/') && TEST_FILE.test(file))

// 1件も拾えないときは、違反が無いのではなく見る場所を間違えている
if (srcTestFiles.length === 0) {
  console.error('check-test-boundary: src にテストが1件も無い。対象の指定を疑うこと')
  process.exit(1)
}

const read = file => readFileSync(path.join(ROOT, file), 'utf8')
const found = checkTree(files, nameOnlyFiles, CONTAINER_DIRS, read)
const failures = found.map(({ file, reason }) => at(file, reason))

if (failures.length > 0) {
  console.error(`check-test-boundary: ${failures.length} 件の違反`)
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

const integrationFiles = srcTestFiles.filter(file => INTEGRATION_TEST.test(file))
const pairCount = integrationFiles.filter(file => path.posix.basename(file) === PAIR_TEST).length
const supportCount = files.filter(file => TEST_SUPPORT.test(file)).length
const { containers } = layoutOf(files, CONTAINER_DIRS, read)
const entryCount = files.filter(file => path.posix.basename(file) === CONTAINER_ENTRY).length
console.log(
  `check-test-boundary: src の単体テスト ${srcTestFiles.length - integrationFiles.length} 件・統合テスト ${integrationFiles.length} 件` +
    `(対のファイル ${pairCount} 件・__tests__/ の中 ${integrationFiles.length - pairCount} 件)・フィクスチャとテストの部品 ${supportCount} 件・` +
    `index.tsx ${entryCount} 件(コンテナ ${containers.size} 個・I/O コンテナの一覧 ${CONTAINER_DIRS.length} か所)を検査 — 違反なし`
)
