// ⌘K/Ctrl+Kで開くコマンドパレット。起動ボタン・ダイアログ・検索・実行までをこの1部品に閉じる。
// <dialog>+showModal()にフォーカストラップ・inert化は任せるが、次の3点は自前で行う:
// 1) フォーカス復帰(閉じたら必ずトリガーへ.focus()) 2) 背景スクロールロック 3) 外側クリック判定
// アニメーションは意図的に付けない。prefers-reduced-motionで無効化すべき対象自体を作らないことで、
// このチェック項目を構造的に満たす(装飾のために検証リスクを増やさない判断)
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useContent } from '@/hooks/use-content'
import { useOpenShortcut } from './hooks/use-open-shortcut'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useCommandItems } from './hooks/use-command-items'
import { useActiveCommandIndex } from './hooks/use-active-command-index'
import { filterCommandItems } from './utils/filter-command-items'
import { groupCommandItems } from './utils/group-command-items'
import { getCommandGroupLabel } from './utils/command-group-label'
import styles from './command-palette.module.css'

function CommandPalette() {
  const { ui } = useContent()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])

  const titleId = useId()
  const listboxId = useId()

  // refとstate setterのみに依存するため参照は恒久的に安定する。
  // useCommandItemsのuseMemoに渡すため、ここが不安定だと毎レンダー検索結果が再構築され、
  // activeIndexの自動リセットが誤発火する(ArrowKey操作が効かなくなる)
  const closeDialog = useCallback(() => {
    dialogRef.current?.close()
  }, [])
  const openDialog = useCallback(() => setIsOpen(true), [])

  const allItems = useCommandItems(closeDialog)
  const filteredItems = useMemo(() => filterCommandItems(allItems, query), [allItems, query])
  const groupedItems = useMemo(() => groupCommandItems(filteredItems), [filteredItems])
  const { activeIndex, setActiveIndex, moveActive } = useActiveCommandIndex(filteredItems, itemRefs)

  useOpenShortcut(isOpen, openDialog)
  useBodyScrollLock(isOpen)

  // dialog要素は常時マウントしておき、showModal()/close()の呼び出しだけで開閉する
  // (毎回アンマウント・再マウントすると、その間のrefやフォーカス状態を考える箇所が増える)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
      inputRef.current?.focus()
    }
  }, [isOpen])

  // 閉じる経路(Escape・外側クリック・項目実行)は必ずdialog.close()を経由させ、
  // ここを唯一の「閉じた後の後始末」にする(フォーカス復帰・検索クエリのリセット)
  const handleClose = () => {
    setIsOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  // <dialog>のbackdropへのクリックはevent.targetがdialog自身になる性質を利用し、
  // クリック座標がdialogの実際の矩形の外なら外側クリックとみなす
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== dialogRef.current) return
    const rect = dialogRef.current.getBoundingClientRect()
    const insideDialog =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    if (!insideDialog) closeDialog()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(-1)
        break
      case 'Enter': {
        event.preventDefault()
        filteredItems[activeIndex]?.run()
        break
      }
      case 'Escape':
        event.preventDefault()
        closeDialog()
        break
      case 'Tab':
        // 実測: このリポジトリのChromiumではdialog+showModal()のフォーカストラップに、
        // Tab折り返し時に一瞬<body>へ抜ける既知の挙動がある(素の<dialog>単体でも再現するブラウザ側の
        // 挙動)。ダイアログ内の実フォーカス可能要素は入力欄とlistboxの2つだけなので、
        // ブラウザの既定に任せず両者を自前でトグルする(Shift+Tabでも同じ相手へ移すだけでよい)
        event.preventDefault()
        listboxRef.current?.focus()
        break
      default:
        break
    }
  }

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  const activeItemId = filteredItems.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined
  const resultCountText = ui.commandPalette.resultCount.replace('{count}', String(filteredItems.length))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={ui.commandPalette.openButtonLabel}
        onClick={openDialog}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={styles.icon}>
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClose={handleClose}
        onClick={handleBackdropClick}
      >
        <h2 id={titleId} className={styles.visuallyHidden}>
          {ui.commandPalette.title}
        </h2>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={ui.commandPalette.placeholder}
          aria-label={ui.commandPalette.searchLabel}
          aria-controls={listboxId}
          aria-activedescendant={activeItemId}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <p aria-live="polite" className={styles.visuallyHidden}>
          {resultCountText}
        </p>
        {/* tabIndex=0: overflow:autoでスクロールする領域はaxeのscrollable-region-focusableが
            キーボード到達可能であることを要求するため、明示的にTabの到達対象にする。
            折り返し(listbox→入力欄)はhandleListboxKeyDownで自前制御する(上のTab実測メモ参照) */}
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={ui.commandPalette.title}
          className={styles.listbox}
          tabIndex={0}
          onKeyDown={handleListboxKeyDown}
        >
          {groupedItems.map(({ group, items }) => (
            <div key={group} role="group" aria-label={getCommandGroupLabel(ui.commandPalette, group)} className={styles.group}>
              <p aria-hidden="true" className={styles.groupLabel}>
                {getCommandGroupLabel(ui.commandPalette, group)}
              </p>
              {items.map((item) => (
                <div
                  key={item.id}
                  id={`${listboxId}-option-${item.flatIndex}`}
                  role="option"
                  aria-selected={item.flatIndex === activeIndex}
                  ref={(node) => {
                    itemRefs.current[item.flatIndex] = node
                  }}
                  className={item.flatIndex === activeIndex ? `${styles.option} ${styles.optionActive}` : styles.option}
                  onMouseEnter={() => setActiveIndex(item.flatIndex)}
                  onClick={() => item.run()}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </dialog>
    </>
  )
}

export default CommandPalette
