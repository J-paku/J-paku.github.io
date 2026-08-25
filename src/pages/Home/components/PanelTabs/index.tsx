// タブ廃止 — 復帰経路は CareerDetail の下部固定CTA に一本化した。
// Home 側の配線撤去はプロトタイプ(Home/index.tsx 編集中)整理後の後続コミットで行うため、
// ここでは props シグネチャだけ残して何も描かないダミーにする
type PanelTabsProps = {
  // 担当業務のパネルを表示中なら true
  isCareerActive: boolean
  onSelectWorks: () => void
  onSelectCareer: () => void
}

function PanelTabs(_props: PanelTabsProps) {
  return null
}

export default PanelTabs
