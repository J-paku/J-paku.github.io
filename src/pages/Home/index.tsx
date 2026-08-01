// Home 画面の組み立てのみを行う。各セクション内部の状態・計算はセクション別コンポーネントに委譲する。
// セクションの id は Header 内ナビの href(#works 等)と一致させ、ここで初めて付与する
import Hero from './components/Hero'
import WorksSection from './components/WorksSection'
import NowSection from './components/NowSection'
import SkillsSection from './components/SkillsSection'
import AboutSection from './components/AboutSection'
import styles from './home.module.css'

function Home() {
  return (
    <div className={styles.home}>
      <Hero />
      <section id="works">
        <WorksSection />
      </section>
      <section id="now">
        <NowSection />
      </section>
      <section id="skills">
        <SkillsSection />
      </section>
      <section id="about">
        <AboutSection />
      </section>
    </div>
  )
}

export default Home
