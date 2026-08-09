// 日本語の文節分割だけを行う。BudouX の機械学習モデルが区切り位置を決め、文節の配列を返す。
// 外部I/Oを持たない純粋計算なので lib ではなく utils に置く。
// 同じ文字列には常に同じ結果が返るため、モジュール内の Map に控えて再計算を避ける
import { Parser, jaModel } from 'budoux'

// モデルの読み込みは1回で足りる。描画のたびに生成コストを払わないようモジュール単位で持つ
const parser = new Parser(jaModel)

const cache = new Map<string, string[]>()

export const segmentJapanese = (text: string): string[] => {
  const cached = cache.get(text)
  if (cached !== undefined) return cached

  const chunks = parser.parse(text)
  cache.set(text, chunks)
  return chunks
}
