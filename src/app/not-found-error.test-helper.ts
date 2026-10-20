// next/navigation の notFound() が投げるもの。ローダーとルートが 404 にしたかを、これと同じものを投げたかで見る。
// 中身の綴り(digest)は Next の版で変わりうるので書き写さず、notFound() そのものを呼んで取る
import { notFound } from 'next/navigation'

const thrownBy = (run: () => void): Error => {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) return error
  }
  throw new Error('notFound() が Error を投げなかった')
}

export const NOT_FOUND = thrownBy(notFound)
