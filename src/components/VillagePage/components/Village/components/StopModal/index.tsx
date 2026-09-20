// 訪問地点の説明を読み進める焦点管理付きモーダル。村の枠の中に重ねて開く
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
import type { Direction, StopText } from '@content/types/world'
import PhraseText from '@/components/ui/PhraseText'

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
  // 押しっぱなしの方向。ロック中(このモーダルが開いている間)の上下は本文スクロールに使う
  scrollHeldRef: RefObject<Direction | null>
  onNext: () => void
  onClose: () => void
  returnTo: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'
// 押しっぱなしの間、1フレームで動かす本文スクロール量(px)
const SCROLL_STEP = 6

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type RailStyle = CSSProperties & { '--thumb-top': string; '--thumb-size': string }

export function StopModal({
  stop,
  href,
  external,
  lang,
  closeLabel,
  hasNext,
  listHref,
  scrollHeldRef,
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

  // ジョイスティック・矢印キーの押しっぱなしで本文を送る。閉じたら(アンマウントで)止まる
  useEffect(() => {
    let frame: number
    const step = () => {
      const direction = scrollHeldRef.current
      const panel = panelRef.current
      if (panel !== null && (direction === 'up' || direction === 'down')) {
        panel.scrollTop += direction === 'down' ? SCROLL_STEP : -SCROLL_STEP
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [scrollHeldRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    // 操作ボタン(.actions)はパネルの外(.box の兄弟)にあるので、ダイアログ全体から探す
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusable.length) return

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
      <div className={styles.pop}>
        <div className={styles.box}>
          <div className={styles.body}>
            <div ref={panelRef} className={styles.panel}>
              <small className={styles.place}>{stop.place}</small>
              <h2 ref={titleRef} id={titleId} className={styles.title} tabIndex={-1}>
                <PhraseText text={stop.title} locale={lang} />
              </h2>
              <p className={styles.claim}>
                <PhraseText text={stop.claim} locale={lang} />
              </p>
              {stop.entries && stop.entries.length > 0 ? (
                <ol className={styles.entries}>
                  {stop.entries.map(entry => (
                    <li key={entry.company} className={styles.entry}>
                      {entry.logo !== '' ? (
                        <img
                          className={styles.entryLogo}
                          src={entry.logo}
                          alt={entry.company}
                          height={24}
                        />
                      ) : null}
                      <p className={styles.entryHead}>
                        <span className={styles.entryCompany}>{entry.company}</span>
                        <span className={styles.entryPeriod}>{entry.period}</span>
                      </p>
                      <p className={styles.entryBody}>
                        <PhraseText text={entry.body} locale={lang} />
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p>
                <PhraseText text={stop.proof} locale={lang} />
              </p>
              <p>
                <PhraseText text={stop.detail} locale={lang} />
              </p>
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
              <p>
                <PhraseText text={stop.hook} locale={lang} />
              </p>
            </div>
            {thumb.visible ? (
              <div className={styles.rail} style={railStyle} aria-hidden='true'>
                <div className={styles.thumb} />
              </div>
            ) : null}
          </div>
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
      </div>
    </div>
  )
}

export default StopModal
