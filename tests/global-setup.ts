// E2E を始める前に「いま応答しているサーバが、このチェックアウトの out/ を配っているか」を 1 回照合する。
// webServer.reuseExistingServer を true にしている(切ると、別プロセスがポートを握っている間は
// 手元の E2E が一切走らなくなる)ため、別の worktree・別セッションが同じポートを自分の out/ で
// 押さえていると、こちらの変更を丸ごと戻しても全 spec が緑になる。落ちないので誰も気づけない。
// そこで baseURL の / を取り、out/index.html と突き合わせて違えば即座に止める。
// Playwright が拾うのは *.spec.ts / *.test.ts だけなので、このファイルはテストとしては集められない
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { FullConfig } from '@playwright/test'

// このファイル(tests/)から見たビルド成果物の入口
const INDEX_PATH = fileURLToPath(new URL('../out/index.html', import.meta.url))

// どのビルドだったかを報告に添えるための指紋。ハッシュ付きの資産名はビルドごとに変わる
const fingerprint = (html: string): string => {
  const assets = [...html.matchAll(/\/_next\/static\/[^"']+/g)].map(hit => hit[0])
  return assets.length === 0 ? '(ハッシュ付きの資産が見当たらない)' : assets.slice(0, 2).join(' ')
}

// Playwright は webServer を起こし url が応答するのを待ってから globalSetup を呼ぶ(:4201 で実測)。
// それでも応答が取れないなら照合する材料が無いので、ここでは止めない(同じ URL を開くテスト側が落ちる)
const fetchIndex = async (baseURL: string): Promise<string | null> => {
  try {
    const response = await fetch(new URL('/', baseURL))
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.text()
  } catch {
    return null
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? config.webServer?.url
  if (typeof baseURL !== 'string')
    throw new Error('baseURL が決まっていないので配信物を確かめられない')

  const served = await fetchIndex(baseURL)
  if (served === null) return

  const expected = await readFile(INDEX_PATH, 'utf8').catch(() => null)
  if (expected === null) {
    throw new Error(
      [
        `${baseURL} で誰かがすでに配信しているが、照合先の ${INDEX_PATH} が無い。`,
        'npm run build でこのチェックアウトを書き出すか、そのサーバを止めてから走らせる',
        `配信されている側: ${fingerprint(served)}`,
      ].join('\n')
    )
  }

  if (served !== expected) {
    throw new Error(
      [
        `${baseURL} が配っているのは、このチェックアウトの out/ ではない。`,
        'そのまま走らせても別のビルドを検査するだけで、今回の変更は結果に出ない。',
        'そのサーバを止める(ポートを空ける)か、ポートを変えてから走らせる',
        `配信されている側: ${fingerprint(served)}`,
        `手元の out/  : ${fingerprint(expected)}`,
      ].join('\n')
    )
  }
}

export default globalSetup
