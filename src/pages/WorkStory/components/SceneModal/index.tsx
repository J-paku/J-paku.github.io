// 場面プレビューの全画面モーダル。DeviceFrame + ScenePlayer(全場面)を画面中央に出し、
// 内部状態(activeIndex)で「今どの場面を見せているか」を管理する。呼び出し側は開始場面の
// index だけを渡し、以降の場面送りはこのコンポーネントが完結させる。
// ネイティブ <dialog> の showModal() で開く — フォーカストラップ・背景の不活性化はブラウザが保証するため、
// 手製の role="dialog" div より事故が少ない(src/test-setup.ts のコメントもこの前提を置いている)。
// 閉じる経路は3つ(右上×・スクリム(::backdrop相当の余白)クリック・Esc)あり、すべて onClose 1本に集約する。
// フォーカス管理は「開いたら閉じるボタンへ」「場面送りで境界(先頭/末尾)に達し
// クリック元のボタンが disabled になる直前に、フォーカスを別の要素へ先回りで逃がす」
// までをこの中で担い、「閉じたらトリガーへ戻す」は
// 呼び出し側(WorkStory)が持つ — トリガー要素の参照はこのモーダルの外にあるため
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { WorkStoryScene } from '@/types/content'
import DeviceFrame from '../DeviceFrame'
import ScenePlayer from '../ScenePlayer'
import styles from './scene-modal.module.css'

type SceneModalProps = {
  scenes: WorkStoryScene[]
  initialIndex: number
  placeholder: string
  closeLabel: string
  prevLabel: string
  nextLabel: string
  onClose: () => void
}

// 装飾専用の閉じるアイコン。読み上げはボタンの aria-label が担うため aria-hidden
function CloseIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.closeIcon}>
      <path
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        d='M5 5l14 14M19 5L5 19'
      />
    </svg>
  )
}

// 装飾専用の前へ/次へアイコン。読み上げはボタンの aria-label が担うため aria-hidden
function PrevIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.navIcon}>
      <path
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M15 5l-7 7 7 7'
      />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.navIcon}>
      <path
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M9 5l7 7-7 7'
      />
    </svg>
  )
}

function SceneModal({ scenes, initialIndex, placeholder, closeLabel, prevLabel, nextLabel, onClose }: SceneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const prevButtonRef = useRef<HTMLButtonElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)

  // 開始場面から先はこのコンポーネント内部の状態として持つ。呼び出し側が毎回モーダルを
  // 再マウントする構成(WorkStory側の条件レンダリング)のため、初期値としてのみ使えばよい
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const scene = scenes[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === scenes.length - 1

  // マウント時にネイティブモーダルとして開き、閉じるボタンへフォーカスを移す。
  // StrictMode の二重実行対策として、既に open な場合は showModal を呼び直さない
  useEffect(() => {
    const dialogElement = dialogRef.current
    if (dialogElement === null) return
    if (!dialogElement.open) dialogElement.showModal()
    closeButtonRef.current?.focus()
  }, [])

  // 開いている間は背景を固定する(top-layer に載っても背景スクロールは自動では止まらない)。
  // 復帰値は「開く直前の値」を保存し、閉じたら必ずそれへ戻す
  // (他の要因で overflow が変わっていても、このモーダルの分だけを正確に打ち消して漏れを防ぐ)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // dialog 要素自身が click の target ならスクリム(余白)クリック、
  // panel 側の子孫が target なら内容クリックなので閉じない(stopPropagation 不要の判定)
  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose()
  }

  // 遷移先の境界(先頭/末尾)でクリック元のボタンが disabled になる場合、
  // フォーカスを有効な別のナビゲーションボタン→閉じるボタンの順で先回りして移す。
  // disabled 化はレンダーの DOM 反映と同期してブラウザが行うため、useEffect で
  // 事後に document.activeElement を見て検知しようとしても、その時点で既に
  // フォーカスは document.body へ落ちた後で判定条件に一致せず検知できない
  // (disabled要素はフォーカスを保持できない)。そのため click ハンドラ内で
  // 遷移前に判定してフォーカスを動かす
  function focusAwayFromDisabledNav(nextIsFirst: boolean, nextIsLast: boolean) {
    if (nextIsFirst) {
      if (nextIsLast) closeButtonRef.current?.focus()
      else nextButtonRef.current?.focus()
    } else if (nextIsLast) {
      prevButtonRef.current?.focus()
    }
  }

  function handlePrev() {
    if (isFirst) return
    const targetIndex = activeIndex - 1
    focusAwayFromDisabledNav(targetIndex === 0, targetIndex === scenes.length - 1)
    setActiveIndex(targetIndex)
  }

  function handleNext() {
    if (isLast) return
    const targetIndex = activeIndex + 1
    focusAwayFromDisabledNav(targetIndex === 0, targetIndex === scenes.length - 1)
    setActiveIndex(targetIndex)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={scene.title}
      onClick={handleDialogClick}
      onCancel={onClose}
    >
      <div className={styles.panel}>
        <button
          ref={closeButtonRef}
          type='button'
          className={styles.close}
          aria-label={closeLabel}
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        <div className={styles.frameWrap}>
          <DeviceFrame>
            <ScenePlayer scenes={scenes} activeIndex={activeIndex} placeholder={placeholder} />
          </DeviceFrame>
        </div>

        <div className={styles.controls}>
          <button
            ref={prevButtonRef}
            type='button'
            className={styles.navButton}
            aria-label={prevLabel}
            onClick={handlePrev}
            disabled={isFirst}
          >
            <PrevIcon />
          </button>
          <span className={styles.counter} aria-live='polite'>
            {activeIndex + 1} / {scenes.length}
          </span>
          <button
            ref={nextButtonRef}
            type='button'
            className={styles.navButton}
            aria-label={nextLabel}
            onClick={handleNext}
            disabled={isLast}
          >
            <NextIcon />
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default SceneModal
