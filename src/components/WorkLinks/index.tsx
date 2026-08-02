// live / repo リンクを描画するだけの部品。どちらも無ければ何も描画しない
import { useContent } from '@/hooks/use-content'
import styles from './work-links.module.css'

type WorkLinksProps = {
  live?: string
  repo?: string
}

function WorkLinks({ live, repo }: WorkLinksProps) {
  const { ui } = useContent()

  const hasLinks = live !== undefined || repo !== undefined
  if (!hasLinks) return null

  return (
    <div className={styles.links}>
      {live !== undefined ? (
        <a href={live} rel="noreferrer" className={styles.link}>
          {ui.work.live}
        </a>
      ) : null}
      {repo !== undefined ? (
        <a href={repo} rel="noreferrer" className={styles.link}>
          {ui.work.repo}
        </a>
      ) : null}
    </div>
  )
}

export default WorkLinks
