import { chromium } from 'playwright-core'
const EXEC_PATH = '/home/tottan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
async function main() {
  const browser = await chromium.launch({ executablePath: EXEC_PATH })
  const page = await browser.newPage()
  await page.goto('http://localhost:8992/fixture-realfont-latin.html', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const client = await page.context().newCDPSession(page)
  await client.send('DOM.enable')
  await client.send('CSS.enable')
  const { root } = await client.send('DOM.getDocument')
  const { nodeIds } = await client.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'p' })
  const fonts = await client.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[0] })
  console.log('孤立フィクスチャ(J-paku, Interのみ指定):', JSON.stringify(fonts))
  await browser.close()
}
main()
