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

// 各場面のSVGアニメーション1周期の長さ(ms)。各SVGファイルの animation-duration の値をそのまま反映している。
// scene1-camera.svg: 7000 / scene2-register.svg: 8000 / scene3-web.svg: 8000 / scene4-nearby.svg: 6000
// SVG側の周期を変更したら、ここも合わせて更新すること
const SCENE_ANIMATION_DURATIONS_MS: Record<string, number> = {
  camera: 7000,
  register: 8000,
  web: 8000,
  nearby: 6000,
}

// 上記マップに未登録の場面id向けの既定値
const DEFAULT_SCENE_ANIMATION_DURATION_MS = 8000

type SceneModalProps = {
  scenes: WorkStoryScene[]
  initialIndex: number
  placeholder: string
  closeLabel: string
  prevLabel: string
  nextLabel: string
  pauseLabel: string
  resumeLabel: string
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

// 装飾専用の一時停止アイコン(縦棒2本)。読み上げはボタンの aria-label が担うため aria-hidden
function PauseIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.pulseIcon}>
      <path fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' d='M8 5v14M16 5v14' />
    </svg>
  )
}

// 装飾専用の再開アイコン(再生三角)。読み上げはボタンの aria-label が担うため aria-hidden
function PlayIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.pulseIcon}>
      <path
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M7 5l12 7-12 7z'
      />
    </svg>
  )
}

function SceneModal({
  scenes,
  initialIndex,
  placeholder,
  closeLabel,
  prevLabel,
  nextLabel,
  pauseLabel,
  resumeLabel,
  onClose,
}: SceneModalProps) {
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

  // 自動送りの一時停止フラグ(WCAG 2.2.2 対応)。activeIndex とは独立した state のため、
  // 手動での場面送り(handlePrev/handleNext)を挟んでも一時停止状態はそのまま保持される
  const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false)

  // タップのたびに「今の操作」を短く出すための鍵。key を変えて要素を作り直すことで
  // 同じアニメーションを毎回頭から再生させる(CSSアニメーションは再代入では再生されない)
  const [pulseKey, setPulseKey] = useState(0)

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

  // 自動送りタイマー起点のフォーカス退避。手動クリック(focusAwayFromDisabledNav)と違い、
  // 遷移直前に disabled 化されるボタンへ実際にフォーカスが乗っている場合だけ動かす。
  // 無条件に動かすと、閉じるボタン等どこにフォーカスがあってもタイマーが奪ってしまう。
  // nextIsFirst(末尾→先頭への折り返し)のときだけ closeButtonRef へ直接逃がす —
  // 逃避先の次へボタンは、この時点ではまだ状態未コミットで末尾のまま disabled のため
  // focus() が無視される(常に有効な閉じるボタンなら確実に受け取れる)。
  // nextIsLast(先頭→末尾側)の逃避先(前へボタン)は遷移前から有効なので従来どおり委譲する
  function focusAwayFromDisabledNavOnAutoAdvance(nextIsFirst: boolean, nextIsLast: boolean) {
    const disablingButton = nextIsFirst ? prevButtonRef.current : nextIsLast ? nextButtonRef.current : null
    if (disablingButton === null || document.activeElement !== disablingButton) return
    if (nextIsFirst) closeButtonRef.current?.focus()
    else focusAwayFromDisabledNav(nextIsFirst, nextIsLast)
  }

  // 今の場面のアニメーション周期が経過したら次の場面へ自動送りする。
  // activeIndex を effect の依存にしているため、手動prev/nextでactiveIndexが変わった時も
  // 同じ effect が発火し直し、新しい場面の周期でタイマーが再設定される
  // (手動操作用に別途タイマーをリセットする処理は不要)。
  // ScenePlayer 側は活性化のたびに img を key 変更で再マウントするため(該当コンポーネントのコメント参照)、
  // 表示され始めた場面のアニメーションは常に0から再生される — このタイマーの周期と自然に同期する
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // reduced motion環境ではSVGアニメーション自体が停止しているため、時間経過での自動送りに意味がない
    if (prefersReducedMotion) return
    // ユーザーが一時停止トグルを操作している間は自動送りを止める(WCAG 2.2.2 の停止手段)
    if (isAutoAdvancePaused) return

    const duration = SCENE_ANIMATION_DURATIONS_MS[scene.id] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS
    const timerId = window.setTimeout(() => {
      const nextIndex = (activeIndex + 1) % scenes.length
      focusAwayFromDisabledNavOnAutoAdvance(nextIndex === 0, nextIndex === scenes.length - 1)
      setActiveIndex(nextIndex)
    }, duration)

    return () => window.clearTimeout(timerId)
  }, [activeIndex, scene.id, scenes.length, isAutoAdvancePaused])

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

  function handleToggleAutoAdvance() {
    setIsAutoAdvancePaused((prev) => !prev)
    setPulseKey((prev) => prev + 1)
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

        {/* 自動送りの一時停止/再開(WCAG 2.2.2)。角の小さなボタンではなく画面そのものを押させる —
            動画プレイヤーと同じ操作感で、閉じるボタンと近接して誤タップになるのも避けられる。
            状態表現は aria-label の文言差し替えのみで行う。WAI-ARIA APGのカルーセル回転停止
            コントロールに倣った判断で、aria-pressed を併用すると停止中に「再開、押されています」と
            読み上げられ意味が矛盾するため付けない。
            中身は img とテキストだけで、押せる要素を含まない(入れ子の対話要素にならない) */}
        <button
          type='button'
          className={styles.sceneToggle}
          aria-label={isAutoAdvancePaused ? resumeLabel : pauseLabel}
          onClick={handleToggleAutoAdvance}
        >
          <div className={styles.frameWrap}>
            <DeviceFrame>
              <ScenePlayer scenes={scenes} activeIndex={activeIndex} placeholder={placeholder} />
            </DeviceFrame>
          </div>

          {/* 押した直後だけ出て消える合図。装飾なので読み上げ対象から外す */}
          <span key={pulseKey} className={styles.pulse} aria-hidden='true'>
            {isAutoAdvancePaused ? <PlayIcon /> : <PauseIcon />}
          </span>

          {/* 停止中はその状態が続いていることを示し続ける。合図が消えたあとも
              「止まっている」と分かるようにするため、パルスとは別に置く */}
          {isAutoAdvancePaused ? (
            <span className={styles.pausedMark} aria-hidden='true'>
              <PlayIcon />
            </span>
          ) : null}
        </button>

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
