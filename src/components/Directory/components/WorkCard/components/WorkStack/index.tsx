// 技術スタックの <ul> 一覧を描画するだけの部品。スタックが空なら何も描画しない
import TechTag from '@/components/ui/TechTag'
import styles from './work-stack.module.css'

type WorkStackProps = {
  stack: string[]
  label: string
}

function WorkStack({ stack, label }: WorkStackProps) {
  if (stack.length === 0) return null

  return (
    <ul className={styles.stack} aria-label={label}>
      {stack.map(tech => (
        <li key={tech}>
          <TechTag label={tech} />
        </li>
      ))}
    </ul>
  )
}

export default WorkStack
