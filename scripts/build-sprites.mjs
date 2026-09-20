// スプライトシートを実ファイルの PNG として焼き出すビルド前スクリプト。
// 置き場も名前も src/lib/pixel/sprites.ts の SHEET_DIR・sheetFileName が正本で、
// ここは同じ関数を呼ぶだけ。名前には中身の指紋が入る(理由は sprites.ts に書いた)ので、
// 綴りを二重に持つとこのスクリプトと VillagePage が黙ってすれ違う。
//
// data URI のまま HTML に載せると 8 枚ぶんの base64 が毎ページ・毎訪問ぶん配られる(実測で
// index.html の 73% が base64)。実ファイルにすると HTML から消え、ブラウザが画像として
// キャッシュする。PNG であること自体は art.ts の理由(SVG だとマスごとに描画が走る)がそのまま生きる。
//
// 生成物はビルド成果物なので git には入れない(.gitignore)。書き切ってから古い名前を掃除するので、
// 途中で落ちても前の出力は 1 枚も欠けない。何度実行しても同じ中身・同じ名前になる。
// 書けなかったときは黙って中途半端なフォルダを残さず、非ゼロ終了でビルドを止める。
//
// 使い方: node scripts/build-sprites.mjs
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

// シートを焼く本体は TypeScript(src/lib/pixel)。Node は型注釈を剥がして .ts を直接実行できるが、
// 拡張子なしの相対指定('./art')と tsconfig の paths(@/・@content/)までは解決してくれない。
// その2つだけを解決フックで補い、変換ツールを足さずに正本のコードをそのまま呼ぶ
const ALIASES = { '@/': 'src', '@content/': 'content' }

registerHooks({
  resolve(specifier, context, next) {
    const alias = Object.keys(ALIASES).find(prefix => specifier.startsWith(prefix))
    const mapped =
      alias === undefined
        ? specifier
        : pathToFileURL(path.join(ROOT_DIR, ALIASES[alias], specifier.slice(alias.length))).href
    // 拡張子を補ってよいのは「リポジトリ内の拡張子なし指定」だけ。別名で書き換えたものと
    // 相対指定がそれに当たる。'react' のような素の依存名まで対象にすると、依存が入っていない
    // ときに本当の原因が「cannot find …/react.ts」へ化けて追えなくなる
    const retriable =
      (alias !== undefined || specifier.startsWith('.')) && path.extname(specifier) === ''
    try {
      return next(mapped, context)
    } catch (error) {
      // 握るのは「見つからない」場合だけ。壊れた別名・構文エラー・読み込み時の例外まで
      // ここで拾うと、別の失敗の顔をして戻ってくる
      if (!retriable || error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
      return next(`${mapped}.ts`, context)
    }
  },
})

const srcUrl = rel => pathToFileURL(path.join(ROOT_DIR, 'src', rel)).href

const PNG_PREFIX = 'data:image/png;base64,'

// シートの data URI を PNG のバイト列へ戻す。前置きが違うものは黙って通さない
const bytesOfSheet = (name, uri) => {
  if (!uri.startsWith(PNG_PREFIX)) {
    throw new Error(`${name}: PNG の data URI ではない(${uri.slice(0, 32)}…)`)
  }
  const bytes = Buffer.from(uri.slice(PNG_PREFIX.length), 'base64')
  if (bytes.length === 0) throw new Error(`${name}: 復号した PNG が 0 バイト`)
  return bytes
}

async function main() {
  const { DAY_PHASES } = await import(srcUrl('utils/day-phase.ts'))
  const { SHEET_DIR, SHEET_KINDS, sheetFileName, sheetOf } = await import(
    srcUrl('lib/pixel/sprites.ts')
  )
  const outDir = path.join(ROOT_DIR, 'public', SHEET_DIR)

  // 先に全枚数をメモリ上で焼き切る。ここで落ちれば public/sprites は前のまま(無傷)。
  // 名前も中身も sheetFileName・sheetOf から取るので、VillagePage が組む URL と必ず一致する
  const files = []
  for (const kind of SHEET_KINDS) {
    for (const phase of DAY_PHASES) {
      const name = sheetFileName(kind, phase)
      files.push({ name, bytes: bytesOfSheet(name, sheetOf(kind, phase).uri) })
    }
  }
  if (files.length === 0) throw new Error('焼くシートが 0 枚。DAY_PHASES を確認すること')

  // 消してから書くと、その隙に public/sprites を読んだ者(起動中の dev サーバ・同時に走った
  // 2 本目)が歯抜けのフォルダを見る。書き切ってから古い名前を消す順にすれば、いつ覗かれても
  // 「前の一式」か「新旧そろった一式」しか見えない。指紋のおかげで新旧の名前は衝突しない
  mkdirSync(outDir, { recursive: true })
  for (const { name, bytes } of files) {
    const dst = path.join(outDir, name)
    // 同じ名前へ直に書くと書きかけの中身を読まれ得る。一時名で書いてから rename する
    // (同じフォルダ内の rename は不可分なので、その名前は現れた瞬間から完成している)
    const tmp = `${dst}.tmp-${process.pid}`
    writeFileSync(tmp, bytes)
    renameSync(tmp, dst)
    // 書いた結果を読み直して確かめる。0 バイトのまま次の工程へ進ませない
    const written = statSync(dst).size
    if (written !== bytes.length) {
      throw new Error(`${name}: 書き込み後の大きさが合わない(${written} / ${bytes.length})`)
    }
  }

  // 全部書けてから掃除する。対象は今回の一式に無い名前 = 前の指紋のシートと、
  // 途中で落ちた実行が残した一時名
  const keep = new Set(files.map(file => file.name))
  const stale = readdirSync(outDir).filter(name => !keep.has(name))
  for (const name of stale) rmSync(path.join(outDir, name), { recursive: true, force: true })

  const total = files.reduce((sum, file) => sum + file.bytes.length, 0)
  console.log(
    `build-sprites: OK (${files.length} png, ${total} bytes, ${stale.length} stale removed -> public/${SHEET_DIR}/)`
  )
}

main().catch(error => {
  console.error('build-sprites: シートを焼けなかった')
  console.error(error)
  console.error('(src/lib/pixel を .ts のまま読むので Node 22.18 以上が必要)')
  process.exit(1)
})
