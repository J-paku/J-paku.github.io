// 場面SVGを原文(文字列)で取ってくる。
// <img src> ではなくシャドウルートへ直接展開するために、markup そのものが要る。
// 同じ場面を何度も開き直すので、URL ごとに取得中の Promise を覚えて2回目以降は待ち合わせる。
const sourceCache = new Map<string, Promise<string>>()

export function fetchSvgSource(url: string): Promise<string> {
  const cached = sourceCache.get(url)
  if (cached !== undefined) return cached

  const pending = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`SVGの取得に失敗した: ${url} (${response.status})`)
    return response.text()
  })
  // 失敗した Promise を残すと以後ずっと同じ失敗を配ることになるので、失敗時だけ覚えを捨てる
  pending.catch(() => sourceCache.delete(url))
  sourceCache.set(url, pending)
  return pending
}
