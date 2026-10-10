// 変異テスト(Stryker)の設定。npm run test:mutation で走り、CI では test:coverage の後に走る。
// 既定は前回の結果を使い、変わった変異体だけを走らせる(incremental。下の注釈)。
// 全部を走らせるのは npm run test:mutation -- --force(docs/decisions/0013-incremental-mutation-on-push.md)
//
// 新しい純粋モジュールは人がコードを読んで確かめない。その代わりに、元のコードを1か所ずつ壊した変異体
// (演算子・比較・定数・条件の入れ替え)を、テストが1体残らず見抜けることを機械に確かめさせる。
// 生き残った変異体は「テストが見ていない振る舞い」なので、1体でも残れば落とす(しきい値がすべて100の理由)。
// しきい値を下げる・mutate から外すときは、先に ADR を書く
//
// TZ=UTC は package.json の scripts 側で付ける(vitest.config.ts と同じく、時刻の結果を機器に左右させない)
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 「変異テスト100%を守るファイル」の正本。足すときは vitest.config.ts の FULL_COVERAGE_FILES にも
// 同じパスを並べる。src/lib/pixel/flight-art.ts はドット絵を文字列の行列で持つデータなので
// ここに入れない(文字を消した変異体を見抜くには絵を丸ごと写したテストが要るだけで、振る舞いは守れない)。
// あちらはカバレッジ100%だけで固定する
const MUTATE = [
  'src/lib/village/flight.ts',
  'src/lib/village/flight-curve.ts',
  'src/lib/village/is-moving.ts',
  'src/components/VillagePage/components/Village/utils/collect-place-names.ts',
  'src/components/VillagePage/components/Village/utils/enter-world.ts',
  'src/components/VillagePage/components/Village/utils/set-clock-time.ts',
  'src/components/VillagePage/components/Village/utils/plan-travel.ts',
]

// 実在しないパスを並べても、Stryker は警告を出すだけで残りを測って通す(2026-10-10 に実測)。
// 名前の打ち間違いや移動・削除で対象が外れたことに気付けるよう、設定を読む時点で落とす
const missingMutate = MUTATE.filter(
  file => !existsSync(fileURLToPath(new URL(file, import.meta.url)))
)
if (missingMutate.length > 0) {
  throw new Error(`stryker.config.mjs: mutate の対象が実在しない: ${missingMutate.join(', ')}`)
}

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  // 変異体ごとに、その箇所を通るテストだけを走らせる
  coverageAnalysis: 'perTest',
  mutate: MUTATE,
  thresholds: { high: 100, low: 100, break: 100 },
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // 前回の結果をファイルに残し、次の実行では変わった変異体だけを走らせる。CI はこのファイルを
  // キャッシュで持ち回るので、push ごとに全部を走らせずに済む。
  // 穴: 比べるのは mutate のファイルとテストファイルだけで、依存パッケージ・設定・mutate のファイルが
  // import する別のファイルが変わっても気付かず、前回の結果を使い回す。
  // 埋め方: 週1回、手で npm run test:mutation -- --force を走らせて全部を測り直す。CI のキャッシュの鍵には
  // package-lock.json・この設定・vitest.config.ts の指紋を入れ、どれかが変わると結果を引き継がずに全部を走らせる
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
