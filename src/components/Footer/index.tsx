// フッターの組み立てのみを行う。品質指標の取得・非表示判定は QualityBadge 側に委譲する
import QualityBadge from '@/components/QualityBadge'
import styles from './footer.module.css'

function Footer() {
  return (
    <footer className={styles.footer}>
      <QualityBadge />
    </footer>
  )
}

export default Footer
