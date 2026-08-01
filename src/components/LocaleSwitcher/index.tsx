// 地球儀ボタンで開くドロップダウンの言語切替。開閉状態・キーボード操作はこの内部に閉じる
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'
import type { Locale } from '@/types/content'
import styles from './locale-switcher.module.css'

const LOCALES: Locale[] = ['ja', 'ko']

function LocaleSwitcher() {
  const { locale, switchTo } = useLocale()
  const { ui } = useContent()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  // 開いた瞬間、現在の言語の項目にフォーカスを移す
  useEffect(() => {
    if (!open) return
    const currentIndex = LOCALES.indexOf(locale)
    itemRefs.current[currentIndex]?.focus()
  }, [open, locale])

  // メニューの外側をクリックしたら閉じる
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const closeAndRestoreFocus = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const focusItemAt = (index: number) => {
    const wrapped = (index + LOCALES.length) % LOCALES.length
    itemRefs.current[wrapped]?.focus()
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      return
    }
    // フォーカス移動前に Escape が来た場合の保険。トリガー自身にフォーカスがあるので復帰は不要
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const handleItemKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItemAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItemAt(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusItemAt(0)
        break
      case 'End':
        event.preventDefault()
        focusItemAt(LOCALES.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        closeAndRestoreFocus()
        break
      default:
        break
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ui.localeMenu.label}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={styles.icon}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} role="menu" className={styles.menu}>
          {LOCALES.map((item, index) => (
            <Link
              key={item}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              to={switchTo(item)}
              role="menuitem"
              className={styles.item}
              aria-current={item === locale ? 'true' : undefined}
              onClick={() => setOpen(false)}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
            >
              {ui.localeMenu[item]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default LocaleSwitcher
