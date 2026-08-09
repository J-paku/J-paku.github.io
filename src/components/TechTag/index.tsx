// 技術スタックの1項目を描画するだけの最小部品。<ul>/<li> などの一覧セマンティクスは呼び出し側が決める
import { getTechIconPath } from '@/utils/tech-icons'
import styles from './tech-tag.module.css'

type TechTagProps = {
  label: string
}

function TechTag({ label }: TechTagProps) {
  // ロゴを持つ技術だけアイコンを添える。装飾なので aria-hidden、意味はラベル文字列が担う
  const iconPath = getTechIconPath(label)

  return (
    <span className={styles.tag}>
      {iconPath !== undefined ? (
        <svg className={styles.icon} viewBox='0 0 24 24' aria-hidden='true'>
          <path d={iconPath} />
        </svg>
      ) : null}
      {label}
    </span>
  )
}

export default TechTag
