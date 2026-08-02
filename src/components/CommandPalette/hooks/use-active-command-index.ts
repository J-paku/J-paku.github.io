// 検索結果内の「活性項目」インデックスを管理するフック。
// フォーカスは入力欄に残したままactiveIndexだけを動かし(aria-activedescendant方式)、
// 活性項目が変わるたびスクロール領域内へ自動スクロールする
import { useEffect, useState, type RefObject } from 'react'
import type { CommandItem } from '../type'

type UseActiveCommandIndexResult = {
  activeIndex: number
  setActiveIndex: (index: number) => void
  moveActive: (delta: number) => void
}

export function useActiveCommandIndex(
  items: CommandItem[],
  itemRefs: RefObject<Array<HTMLDivElement | null>>,
): UseActiveCommandIndexResult {
  const [activeIndex, setActiveIndex] = useState(0)

  // itemsの参照は検索クエリが変わった時だけ変化する(useCommandItems側の安定化により
  // 無関係な再レンダーでは変化しない)。そのタイミングでだけ先頭項目へ戻す
  useEffect(() => {
    setActiveIndex(0)
  }, [items])

  useEffect(() => {
    const active = itemRefs.current[activeIndex]
    // jsdomにはscrollIntoView自体が実装されていないため存在チェックを挟む(実ブラウザでは常に存在する)
    if (active !== null && active !== undefined && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, itemRefs])

  const moveActive = (delta: number) => {
    const count = items.length
    if (count === 0) return
    setActiveIndex((prev) => (prev + delta + count) % count)
  }

  return { activeIndex, setActiveIndex, moveActive }
}
