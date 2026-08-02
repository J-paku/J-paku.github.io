// Hero セクションの組み立てのみ行う。文言は全て profile から取得する
// セクション id / aria-labelledby は Home 組み立て担当(次ラウンド)が付与する
//
// 表示順は「headline(主張) → name+location(帰属) → goal(本文)」。
// h1 はページの見出しという意味論を保つため profile.name のまま据え置くが、
// 視覚上の大きさは headline に譲る。DOM順と画面上の順序を一致させているため、
// スクリーンリーダーで読んでも headline → name の順で自然に読める
import { useContent } from '@/hooks/use-content'
import styles from './hero.module.css'

function Hero() {
  const { profile } = useContent()

  return (
    <section className={styles.hero}>
      <p className={styles.headline}>{profile.headline}</p>
      <div className={styles.attribution}>
        <h1 className={styles.name}>{profile.name}</h1>
        <p className={styles.location}>{profile.location}</p>
      </div>
      <p className={styles.goal}>{profile.goal}</p>
    </section>
  )
}

export default Hero
