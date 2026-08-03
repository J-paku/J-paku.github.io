// Home の組み立てのみを行う。左列・右列それぞれの中身は各コンポーネントに委譲する。
// 08段階でセクション内ナビを廃したため、ここでアンカー用の id は付与しない
import ProfileColumn from './components/ProfileColumn'
import WorksSection from './components/WorksSection'
import styles from './home.module.css'

function Home() {
  return (
    <div className={styles.layout}>
      <ProfileColumn />
      <WorksSection />
    </div>
  )
}

export default Home
