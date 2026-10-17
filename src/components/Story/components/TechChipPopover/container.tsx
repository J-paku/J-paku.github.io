// 技術チップ。クリック・ホバーは開く専用で、閉じるのは Escape・外側 pointerdown・マウス離脱のみ
// (クリックをトグルにするとホバーで開いた直後のクリックが閉じてしまう。擬似ホバーは pointerType で弾く)。
// 開閉・外側クリック・Escape は window 購読+contains 判定で扱う。
// ポップオーバー本体は常にDOMへ残し hidden 属性で畳む — aria-controls が指す要素を消さないため
'use client'
import { useId } from 'react'
import type { Locale, WorkStoryChip } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import { useChipPopover } from './hooks/use-chip-popover'
import styles from './tech-chip-popover.module.css'

type TechChipPopoverProps = {
  chip: WorkStoryChip
  locale: Locale
}

function TechChipPopover({ chip, locale }: TechChipPopoverProps) {
  const { isOpen, setIsOpen, rootRef, handlePointerEnter, handlePointerLeave } = useChipPopover()
  const popoverId = useId()

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
        <PhraseText text={chip.note} locale={locale} />
      </span>
    </span>
  )
}

export default TechChipPopover
