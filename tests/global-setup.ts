// E2E を始める前に「いま応答しているサーバが、このチェックアウトの out/ を配っているか」を 1 回照合する。
// webServer.reuseExistingServer を true にしている(切ると、別プロセスがポートを握っている間は
// 手元の E2E が一切走らなくなる)ため、別の worktree・別セッションが同じポートを自分の out/ で
// 押さえていると、こちらの変更を丸ごと戻しても全 spec が緑になる。落ちないので誰も気づけない。
// そこで配信物をいくつか取り、out/ の対応するファイルと突き合わせて違えば即座に止める。
// / だけだと、入口が同じで他のページ(404・一覧)だけ違うビルドを見逃すので、性格の違う 3 枚を見る
// Playwright が拾うのは *.spec.ts / *.test.ts だけなので、このファイルはテストとしては集められない
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { FullConfig } from '@playwright/test'

type Page = {
  // 配信側で取る経路
  path: string
  // このファイル(tests/)から見た、同じ中身のはずのビルド成果物
  file: string
  // 無いページの経路か(状態コードではなく中身だけで照合する)
  notFound: boolean
}

// 404 は /404.html を直接取らない。serve は cleanUrls で /404.html を /404 へ転送し、
// その先は out/404/index.html(Next の英語版)になる。実際に 404 案内を配る経路である
// 「無いページ」を取ると、serve も GitHub Pages も out/404.html をそのまま返す(serve で実測)
const PAGES: Page[] = [
  { path: '/', file: '../out/index.html', notFound: false },
  { path: '/list/', file: '../out/list/index.html', notFound: false },
  { path: '/__global-setup-missing__/', file: '../out/404.html', notFound: true },
]

const toPath = (file: string): string => fileURLToPath(new URL(file, import.meta.url))

// どのビルドだったかを報告に添えるための指紋。先頭の資産名は両ビルドで同じ CSS のことがあり、
// それだけでは「違う」と言いながら同じ指紋を並べてしまう。本文のハッシュを先に置いて必ず区別できるようにする
const fingerprint = (html: string): string => {
  const hash = createHash('sha256').update(html).digest('hex').slice(0, 12)
  const assets = [...html.matchAll(/\/_next\/static\/[^"']+/g)].map(hit => hit[0])
  const names =
    assets.length === 0 ? '(ハッシュ付きの資産が見当たらない)' : assets.slice(0, 2).join(' ')
  return `sha256:${hash} ${names}`
}

// Playwright は webServer を起こし url が応答するのを待ってから globalSetup を呼ぶ(:4201 で実測)。
// それでも応答が取れないなら照合する材料が無いので、ここでは止めない(同じ URL を開くテスト側が落ちる)
const fetchPage = async (baseURL: string, page: Page): Promise<string | null> => {
  try {
    const response = await fetch(new URL(page.path, baseURL))
    // 無いページの経路は 404 が正常。そこで 200 が返るのも「別の配信物」なので、状態では弾かず中身で比べる
    if (!page.notFound && !response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.text()
  } catch {
    return null
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? config.webServer?.url
  if (typeof baseURL !== 'string')
    throw new Error('baseURL が決まっていないので配信物を確かめられない')

  for (const page of PAGES) {
    const served = await fetchPage(baseURL, page)
    if (served === null) continue

    const filePath = toPath(page.file)
    const expected = await readFile(filePath, 'utf8').catch(() => null)
    if (expected === null) {
      throw new Error(
        [
          `${baseURL} で誰かがすでに配信しているが、照合先の ${filePath} が無い。`,
          'npm run build でこのチェックアウトを書き出すか、そのサーバを止めてから走らせる',
          `配信されている側 ${page.path}: ${fingerprint(served)}`,
        ].join('\n')
      )
    }

    if (served !== expected) {
      throw new Error(
        [
          `${baseURL} が配っているのは、このチェックアウトの out/ ではない(${page.path} が違う)。`,
          'そのまま走らせても別のビルドを検査するだけで、今回の変更は結果に出ない。',
          'そのサーバを止める(ポートを空ける)か、ポートを変えてから走らせる',
          `配信されている側 ${page.path}: ${fingerprint(served)}`,
          `手元の ${page.file.replace('../', '')}: ${fingerprint(expected)}`,
        ].join('\n')
      )
    }
  }
}

export default globalSetup
