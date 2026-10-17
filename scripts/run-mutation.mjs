// 変異テスト(npm run test:mutation)の入口。stryker run を呼ぶ前に、前回の結果ファイル(stryker.config.mjs の
// incrementalFile)から、落とせなかった変異体(生き残った Survived・どのテストも通らない NoCoverage。どちらもしきい値を
// 割る結果)を取り除く。取り除いた変異体は Stryker から見て新しい変異体になり、その回に必ず測り直される。
//
// なぜ要るか: Stryker 10.0.0 の incremental は、前回生き残った変異体を「その変異体を通るテストが増えた・変わった」と
// 分かったときだけ測り直し、それ以外は前回の Survived を使い回す(@stryker-mutator/core の
// dist/src/mutants/incremental-differ.js の mutantCanBeReused)。2026-10-18 の実測で、次の2つが前回の Survived を
// 使い回し、テストを直しても落ち続けた(--force では通る)。
//   - モジュールを読む時に1回だけ評価される静的な変異体(トップレベルの `export const f = (n) => n + 1` の矢印関数を
//     消すものなど)。どのテストに通られたかの記録が残らない(coveredBy が空)ので、テストを直しても足しても測り直されない
//   - テストが import する別のファイル(*.test-helper.ts など)だけを直したとき。Stryker はテストファイルの外を比べないので、
//     関数の中の変異体でも起きる
// 落ちる判定をいつもその回に測った結果にするため、落とせなかった変異体だけは引き継がない。落とした変異体(Killed)と
// 時間切れ(Timeout)は今までどおり引き継ぐので、通っている状態の push の速さは変わらない。
// 引き継いだ Killed が今は生き残るのに通ってしまう向きは、これでは埋まらない(stryker.config.mjs の incremental の注釈)
//
// 引数はそのまま stryker run へ渡す(例: npm run test:mutation -- --force)。--incrementalFile を渡したときはその
// ファイルを、渡さないときは stryker.config.mjs の incrementalFile を見る。Stryker と同じく cwd からの相対で読む。
// Stryker は同じプロセスの中で動かす(終了コードと、割り込まれたときに途中の結果を残す Stryker の処理を、中継せずにそのまま使う)
//
// 使い方: node scripts/run-mutation.mjs [stryker run の引数]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { StrykerCli } from '@stryker-mutator/core'
import config from '../stryker.config.mjs'

// 落とせなかった結果(しきい値の break 100 を割る)。これ以外(Killed・Timeout・Ignored・CompileError・RuntimeError)は引き継ぐ
const UNDETECTED = new Set(['Survived', 'NoCoverage'])

const args = process.argv.slice(2)

const incrementalFileFromArgs = () => {
  const index = args.indexOf('--incrementalFile')
  if (index !== -1) return args[index + 1]
  const joined = args.find(arg => arg.startsWith('--incrementalFile='))
  return joined?.slice('--incrementalFile='.length)
}

const incrementalFile = incrementalFileFromArgs() ?? config.incrementalFile

if (existsSync(incrementalFile)) {
  const report = JSON.parse(readFileSync(incrementalFile, 'utf-8'))
  const entries = Object.entries(report.files)
  const files = Object.fromEntries(
    entries.map(([name, file]) => [
      name,
      { ...file, mutants: file.mutants.filter(mutant => !UNDETECTED.has(mutant.status)) },
    ])
  )
  const dropped = entries.reduce(
    (sum, [name, file]) => sum + file.mutants.length - files[name].mutants.length,
    0
  )
  if (dropped > 0) {
    // Stryker が書くときと同じ形(2文字の字下げ)で書き戻す
    writeFileSync(incrementalFile, JSON.stringify({ ...report, files }, null, 2), 'utf-8')
    console.log(
      `run-mutation: 前回落とせなかった変異体 ${dropped} 体を引き継がず、この回に測り直す(${incrementalFile})`
    )
  }
}

// bin/stryker.js と同じ形の argv(先頭2つは node と入口のファイルで、Stryker は読み飛ばす)
new StrykerCli([process.argv[0], process.argv[1], 'run', ...args]).run()
