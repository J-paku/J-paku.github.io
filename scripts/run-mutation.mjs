// 変異テスト(npm run test:mutation)の入口。stryker run を呼ぶ前に、前回の結果ファイル(stryker.config.mjs の
// incrementalFile)から、落とせなかった変異体(生き残った Survived・どのテストも通らない NoCoverage)と時間切れ(Timeout)の
// 変異体(どれもこの入口で落とす結果)を取り除く。取り除いた変異体は Stryker から見て新しい変異体になり、その回に必ず測り直される。
// 前回落とした変異体のうち、落としたテストから import をたどって届くファイルが変わったものも取り除く(下の「届くファイルが変わったテスト」)。
// 走り終えたら、その回の結果に時間切れが1体でもあれば落とす(下の「時間切れを落とす」)。
//
// なぜ要るか: Stryker 10.0.0 の incremental は、前回生き残った変異体を「その変異体を通るテストが増えた・変わった」と
// 分かったときだけ測り直し、それ以外は前回の Survived を使い回す(@stryker-mutator/core の
// dist/src/mutants/incremental-differ.js の mutantCanBeReused)。2026-10-18 の実測で、次の2つが前回の Survived を
// 使い回し、テストを直しても落ち続けた(--force では通る)。
//   - モジュールを読む時に1回だけ評価される静的な変異体(トップレベルの `export const f = (n) => n + 1` の矢印関数を
//     消すものなど)。どのテストに通られたかの記録が残らない(coveredBy が空)ので、テストを直しても足しても測り直されない
//   - テストが import する別のファイル(*.test-helper.ts など)だけを直したとき。Stryker はテストファイルの外を比べないので、
//     関数の中の変異体でも起きる
// 落ちる判定をいつもその回に測った結果にするため、落とせなかった変異体だけは引き継がない。時間切れも落とす結果なので、
// 同じ理由で引き継がない(引き継ぐと、コードを直しても前回の時間切れを使い回して落ち続けうる)。
// 落とした変異体(Killed)は今までどおり引き継ぐので、通っている状態の push の速さは変わらない。
// 引き継いだ Killed が今は生き残るのに通ってしまう向きは、これでは埋まらない。そのうち、テストから import をたどって届くファイルの変化は
// 下の「届くファイルが変わったテスト」が埋め、依存パッケージ・設定の変化は週1回の --force に任せる(stryker.config.mjs の incremental の注釈)
//
// 届くファイルが変わったテスト: Stryker が前回の結果と比べるのは mutate のファイルとテストファイルの中身だけで、前回落とした変異体は、
// 落としたテストが同じなら使い回す。そのため、テストが import をたどって届く別のファイル(*.test-helper.ts・*.fixture.ts・間に挟んで
// import するモジュール・content)だけが変わると、そのテストが落とした変異体を測り直さない。そこで Stryker を呼ぶ前に、テストファイルごとの
// 指紋(届くファイルの中身。取り方と、指紋に入らないものは scripts/fingerprint-tests.mjs)を、結果ファイルの隣の指紋のファイルに残した
// 前回の指紋と比べ、指紋が違う・どちらかに無いテストファイルのテストが落とした変異体(Killed で、killedBy にそのテストが1つでも入るもの)も
// 結果ファイルから取り除き、測り直すテストファイルの数と取り除いた数を1行出す(docs/decisions/0025-remeasure-kills-on-test-deps.md)。
// 前回の指紋が無い(初めて・指紋の無い結果を写した・指紋の版が違う)ときは、全部のテストファイルを変わったと見る。
// --force のときも同じに取り除く(どのみち Stryker が全部を測り直す)。
// 今の指紋は、取り除いた結果ファイルを書いた後、Stryker を呼ぶ前に書く。結果ファイルに残る Killed は、どれも落としたテストの指紋が
// 今と同じものだけなので、この後 Stryker が投げても、割り込まれて途中の結果を書いても、結果ファイルと指紋は食い違わない
// (走り終えた後に書く形だと、割り込まれて書かれた途中の結果が古い指紋と組みになり、届くファイルを前の中身へ戻したときに、
// 戻す前の中身で測った結果を使い回しうる)。
// 走り終えたら、その回の結果ファイルで変異体を落としたテストのファイルが全部今の指紋にあるかを見て、無ければ終了コードを 1 にする
// (Vitest に選ばせたテストファイルと Stryker が走らせたテストファイルが食い違っている。見落としにはならないが、
// そのテストの結果を毎回測り直して黙って遅くなる)
//
// 時間切れを落とす: Stryker 10 は時間切れ(Timeout)を落とした数に入れて点数を出すので、時間切れがあってもしきい値の
// break 100 を通る(2026-10-18 に実測)。時間切れは「テストが止まった」ことしか言わず、変異を見抜いた証拠として弱いうえ、
// 1体ごとに待ち時間(timeoutMS・timeoutFactor。stryker.config.mjs では既定のまま)を使い切る。
// そこで、その回の結果に時間切れが1体でもあれば、どのファイルの何行目の何の変異かを出して終了コードを 1 にする
// (docs/decisions/0021-fail-on-mutation-timeout.md)。時間切れが無ければ何もせず、Stryker の終了コードのまま終わる。
// 遅いだけで時間切れになった変異体も落とす。直すのはコードかテストの方で、待ち時間は延ばさない
//
// その回の結果の取り方: StrykerCli の3つ目の引数(変異テストを走らせる関数。型定義 dist/src/stryker-cli.d.ts の
// コンストラクタにあり、既定は `options => new Stryker(options).runMutationTest()`)に、既定と同じ呼び出しをしてから
// 結果を調べる関数を渡す。runMutationTest() が返すのは、その回に走らせた変異体と、結果ファイルから引き継いだ変異体を
// 合わせた全部で、Stryker が点数を出して結果ファイルへ書くのと同じ配列(dist/src/process/4-mutation-test-executor.js の
// execute が reportAll に渡したものを返す)。--force・--incrementalFile・結果ファイルが無いときのどれでも同じ形で返る。
// 結果ファイルを読み直す形を採らないのは、Stryker が途中で投げたときに前回のまま残ったファイルを読み、古い結果で
// 判定しうるため。リポーターを足す形を採らないのは、プラグインの登録と設定の変更が要り、入口の外へ判定が散るため。
// Stryker の版が変わってこの関数が呼ばれなくなると判定が黙って抜けるので、呼ばれないまま終わったときも落とす(beforeExit)
//
// 引数はそのまま stryker run へ渡す(例: npm run test:mutation -- --force)。--incrementalFile を渡したときはその
// ファイルを、渡さないときは stryker.config.mjs の incrementalFile を見る。Stryker と同じく cwd からの相対で読む。
// Stryker は同じプロセスの中で動かす(終了コードと、割り込まれたときに途中の結果を残す Stryker の処理を、中継せずにそのまま使う)
//
// 結果ファイルが無いとき(新しく作った作業ツリーなど): 同じリポジトリのほかの作業ツリー(git worktree list --porcelain)の
// 結果ファイル(stryker.config.mjs の incrementalFile)のうち、JSON として読めて更新時刻が最も新しいものを写してから始め、
// 変わった変異体だけを走らせる(docs/decisions/0023-inherit-latest-mutation-result.md)。写した元を1行出す。読めない候補は
// 1行出して飛ばす。どこにも無い・作業ツリーの一覧を取れないときはその旨を1行出し、Stryker が全部を走らせる。
// --force のとき(全部を測り直す)と、--incrementalFile で結果ファイルを名指ししたときは写さない。
// 結果ファイルの files・testFiles の名前はリポジトリ直下からの相対なので、別の作業ツリーの結果もそのまま比べられる。
// 写すときは、写す元の結果ファイルの隣の指紋を前回の指紋として使う(無ければ前回の指紋が無いのと同じ。この作業ツリーに残っていた指紋は使わない)。
// 指紋を先に、結果ファイルを後に読む(ほかの作業ツリーの入口も、取り除いた結果ファイルを先に、指紋を後に書くので、この順なら食い違わない組みを読む)。
// 今の指紋は写す前に取り(取れずに投げたときは何も写さない)、写した結果を書く直前に、この作業ツリーに残っていた指紋のファイルを消す。
// 写した後に投げても、写した結果がこの作業ツリーの古い指紋と組みにならず、次の実行は前回の指紋が無いと見て全部を測り直す
// (組みになると、次の実行は写した結果を写す元の指紋ではなくこの作業ツリーの古い指紋と比べるので、写す元と今とで届くファイルが違うのに
// 古い指紋と今が同じテストの変異体を測り直さない)。
// CI の checkout にはほかの作業ツリーが無いので、CI は .github/workflows/deploy.yml のキャッシュで結果と指紋を持ち回る
//
// 使い方: node scripts/run-mutation.mjs [stryker run の引数]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Stryker, StrykerCli } from '@stryker-mutator/core'
import config from '../stryker.config.mjs'
import {
  changedTestFiles,
  collectFingerprint,
  dropStaleKills,
  fingerprintFileOf,
  killersOutside,
  readFingerprint,
  writeFingerprint,
} from './fingerprint-tests.mjs'

// 引き継がずにその回に測り直す結果。どれも落とす結果(Survived・NoCoverage はしきい値の break 100 を割り、
// Timeout はこの入口が落とす)。これ以外(Killed・Ignored・CompileError・RuntimeError)は引き継ぐ
const REMEASURED = new Set(['Survived', 'NoCoverage', 'Timeout'])

const args = process.argv.slice(2)

const incrementalFileFromArgs = () => {
  const index = args.indexOf('--incrementalFile')
  if (index !== -1) return args[index + 1]
  const joined = args.find(arg => arg.startsWith('--incrementalFile='))
  return joined?.slice('--incrementalFile='.length)
}

const namedIncrementalFile = incrementalFileFromArgs()
const incrementalFile = namedIncrementalFile ?? config.incrementalFile
// 結果ファイルの隣の指紋のファイル(上の注釈の「届くファイルが変わったテスト」)
const fingerprintFile = fingerprintFileOf(incrementalFile)

// 同じリポジトリの作業ツリーの直下の絶対パス(この作業ツリーも含む)。git が無い・リポジトリの中でないなどで
// 一覧を取れないときは、1行出して空にする(写す元が無いときと同じく、Stryker が全部を走らせる)
const worktreeRoots = () => {
  try {
    return execFileSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.slice('worktree '.length))
  } catch (error) {
    console.log(
      `run-mutation: 作業ツリーの一覧を取れない(git worktree list --porcelain: ${error.message.trim().split('\n').at(-1)})`
    )
    return []
  }
}

// 候補の中身と、その隣の指紋(無い・読めなければ undefined)。指紋を先に読む(上の注釈)。
// ほかの作業ツリーの Stryker が書いている途中のもの・書き込みが中断されたものは JSON として読めないので、
// 1行出して飛ばす(読めない写しをこの作業ツリーに残さない)
const readableResult = file => {
  const fingerprint = readFingerprint(fingerprintFileOf(file))
  try {
    const text = readFileSync(file, 'utf-8')
    JSON.parse(text)
    return { file, text, fingerprint }
  } catch (error) {
    console.log(
      `run-mutation: ほかの作業ツリーの結果を読めないので飛ばす(${file}: ${error.message})`
    )
    return undefined
  }
}

// ほかの作業ツリーの結果ファイルのうち、JSON として読めるものの中で更新時刻が最も新しいもの。
// この作業ツリー自身の結果ファイルは候補から外す
const newestResultElsewhere = () => {
  const own = path.resolve(incrementalFile)
  return (
    worktreeRoots()
      .map(root => path.join(root, config.incrementalFile))
      .filter(file => file !== own)
      .map(file => ({ file, stat: statSync(file, { throwIfNoEntry: false }) }))
      .filter(({ stat }) => stat !== undefined)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      // 新しい順に読み、読めた最初の1つから先は読まない
      .reduce((found, { file }) => found ?? readableResult(file), undefined)
  )
}

// 今の指紋。Stryker と同じく cwd をリポジトリ直下として見る。写す前に取る(上の注釈)
const currentFingerprint = await collectFingerprint(process.cwd(), config.vitest?.configFile)

const borrowing =
  namedIncrementalFile === undefined && !args.includes('--force') && !existsSync(incrementalFile)
const borrowed = borrowing ? newestResultElsewhere() : undefined
if (borrowing && borrowed === undefined) {
  console.log(
    `run-mutation: 結果ファイル(${incrementalFile})が無く、ほかの作業ツリーにも読める結果が無いので、全部を走らせる`
  )
}
if (borrowed !== undefined) {
  // 写した結果がこの作業ツリーの古い指紋と組みにならないよう、書く直前に古い指紋のファイルを消す(上の注釈)
  rmSync(fingerprintFile, { force: true })
  // 読めると確かめた中身をそのまま書く(確かめた後に元が書き換わっても、写しは読めたものになる)
  mkdirSync(path.dirname(incrementalFile), { recursive: true })
  writeFileSync(incrementalFile, borrowed.text, 'utf-8')
  console.log(
    `run-mutation: 結果ファイル(${incrementalFile})が無いので、ほかの作業ツリーの最も新しい結果を写して引き継ぐ(${borrowed.file})`
  )
}

// 前回の指紋。写したときは写した元の結果ファイルの隣の指紋(無ければ無いのと同じ)、写さないときはこの作業ツリーの指紋のファイル。
// 結果ファイルより先に読む(上の注釈)
const storedFingerprint =
  borrowed === undefined ? readFingerprint(fingerprintFile) : borrowed.fingerprint

if (existsSync(incrementalFile)) {
  const report = JSON.parse(readFileSync(incrementalFile, 'utf-8'))
  const entries = Object.entries(report.files)
  const files = Object.fromEntries(
    entries.map(([name, file]) => [
      name,
      { ...file, mutants: file.mutants.filter(mutant => !REMEASURED.has(mutant.status)) },
    ])
  )
  const dropped = entries.reduce(
    (sum, [name, file]) => sum + file.mutants.length - files[name].mutants.length,
    0
  )
  // 届くファイルが変わったテストが前回落とした変異体も取り除く(上の注釈の「届くファイルが変わったテスト」)
  const changed = changedTestFiles(storedFingerprint, currentFingerprint, report.testFiles)
  const stale = dropStaleKills({ ...report, files }, changed)
  if (dropped + stale.dropped > 0) {
    // Stryker が書くときと同じ形(2文字の字下げ)で書き戻す
    const kept = { ...report, files: stale.files }
    writeFileSync(incrementalFile, JSON.stringify(kept, null, 2), 'utf-8')
  }
  if (dropped > 0) {
    console.log(
      `run-mutation: 前回落とせなかった変異体と時間切れ ${dropped} 体を引き継がず、この回に測り直す(${incrementalFile})`
    )
  }
  if (storedFingerprint === undefined) {
    console.log(
      `run-mutation: 前回の指紋(${fingerprintFile})が無いか読めないので、結果ファイルのテストファイルを全部、届くファイルが変わったと見る`
    )
  }
  console.log(
    `run-mutation: 届くファイルが変わったテストファイル ${changed.length} 件のテストが前回落とした変異体 ${stale.dropped} 体を引き継がず、この回に測り直す(${fingerprintFile} と比べた)`
  )
}

// 取り除いた結果ファイルを書いた後、Stryker を呼ぶ前に今の指紋を書く(上の注釈の「届くファイルが変わったテスト」)
writeFingerprint(fingerprintFile, currentFingerprint.tests)

// 結果の fileName は絶対パス。出すときは cwd からの相対にし、ファイル・行・列の順に並べる
const describeMutant = mutant => {
  const { line, column } = mutant.location.start
  const replacement = mutant.replacement.replace(/\s+/g, ' ')
  return `  ${path.relative(process.cwd(), mutant.fileName)}:${line}:${column} ${mutant.mutatorName}(${replacement})`
}

const byPlace = (a, b) =>
  a.fileName.localeCompare(b.fileName) ||
  a.location.start.line - b.location.start.line ||
  a.location.start.column - b.location.start.column

let checked = false

const runMutationTest = async options => {
  const results = await new Stryker(options).runMutationTest()
  checked = true
  const timedOut = results.filter(mutant => mutant.status === 'Timeout').sort(byPlace)
  if (timedOut.length > 0) {
    console.error(
      [
        `run-mutation: 時間切れ(Timeout)の変異体が ${timedOut.length} 体ある。時間切れも落とす(docs/decisions/0021-fail-on-mutation-timeout.md)。`,
        '変異で止まらなくなるループ・再帰は、変異しても終わる形に書き直す(待ち時間は延ばさない)',
        ...timedOut.map(describeMutant),
      ].join('\n')
    )
    process.exitCode = 1
  }
  // その回の結果ファイルで変異体を落としたテストのファイルが、全部今の指紋にあるか(上の注釈の「届くファイルが変わったテスト」)
  const unfingerprinted = existsSync(incrementalFile)
    ? killersOutside(JSON.parse(readFileSync(incrementalFile, 'utf-8')), currentFingerprint)
    : []
  if (unfingerprinted.length > 0) {
    console.error(
      [
        `run-mutation: 変異体を落としたテストのファイル ${unfingerprinted.length} 件が、指紋を取ったテストファイル(scripts/fingerprint-tests.mjs が Vitest に選ばせたもの)に無い。`,
        'Stryker が走らせたテストファイルと指紋の範囲が食い違っていて、このままではそのテストの結果を毎回測り直す。テストファイルの選び方(stryker.config.mjs の vitest・Vitest の版)が変わっていないかを見て、指紋の取り方を合わせる',
        ...unfingerprinted.map(file => `  ${file}`),
      ].join('\n')
    )
    process.exitCode = 1
  }
  return results
}

// 上の関数が呼ばれないまま、プロセスがふつうに終わろうとしたとき(Stryker の版が変わって3つ目の引数を使わなくなったなど)。
// 投げたとき・割り込まれたとき・引数の誤りは Stryker と commander が process.exit か未処理の例外で終わらせ、ここへは来ない
process.once('beforeExit', () => {
  if (checked) return
  console.error(
    'run-mutation: Stryker の結果を受け取れず、時間切れを調べられなかった(scripts/run-mutation.mjs の注釈)'
  )
  process.exitCode = 1
})

// bin/stryker.js と同じ形の argv(先頭2つは node と入口のファイルで、Stryker は読み飛ばす)。
// 2つ目の引数は commander の Command で、undefined を渡すと既定(new Command())になる
new StrykerCli([process.argv[0], process.argv[1], 'run', ...args], undefined, runMutationTest).run()
