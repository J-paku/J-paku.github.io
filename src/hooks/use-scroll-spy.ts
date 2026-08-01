// IntersectionObserver で「現在ビューポート上部付近に見えているセクション」の id を返すフック。
// Header内比の aria-current 判定に使う想定。ResizeObserver は使わない
import { useEffect, useRef, useState } from 'react'

// 画面上端から10%・下端から70%を除いた帯を「現在地」の判定帯とみなす
const ROOT_MARGIN = '-10% 0px -70% 0px'

export const useScrollSpy = (sectionIds: string[]): string | null => {
  // 初期値は必ずnull。「最初のセクションがcurrent」という仮定を置かない
  // (03-pitfalls.md#3: observerの初回通知タイミングを他effectの実行順序への
  // 暗黙の依存として使わない。通知が来るまでは「何もcurrentでない」を維持する)
  const [currentId, setCurrentId] = useState<string | null>(null)

  // 呼び出し側が配列リテラルを毎レンダー新規生成しても中身が同じなら再購読しないよう、
  // 依存配列にはjoinした文字列(内容比較用のキー)だけを使う。実際の配列はrefから読む
  const sectionIdsRef = useRef(sectionIds)
  sectionIdsRef.current = sectionIds
  const idsKey = sectionIds.join(',')

  useEffect(() => {
    const elements = sectionIdsRef.current
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    // 呼び出し側が渡す配列の並びではなく、実際のDOM上の出現順(文書順)で
    // 「一番上」を判定する。compareDocumentPositionで実文書順に並べ替える
    const orderedElements = [...elements].sort((a, b) => {
      const position = a.compareDocumentPosition(b)
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })

    const intersectingIds = new Set<string>()

    // 交差中集合の中から文書順で最も上の要素のidを選ぶ
    const pickCurrent = (): string | null => {
      for (const el of orderedElements) {
        if (intersectingIds.has(el.id)) return el.id
      }
      return null
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            intersectingIds.add(id)
          } else {
            intersectingIds.delete(id)
          }
        }

        const next = pickCurrent()
        // 決定事項: 交差が全て解除された場合はnullに戻さず直前の値を維持する。
        // スクロール中の一瞬の非交差でナビゲーションの現在地表示がちらつくのを防ぐため
        if (next !== null) {
          setCurrentId(next)
        }
      },
      { rootMargin: ROOT_MARGIN },
    )

    for (const el of orderedElements) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
    }
  }, [idsKey])

  return currentId
}
