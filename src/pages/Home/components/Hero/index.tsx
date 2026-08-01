// Hero セクションの組み立てのみ行う。文言は全て profile から取得する
// セクション id / aria-labelledby は Home 組み立て担当(次ラウンド)が付与する
import { useContent } from '@/hooks/use-content'
import styles from './hero.module.css'

function Hero() {
  const { profile } = useContent()

  return (
    <section className={styles.hero}>
      <h1 className={styles.name}>{profile.name}</h1>
      <p className={styles.headline}>{profile.headline}</p>
      <p className={styles.goal}>{profile.goal}</p>
      <p className={styles.location}>{profile.location}</p>
    </section>
  )
}

export default Hero
