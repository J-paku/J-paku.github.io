// 技術スタックの <ul> 一覧を描画するだけの部品。スタックが空なら何も描画しない
import { useContent } from '@/hooks/use-content'
import TechTag from '@/components/TechTag'
import styles from './work-stack.module.css'

type WorkStackProps = {
  stack: string[]
}

function WorkStack({ stack }: WorkStackProps) {
  const { ui } = useContent()

  if (stack.length === 0) return null

  return (
    <ul className={styles.stack} aria-label={ui.work.stack}>
      {stack.map((tech) => (
        <li key={tech}>
          <TechTag label={tech} />
        </li>
      ))}
    </ul>
  )
}

export default WorkStack
