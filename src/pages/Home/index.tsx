// Home の組み立てのみを行う。左列・右列それぞれの中身は各コンポーネントに委譲する。
// 08段階でセクション内ナビを廃したため、ここでアンカー用の id は付与しない
//
// 11段階で右列が2枚のタブパネル(作品一覧 / 担当業務の詳細)になった。
// 状態は use-career-panel が1つだけ持ち、左列のトリガーと右列のタブの両方へここから配る
import { useContent } from '@/hooks/use-content'
import ProfileColumn from './components/ProfileColumn'
import WorksSection from './components/WorksSection'
import PanelTabs from './components/PanelTabs'
import CareerDetail from './components/CareerDetail'
import { useCareerPanel } from './hooks/use-career-panel'
import styles from './home.module.css'

function Home() {
  const { profile } = useContent()
  const { activeCareerId, activeCareer, panelCareer, openCareer, showDetail, showWorks, panelRef } =
    useCareerPanel(profile.careers)

  return (
    <div className={styles.layout}>
      <ProfileColumn activeCareerId={activeCareerId} onSelectCareer={openCareer} />

      {/* 右列。タブ + パネル2枚を縦に積むだけの器で、余白は各パネルが自分で持つ */}
      <div className={styles.panels}>
        {panelCareer !== null ? (
          <PanelTabs
            isCareerActive={activeCareer !== null}
            onSelectWorks={showWorks}
            onSelectCareer={showDetail}
          />
        ) : null}

        {/* 非表示側はアンマウントせず hidden で隠す(カードの出現状態と、字形被覆検査の採取のため) */}
        <WorksSection isHidden={activeCareer !== null} />

        {panelCareer !== null ? (
          <CareerDetail
            career={panelCareer}
            isHidden={activeCareer === null}
            onBackToWorks={showWorks}
            panelRef={panelRef}
          />
        ) : null}
      </div>
    </div>
  )
}

export default Home
