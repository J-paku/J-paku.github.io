// 訪問地点の説明を読み進める焦点管理付きモーダル。村の枠の中に重ね、話しかけた物の位置から開く
'use client'

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import type { Locale } from '@content/types/content'
import type { StopText } from '@content/types/world'

import { useScrollThumb } from './hooks/use-scroll-thumb'
import styles from './stop-modal.module.css'

export type StopModalProps = {
  stop: StopText
  href: string | null
  external: boolean
  lang: Locale
  closeLabel: string
  hasNext: boolean
  listHref: string
  // 話しかけた物の枠内位置(マス単位・中心)。null なら中央から開く
  anchor: { x: number; y: number } | null
  onNext: () => void
  onClose: () => void
  returnTo: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type PopStyle = CSSProperties & { '--ax': string; '--ay': string }
type RailStyle = CSSProperties & { '--thumb-top': string; '--thumb-size': string }

export function StopModal({
  stop,
  href,
  external,
  lang,
  closeLabel,
  hasNext,
  listHref,
  anchor,
  onNext,
  onClose,
  returnTo,
}: StopModalProps) {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const thumb = useScrollThumb(panelRef)

  useEffect(() => {
    const returnTarget = returnTo.current
    titleRef.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === titleRef.current)
    ) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const popStyle: PopStyle | undefined =
    anchor === null
      ? undefined
      : { '--ax': `calc(var(--cell) * ${anchor.x})`, '--ay': `calc(var(--cell) * ${anchor.y})` }
  const railStyle: RailStyle = {
    '--thumb-top': `${(thumb.top * 100).toFixed(2)}%`,
    '--thumb-size': `${(thumb.size * 100).toFixed(2)}%`,
  }

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      lang={lang}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.pop} style={popStyle}>
        <div className={styles.box}>
          <div ref={panelRef} className={styles.panel}>
            <small className={styles.place}>{stop.place}</small>
            <h2 ref={titleRef} id={titleId} className={styles.title} tabIndex={-1}>
              {stop.title}
            </h2>
            <p className={styles.claim}>{stop.claim}</p>
            <p>{stop.proof}</p>
            <p>{stop.detail}</p>
            {stop.link && href !== null ? (
              <a
                className={styles.link}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener' : undefined}
              >
                {stop.link.label}
              </a>
            ) : null}
            <p>{stop.hook}</p>
            <div className={styles.actions}>
              {hasNext ? (
                <button type='button' onClick={onNext}>
                  {stop.next}
                </button>
              ) : (
                <a href={listHref}>{stop.next}</a>
              )}
              <button type='button' onClick={onClose}>
                {closeLabel}
              </button>
            </div>
          </div>
          {thumb.visible ? (
            <div className={styles.rail} style={railStyle} aria-hidden='true'>
              <div className={styles.thumb} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default StopModal
