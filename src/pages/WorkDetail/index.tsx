// 作品1件のケーススタディを描画する。作品取得は useContent().works の1箇所からのみ行い、
// 別の索引マップは持たない(同一概念の判定基準が二重化するのを避ける)
import { Link, useParams } from 'react-router'
import { CASE_SECTION_ORDER, type CaseSection } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { withLocale } from '@/utils/locale-path'
import WorkMeta from '@/components/WorkMeta'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import CaseStudySection from '@/components/CaseStudySection'
import NotFound from '@/pages/NotFound'
import styles from './work-detail.module.css'

function WorkDetail() {
  const { slug } = useParams()
  const { ui, works } = useContent()
  const { locale } = useLocale()

  const work = works.find((item) => item.slug === slug)

  // wip作品は詳細ページを持たない(不変ルール5)。判定は status のみで行い、slug名では判定しない
  if (work === undefined || work.status === 'wip') {
    return <NotFound />
  }

  // 描画順の正本は CASE_SECTION_ORDER。sections 配列側の並びには依存しない
  // find が undefined を返した節は描画しない(空タイトルより無いほうがよい)
  const orderedSections = CASE_SECTION_ORDER.map((key) =>
    work.sections.find((section) => section.key === key),
  ).filter((section): section is CaseSection => section !== undefined)

  return (
    <article className={styles.article}>
      <h1 className={styles.title}>{work.title}</h1>
      <WorkMeta variant="detail" period={work.period} role={work.role} scale={work.scale} />
      <WorkStack stack={work.stack} />
      <WorkLinks live={work.links.live} repo={work.links.repo} />
      {orderedSections.map((section) => (
        <CaseStudySection key={section.key} heading={section.heading} body={section.body} />
      ))}
      <nav className={styles.nav}>
        <Link to={withLocale('/', locale)} className={styles.backLink}>
          {ui.work.backToList}
        </Link>
      </nav>
    </article>
  )
}

export default WorkDetail
