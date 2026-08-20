// 右列上部のタブ。作品一覧と担当業務の2枚を切り替える。
// WAI-ARIA APG のタブパターン: ロービング tabindex(選択中だけ 0)・←→ Home End・自動アクティベーション。
// 状態は持たず、選択中かどうかを受け取って描くだけ — 実体は Home の use-career-panel が持つ。
//
// 1024px 以下ではタブを出さない(CSS の display: none)。畳んだ幅では詳細パネル側の
// 「作品一覧へ戻る」ボタンが同じ役割を担う。
// 描かれるのは担当業務を見ている間だけ(条件は Home 側)。出ている間は上端に貼り付き、
// 読み進めても作品一覧へ戻る道が視界から消えないようにする
import { useRef, type KeyboardEvent } from 'react'
import { useContent } from '@/hooks/use-content'
import PhraseText from '@/components/PhraseText'
import styles from './panel-tabs.module.css'

// 並び順そのもの。矢印キーの移動先はこの並びで決まる
type TabKey = 'works' | 'career'
const TAB_ORDER: TabKey[] = ['works', 'career']

type PanelTabsProps = {
  // 担当業務のパネルを表示中なら true
  isCareerActive: boolean
  onSelectWorks: () => void
  onSelectCareer: () => void
}

function PanelTabs({ isCareerActive, onSelectWorks, onSelectCareer }: PanelTabsProps) {
  const { ui } = useContent()
  const worksTabRef = useRef<HTMLButtonElement>(null)
  const careerTabRef = useRef<HTMLButtonElement>(null)

  // 自動アクティベーション。移動先のタブへ焦点を移し、同時にパネルも切り替える
  const activate = (key: TabKey) => {
    if (key === 'works') {
      worksTabRef.current?.focus()
      onSelectWorks()
      return
    }
    careerTabRef.current?.focus()
    onSelectCareer()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = isCareerActive ? TAB_ORDER.indexOf('career') : TAB_ORDER.indexOf('works')
    let next = -1

    if (event.key === 'ArrowRight') next = (current + 1) % TAB_ORDER.length
    if (event.key === 'ArrowLeft') next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = TAB_ORDER.length - 1
    if (next < 0) return

    // 矢印での左右移動がページのスクロールにならないようにする
    event.preventDefault()
    activate(TAB_ORDER[next])
  }

  const worksClassName = isCareerActive ? styles.tab : `${styles.tab} ${styles.tabSelected}`
  const careerClassName = isCareerActive ? `${styles.tab} ${styles.tabSelected}` : styles.tab

  return (
    // タブ列自体には名前を付けない。何のタブ列かは直後のパネルの中身が示す
    <div role='tablist' className={styles.tablist} onKeyDown={handleKeyDown}>
      <button
        ref={worksTabRef}
        type='button'
        role='tab'
        id='tab-works'
        aria-controls='panel-works'
        aria-selected={!isCareerActive}
        tabIndex={isCareerActive ? -1 : 0}
        className={worksClassName}
        onClick={onSelectWorks}
      >
        <PhraseText text={ui.work.index} />
      </button>
      <button
        ref={careerTabRef}
        type='button'
        role='tab'
        id='tab-career'
        aria-controls='panel-career'
        aria-selected={isCareerActive}
        tabIndex={isCareerActive ? 0 : -1}
        className={careerClassName}
        onClick={onSelectCareer}
      >
        <PhraseText text={ui.career.tabDetail} />
      </button>
    </div>
  )
}

export default PanelTabs
