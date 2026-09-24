// 卓上時計の設定窓。村の枠の中に重ねて開き、選んだ時刻は use-village-time の store へ書く。
// 空・灯り・ポストの LED はその store を見ているので、この窓は時刻を決めるところまでを受け持つ
'use client'

import { useId, useRef, type RefObject } from 'react'

import type { Locale } from '@content/types/content'
import type { ClockText, Direction } from '@content/types/world'
import PhraseText from '@/components/ui/PhraseText'

import { useClockModal } from './hooks/use-clock-modal'
import { MINUTE_STEP, pad2 } from './utils/clock-time'
import styles from './clock-modal.module.css'

export type ClockModalProps = {
  text: ClockText
  lang: Locale
  // 結果の一言を村の会話窓(role='status')へ流す手
  announce: (message: string) => void
  onClose: () => void
  returnTo: RefObject<HTMLElement | null>
  // スティックの押しっぱなしの向き。会話窓と同じ ref を読み、ボタンの移動と針に使う
  scrollHeldRef: RefObject<Direction | null>
}

export function ClockModal({
  text,
  lang,
  announce,
  onClose,
  returnTo,
  scrollHeldRef,
}: ClockModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const {
    step,
    hour,
    minute,
    decideRef,
    chooseRealtime,
    chooseCustom,
    stepHour,
    stepMinute,
    decide,
    cancelPick,
    handleKeyDown,
  } = useClockModal({ text, dialogRef, returnTo, scrollHeldRef, announce, onClose })

  return (
    // data-village-clock・data-step は E2E がこの窓と段階を見分けるための目印
    <div
      ref={dialogRef}
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      lang={lang}
      data-village-clock
      data-step={step}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.pop}>
        <div className={styles.box}>
          <h2 id={titleId} className={styles.title}>
            {text.place}
          </h2>
          {step === 'choose' ? (
            <p className={styles.lead}>
              <PhraseText text={text.prompt} locale={lang} />
            </p>
          ) : (
            <>
              <p className={styles.lead}>
                <PhraseText text={text.customIntro} locale={lang} />
              </p>
              <p className={styles.lead}>
                <PhraseText text={text.pick} locale={lang} />
              </p>
              {/* 矢印は飾りなので文字要素にせず疑似要素で描く。読み上げ名は aria-label が持つ。
                  ◀ 値 ▶ は時・分それぞれで 1 つの組。role='group' で括り、値の span は
                  aria-live で読み上げる(矢印を押した結果が焦点の移らないまま変わるため) */}
              <div className={styles.dial}>
                <div className={styles.unit} role='group' aria-label={text.hourLabel}>
                  <span className={styles.unitLabel}>{text.hourLabel}</span>
                  <div className={styles.spin}>
                    <button
                      type='button'
                      className={styles.step}
                      aria-label={text.prevHour}
                      data-glyph='◀'
                      onClick={() => stepHour(-1)}
                    />
                    <span className={styles.value} data-clock-hour aria-live='polite'>
                      {pad2(hour)}
                    </span>
                    <button
                      type='button'
                      className={styles.step}
                      aria-label={text.nextHour}
                      data-glyph='▶'
                      onClick={() => stepHour(1)}
                    />
                  </div>
                </div>
                <div className={styles.unit} role='group' aria-label={text.minuteLabel}>
                  <span className={styles.unitLabel}>{text.minuteLabel}</span>
                  <div className={styles.spin}>
                    <button
                      type='button'
                      className={styles.step}
                      aria-label={text.prevMinute}
                      data-glyph='◀'
                      onClick={() => stepMinute(-MINUTE_STEP)}
                    />
                    <span className={styles.value} data-clock-minute aria-live='polite'>
                      {pad2(minute)}
                    </span>
                    <button
                      type='button'
                      className={styles.step}
                      aria-label={text.nextMinute}
                      data-glyph='▶'
                      onClick={() => stepMinute(MINUTE_STEP)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className={styles.actions}>
            {step === 'choose' ? (
              <>
                <button type='button' onClick={chooseRealtime}>
                  {text.realtime}
                </button>
                <button type='button' onClick={chooseCustom}>
                  {text.custom}
                </button>
                {/* 1 段目の「やめる」は何も変えずに閉じるだけ。会話窓の一言も書き換えない */}
                <button type='button' onClick={onClose}>
                  {text.cancel}
                </button>
              </>
            ) : (
              <>
                <button ref={decideRef} type='button' onClick={decide}>
                  {text.decide}
                </button>
                <button type='button' onClick={cancelPick}>
                  {text.cancel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClockModal
