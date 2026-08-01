// 技術スタックの1項目を描画するだけの最小部品。<ul>/<li> などの一覧セマンティクスは呼び出し側が決める
import styles from './tech-tag.module.css'

type TechTagProps = {
  label: string
}

function TechTag({ label }: TechTagProps) {
  return <span className={styles.tag}>{label}</span>
}

export default TechTag
