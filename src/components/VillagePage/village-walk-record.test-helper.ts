// 村の統合テストで、短い間しか出ないコマ・印・押し離しを取りこぼさずに控える記録の道具。
// どれも MutationObserver と捕捉段のリスナー(DOM の API)で控え、読むのはテストの側。
// 時刻はページの performance.now()(偽の時計。歩行ループが経過を数えるのと同じ時計)で付ける。
// 同じ通知に同じ属性の書き換えが続けて入っていれば、その回に書かれた値は次の記録の「書き換え前の値」として読む
// (React と歩行ループが同じフレームで書き換えても、間の値を落とさない)。
// 観察とリスナーは、そのテストが終わる時(onTestFinished)に外す。次のテストへ持ち越さない
import { onTestFinished } from 'vitest'

// 観察を始め、テストの終わりに外す
const observe = (target: Node, callback: MutationCallback, options: MutationObserverInit) => {
  const observer = new MutationObserver(callback)
  observer.observe(target, options)
  onTestFinished(() => observer.disconnect())
}

// ある属性の書き換えを順に控える。values は書かれた値の並び(同じ値の重複も残す)
export type AttributeMark = { value: string; at: number }

// 書き換えごとに、その回に書かれた値を返す。後に同じ要素・同じ属性の記録が続けば、その oldValue がこの回の値
const writtenValues = (records: readonly MutationRecord[]) =>
  records.flatMap((record, index) => {
    const name = record.attributeName
    if (!(record.target instanceof Element) || name === null) return []
    const later = records
      .slice(index + 1)
      .find(next => next.target === record.target && next.attributeName === name)
    const value = (later === undefined ? record.target.getAttribute(name) : later.oldValue) ?? ''
    return [{ target: record.target, name, value }]
  })

// target の attribute が書き換わるたびに値と時刻を控える
export const recordAttribute = (target: Element, attribute: string): AttributeMark[] => {
  const marks: AttributeMark[] = []
  observe(
    target,
    records => {
      const at = performance.now()
      for (const { value } of writtenValues(records)) marks.push({ value, at })
    },
    { attributes: true, attributeOldValue: true, attributeFilter: [attribute] }
  )
  return marks
}
