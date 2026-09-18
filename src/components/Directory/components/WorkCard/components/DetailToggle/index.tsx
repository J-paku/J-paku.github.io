// 折りたたみ式の詳細を開閉するトグルボタン。開閉状態は親が持ち、ここは描画と切り替えの伝達だけを担う
import type { Dispatch, SetStateAction } from 'react'
import type { UiStrings } from '@content/types/content'
import styles from '../../work-card.module.css'

type DetailToggleProps = {
  isDetailOpen: boolean
  setIsDetailOpen: Dispatch<SetStateAction<boolean>>
  // 開閉対象(詳細行)の要素ID。aria-controlsで結ぶ
  detailId: string
  ui: UiStrings
}

function DetailToggle({ isDetailOpen, setIsDetailOpen, detailId, ui }: DetailToggleProps) {
  // 詳細トグル。全幅バーではなく中央寄せの小さなテキストリンク然としたボタン。
  // 下線・シェブロンは常時表示し、カードを開く場所としての存在感を持たせる
  return (
    <button
      type='button'
      className={styles.detailToggle}
      aria-expanded={isDetailOpen}
      aria-controls={detailId}
      onClick={() => setIsDetailOpen(open => !open)}
    >
      <span className={styles.detailToggleLabel}>
        {isDetailOpen ? ui.work.hideDetail : ui.work.showDetail}
      </span>
      <svg className={styles.detailChevron} viewBox='0 0 16 16' aria-hidden='true'>
        <path
          d='M4 6l4 4 4-4'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </button>
  )
}

export default DetailToggle
