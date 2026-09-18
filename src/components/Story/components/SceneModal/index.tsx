// 場面プレビューの全画面モーダル。DeviceFrame + ScenePlayer(全場面)を画面中央に出し、
// 内部状態(activeIndex)で「今どの場面を見せているか」を管理する。呼び出し側は開始場面の
// index だけを渡し、以降の場面送りはこのコンポーネントが完結させる。
// ネイティブ <dialog> の showModal() で開く — フォーカストラップ・背景の不活性化はブラウザが保証するため、
// 手製の role="dialog" div より事故が少ない(src/test-setup.ts のコメントもこの前提を置いている)。
// 閉じる経路は3つ(右上×・スクリム(::backdrop相当の余白)クリック・Esc)あり、すべて onClose 1本に集約する。
// フォーカス管理は「開いたら閉じるボタンへ」「場面送りで境界(先頭/末尾)に達し
// クリック元のボタンが disabled になる直前に、フォーカスを別の要素へ先回りで逃がす」
// までをこの中で担い、「閉じたらトリガーへ戻す」は
// 呼び出し側(WorkStory)が持つ — トリガー要素の参照はこのモーダルの外にあるため。
// 実装の置き場所は、dialogの開閉・背景固定・スクリムクリックがhooks/use-modal-dialog.ts、
// 場面送り・一時停止・自動送り・境界でのフォーカス退避がhooks/use-scene-carousel.ts、
// 閉じる/前へ/次へのアイコンがcomponents/ControlIcon
'use client'
import { useRef } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import DeviceFrame from '@/components/ui/DeviceFrame'
import ScenePlayer from '@/components/ui/ScenePlayer'
import PlaybackIcon from '@/components/ui/PlaybackIcon'
import ControlIcon from './components/ControlIcon'
import { useModalDialog } from './hooks/use-modal-dialog'
import { useSceneCarousel } from './hooks/use-scene-carousel'
import styles from './scene-modal.module.css'

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

  // effectの実行順(showModal・フォーカス→背景固定→自動送り)を保つため、dialog側を先に呼ぶ
  const handleDialogClick = useModalDialog({ dialogRef, closeButtonRef, onClose })
  const {
    activeIndex,
    scene,
    isFirst,
    isLast,
    isAutoAdvancePaused,
    pulseKey,
    handlePrev,
    handleNext,
    handleToggleAutoAdvance,
  } = useSceneCarousel({ scenes, initialIndex, closeButtonRef, prevButtonRef, nextButtonRef })

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
          <ControlIcon kind='close' className={styles.closeIcon} />
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
              <ScenePlayer
                scenes={scenes}
                activeIndex={activeIndex}
                placeholder={placeholder}
                paused={isAutoAdvancePaused}
              />
            </DeviceFrame>
          </div>

          {/* 押した直後だけ出て消える合図。装飾なので読み上げ対象から外す */}
          <span key={pulseKey} className={styles.pulse} aria-hidden='true'>
            {isAutoAdvancePaused ? (
              <PlaybackIcon kind='play' className={styles.pulseIcon} />
            ) : (
              <PlaybackIcon kind='pause' className={styles.pulseIcon} />
            )}
          </span>

          {/* 停止中はその状態が続いていることを示し続ける。合図が消えたあとも
              「止まっている」と分かるようにするため、パルスとは別に置く */}
          {isAutoAdvancePaused ? (
            <span className={styles.pausedMark} aria-hidden='true'>
              <PlaybackIcon kind='play' className={styles.pulseIcon} />
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
            <ControlIcon kind='prev' className={styles.navIcon} />
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
            <ControlIcon kind='next' className={styles.navIcon} />
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default SceneModal
