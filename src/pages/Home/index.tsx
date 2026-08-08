// Home の組み立てのみを行う。左列・右列それぞれの中身は各コンポーネントに委譲する。
// 08段階でセクション内ナビを廃したため、ここでアンカー用の id は付与しない
import GridLines from '@/components/GridLines'
import ProfileColumn from './components/ProfileColumn'
import WorksSection from './components/WorksSection'
import styles from './home.module.css'

function Home() {
  return (
    // 罫線は .layout の子ではなく兄弟に置く。子にすると .layout が作る重なり文脈の内側に
    // 閉じ込められ、内容の背面へ回らなくなる(モックアップも .grid-lines と main は兄弟)
    <>
      <GridLines />
      <div className={styles.layout}>
        <ProfileColumn />
        <WorksSection />
      </div>
    </>
  )
}

export default Home
