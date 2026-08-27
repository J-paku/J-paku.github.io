// イントロ(header領域)に置く小さな iPhone プレビュー。全画面モーダルへ視覚的な入口を与えるための
// 導線で、全体を1つの button として、場面1固定表示のまま DeviceFrame+ScenePlayer を再利用する。
// クリックで場面1からモーダルを開く(場面送りはモーダル側の前へ/次へボタンが担う)
import { useRef } from 'react'
import type { WorkStoryScene } from '@/types/content'
import DeviceFrame from '@/components/DeviceFrame'
import ScenePlayer from '@/components/ScenePlayer'
import styles from './intro-preview.module.css'

type IntroPreviewProps = {
  scenes: WorkStoryScene[]
  placeholder: string
  viewSceneLabel: string
  // モーダルを閉じた時にフォーカスを戻す先を渡すため、トリガー自身の要素も一緒に渡す
  onOpenScene: (index: number, trigger: HTMLButtonElement | null) => void
}

function IntroPreview({ scenes, placeholder, viewSceneLabel, onOpenScene }: IntroPreviewProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={triggerRef}
      type='button'
      className={styles.trigger}
      aria-label={viewSceneLabel}
      onClick={() => onOpenScene(0, triggerRef.current)}
    >
      <span className={styles.frameWrap}>
        {/* DeviceFrame は自然サイズで描画し、frameScale側のtransform: scale()で丸ごと縮小する
            (device-frame.module.css のpx固定装飾の比率を保つため。詳細はCSS側コメント参照) */}
        <span className={styles.frameScale}>
          <DeviceFrame>
            <ScenePlayer scenes={scenes} activeIndex={0} placeholder={placeholder} />
          </DeviceFrame>
        </span>
      </span>
    </button>
  )
}

export default IntroPreview
