// 変異テスト(Stryker)の設定。npm run test:mutation で走り、CI では test:coverage の後に走る。
// 既定は前回の結果を使い、変わった変異体だけを走らせる(incremental。下の注釈)。
// 全部を走らせるのは npm run test:mutation -- --force(docs/decisions/0013-incremental-mutation-on-push.md)
//
// 純粋モジュールは人がコードを読んで確かめない。その代わりに、元のコードを1か所ずつ壊した変異体
// (演算子・比較・定数・条件の入れ替え)を、テストが1体残らず見抜けることを機械に確かめさせる。
// 生き残った変異体は「テストが見ていない振る舞い」なので、1体でも残れば落とす(しきい値がすべて100の理由)。
// 時間切れ(Timeout)の変異体も1体でもあれば落とす。Stryker は時間切れを落とした数に入れるのでしきい値では落ちず、
// npm run test:mutation の入口の scripts/run-mutation.mjs が落とす(docs/decisions/0021-fail-on-mutation-timeout.md)。
// 待ち時間(timeoutMS・timeoutFactor)は既定のままにし、延ばさない。変異で止まらなくなるループはコードの形を直す。
// しきい値を下げる・対象から外すときは、先に ADR を書く
//
// 対象は純粋モジュールの置き場(src/lib/・src/utils/・コンポーネント専用の utils/)の全部で、一覧を手で並べない。
// 正本は scripts/gate-targets.mjs の MUTATION_TARGETS で、設定を読むたびに src をたどって選ぶ。新しい純粋モジュールは
// 置いた時点で対象になる(docs/decisions/0014-gate-all-pure-modules.md)。ドット絵の行列と色の表はデータなので外す
// (文字を消した変異体を見抜くには絵を丸ごと写したテストが要るだけで、振る舞いは守れない。理由の詳細は gate-targets.mjs の注釈)。
// 名指しで外したパスが実在しないと、gate-targets.mjs を読み込む時点で落ちる
//
// モジュールを読む時に投げる変異体(トップレベルの検査や定数の組み立てを壊したもの)は、テストファイルの
// import が失敗してテストが1本も走らず(Vitest の収集エラー)、Stryker はそれを Survived と数える(2026-10-11 に実測)。
// そういうモジュールのテストは、テストの中で vi.resetModules() してから動的に import し(await import(...))、
// 読み込みの失敗を個々のテストの失敗として受ける
//
// TZ=UTC は package.json の scripts 側で付ける(vitest.config.ts と同じく、時刻の結果を機器に左右させない)
import { MUTATION_TARGETS } from './scripts/gate-targets.mjs'

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  // 変異体ごとに、その箇所を通るテストだけを走らせる
  coverageAnalysis: 'perTest',
  mutate: MUTATION_TARGETS,
  thresholds: { high: 100, low: 100, break: 100 },
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // 前回の結果をファイルに残し、次の実行では変わった変異体だけを走らせる。CI はこのファイルを
  // キャッシュで持ち回るので、push ごとに全部を走らせずに済む。結果ファイルが無い新しい作業ツリーでは、
  // scripts/run-mutation.mjs がほかの作業ツリーの最も新しい結果を写して引き継ぐ。
  // 穴: Stryker が比べるのは mutate のファイルとテストファイルだけで、ほかのファイルが変わっても気付かず、前回の結果を
  // 使い回す。前回落とした変異体は、今は生き残るとしても落としたままと数える(2026-10-18 に実測)。
  // 埋め方: テストから import の文をたどって届く src・content のファイル(mutate のファイルが import する別のファイル・
  // テストが import する *.test-helper.ts・*.fixture.ts など)は、npm run test:mutation の入口の scripts/run-mutation.mjs が
  // テストファイルごとに届くファイルの指紋を前回と比べ、指紋が変わったテストが前回落とした変異体を取り除いて測り直させる
  // (scripts/fingerprint-tests.mjs・docs/decisions/0025-remeasure-kills-on-test-deps.md)。
  // それでも見ないもの(依存パッケージ・この設定・vitest.config.ts・src と content の外のファイル・fs で読むファイル・
  // 式で組んだ import() の先・vi.mock などに文字列で書くだけのパス)は、週1回、手で npm run test:mutation -- --force を
  // 走らせて全部を測り直す。CI も手元も、package-lock.json・この設定・vitest.config.ts が変わっても全部は走らせず、
  // 最も新しい結果を引き継ぐ
  // (docs/decisions/0023-inherit-latest-mutation-result.md)。
  // 逆向きの穴(前回の生き残りを使い回し、テストを直しても落ち続ける)は、npm run test:mutation の入口の
  // scripts/run-mutation.mjs が埋める。走らせる前に結果ファイルから落とせなかった変異体と時間切れを取り除き、毎回測り直させる
  // (npx stryker run を直接叩くと通らず、時間切れでも落ちない。理由と実測は scripts/run-mutation.mjs の注釈)
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  tempDirName: '.stryker-tmp',
  // Stryker は作業用の写しを作るとき .gitignore を読まない。手元にしか無い大きなフォルダ
  // (.claude/ の作業ツリー・ビルド成果物・報告)まで写さないよう、ここで外す
  ignorePatterns: [
    '/.claude',
    '/.next',
    '/out',
    '/coverage',
    '/test-results',
    '/playwright-report',
    '/reports',
    '/.lighthouseci',
  ],
}

export default config
