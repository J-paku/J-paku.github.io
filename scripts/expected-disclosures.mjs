// 一覧(/list・/ko/list)に在るはずの折りたたみ(作品カードの詳細)の id を content から数え出す。
// check-a11y.mjs と check-ja-linebreak.mjs が共有する。
//
// 検査側の床を「1件以上」にしておくと、2件のうち1件が消えても素通りする。
// かといって件数を「2」と書くと、作品が増減した日に黙って合わなくなる。
// そこで「どの作品が詳細を持つか」の正本である content/<locale>/works/*.ts を読み、
// 詳細を持つ作品ごとに WorkCard が描く aria-controls の値(`${slug}-detail`)を列挙する。
// id の組み立ては src/components/Directory/components/WorkCard/index.tsx の detailId と同じ形に保つ
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 経路の先頭で言語を決める(/ko/list → ko、/list → ja)。src/app の経路構成と同じ
const localeOf = targetPath => (/^\/ko(\/|$)/.test(targetPath) ? 'ko' : 'ja')

// 作品ファイルは Work 型のオブジェクトを1つ export する形に揃っている(prettier で字下げ2)。
// 最上位のキーだけを見るため、行頭2字下げの `slug:` と `detail:` を拾う。
// 入れ子の detail(字下げ4以上)は拾わない
const SLUG_PATTERN = /^ {2}slug: '([^']+)'/m
const DETAIL_PATTERN = /^ {2}detail: /m

// targetPath の言語で、一覧が開閉トグルを描くはずの aria-controls の値を昇順で返す。
// 作品ファイルから slug が読めなければ例外で止める — 読めないまま 0 件を返すと、
// 検査は「在るはずのものが無い」を一度も言わなくなる
export function expectedDisclosureIds(targetPath) {
  const worksDir = path.join(ROOT_DIR, 'content', localeOf(targetPath), 'works')
  const ids = []
  for (const fileName of readdirSync(worksDir).filter(name => name.endsWith('.ts'))) {
    const source = readFileSync(path.join(worksDir, fileName), 'utf-8')
    const slug = source.match(SLUG_PATTERN)?.[1]
    if (slug === undefined) {
      throw new Error(
        `${path.join(worksDir, fileName)}: slug が読めない。期待する開閉トグルを数えられない`
      )
    }
    if (DETAIL_PATTERN.test(source)) ids.push(`${slug}-detail`)
  }
  return ids.sort()
}
