// 訪問地点の説明を読み進める焦点管理付きモーダル。村の枠の中に重ねて開く
'use client'

import { useId, useRef, type CSSProperties, type RefObject } from 'react'

import type { Locale } from '@content/types/content'
import type { Direction, StopText } from '@content/types/world'
import PhraseText from '@/components/ui/PhraseText'

import { useHeldScroll } from './hooks/use-held-scroll'
import { useModalFocus } from './hooks/use-modal-focus'
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const thumb = useScrollThumb(panelRef)
  // フックを呼ぶ順がそのまま effect の実行順・片付け順になる。つまみ → 焦点 → 送り の順を入れ替えない
  const handleKeyDown = useModalFocus({ titleRef, returnTo, onClose })
  useHeldScroll({ dialogRef, panelRef, titleRef, scrollHeldRef })

  const railStyle: RailStyle = {
    '--thumb-top': `${(thumb.top * 100).toFixed(2)}%`,
    '--thumb-size': `${(thumb.size * 100).toFixed(2)}%`,
  }

  return (
    <div
      ref={dialogRef}
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
            {/* data-village-panel は E2E が本文の送り位置(scrollTop)を読むための目印 */}
            <div ref={panelRef} className={styles.panel} data-village-panel>
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
              {/* 空の段落は描かない。釣りの確認窓のように claim だけで足りる窓があり、
                  空の <p> を置くと本文の下に余白だけが残る */}
              {stop.proof !== '' ? (
                <p>
                  <PhraseText text={stop.proof} locale={lang} />
                </p>
              ) : null}
              {stop.detail !== '' ? (
                <p>
                  <PhraseText text={stop.detail} locale={lang} />
                </p>
              ) : null}
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
              {stop.hook !== '' ? (
                <p>
                  <PhraseText text={stop.hook} locale={lang} />
                </p>
              ) : null}
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
