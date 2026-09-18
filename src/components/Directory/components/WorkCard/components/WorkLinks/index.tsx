// live / repo / story(ストーリーページ)へのリンクを描画するだけの部品。3つとも無ければ何も描画しない
import Link from 'next/link'
import type { Locale, UiStrings } from '@content/types/content'
import { getTechIconPath } from '@/utils/tech-icons'
import { toHref } from '@/utils/locale-path'
import styles from './work-links.module.css'

type WorkLinksProps = {
  live?: string
  repo?: string
  // story を持つ作品の slug。undefined なら「ストーリー」ボタン自体を出さない
  storySlug?: string
  locale: Locale
  ui: UiStrings['work']
}

function WorkLinks({ live, repo, storySlug, locale, ui }: WorkLinksProps) {
  const hasLinks = live !== undefined || repo !== undefined || storySlug !== undefined
  if (!hasLinks) return null

  return (
    <div className={styles.links}>
      {live !== undefined ? (
        <a href={live} rel='noreferrer' className={styles.link}>
          {ui.live}
        </a>
      ) : null}
      {repo !== undefined ? (
        <a href={repo} rel='noreferrer' className={styles.link}>
          {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
          <svg className={styles.icon} viewBox='0 0 24 24' aria-hidden='true'>
            <path d={getTechIconPath(ui.repo)} />
          </svg>
          {ui.repo}
        </a>
      ) : null}
      {storySlug !== undefined ? (
        // サムネイル覆いの中にある同じ行き先のボタン(WorkCard/index.tsx の hasStoryOverlay)とは別の、
        // 常設の入口。live/repo が無い作品(覆いはstory専用ボタンになる)でも、あっても、ここには常に出す
        <Link href={toHref(`/works/${storySlug}`, locale)} className={styles.link}>
          {ui.story}
        </Link>
      ) : null}
    </div>
  )
}

export default WorkLinks
