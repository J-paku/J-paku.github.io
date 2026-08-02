// 期間・役割・規模の <dl> を描画する部品。カード(一覧)と詳細で見た目が意図的に異なるため
// variant で切り替える。各フィールドは optional なので個別に条件分岐する
import { useContent } from '@/hooks/use-content'
import styles from './work-meta.module.css'

type WorkMetaProps = {
  variant: 'card' | 'detail'
  period?: string
  role?: string
  scale?: string
}

function WorkMeta({ variant, period, role, scale }: WorkMetaProps) {
  const { ui } = useContent()

  const hasMeta = period !== undefined || role !== undefined || scale !== undefined
  if (!hasMeta) return null

  const metaClassName = variant === 'card' ? styles.metaCard : styles.metaDetail
  const metaItemClassName = variant === 'card' ? styles.metaItemCard : styles.metaItemDetail

  return (
    <dl className={metaClassName}>
      {period !== undefined ? (
        <div className={metaItemClassName}>
          <dt>{ui.work.period}</dt>
          <dd>{period}</dd>
        </div>
      ) : null}
      {role !== undefined ? (
        <div className={metaItemClassName}>
          <dt>{ui.work.role}</dt>
          <dd>{role}</dd>
        </div>
      ) : null}
      {scale !== undefined ? (
        <div className={metaItemClassName}>
          <dt>{ui.work.scale}</dt>
          <dd>{scale}</dd>
        </div>
      ) : null}
    </dl>
  )
}

export default WorkMeta
