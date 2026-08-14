// 技術チップ。クリック・ホバーは開く専用で、閉じるのは Escape・外側 pointerdown・マウス離脱のみ
// (クリックをトグルにするとホバーで開いた直後のクリックが閉じてしまう。擬似ホバーは pointerType で弾く)。
// 開閉・外側クリック・Escape の扱いは WorkCard の isLinksOpen と同じ方式(window 購読・contains 判定)。
// ポップオーバー本体は常にDOMへ残し hidden 属性で畳む — aria-controls が指す要素を消さないため
import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { WorkStoryChip } from '@/types/content'
import PhraseText from '@/components/PhraseText'
import styles from './tech-chip-popover.module.css'

type TechChipPopoverProps = {
  chip: WorkStoryChip
}

function TechChipPopover({ chip }: TechChipPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popoverId = useId()

  // Esc とチップ外側の pointerdown で閉じる。開いている間だけ購読する
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isOpen])

  // マウスのホバーだけを開閉に使う。タッチ環境のタップ直後に発火する疑似ホバーは対象外にする
  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    setIsOpen(true)
  }
  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    setIsOpen(false)
  }

  return (
    <span ref={rootRef} className={styles.root}>
      <button
        type='button'
        className={styles.chip}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        onClick={() => setIsOpen(true)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {chip.name}
      </button>
      <span id={popoverId} className={styles.popover} hidden={!isOpen}>
        <PhraseText text={chip.note} />
      </span>
    </span>
  )
}

export default TechChipPopover
