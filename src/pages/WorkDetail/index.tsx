// 作品1件のケーススタディを描画する。作品取得は useContent().works の1箇所からのみ行い、
// 別の索引マップは持たない(同一概念の判定基準が二重化するのを避ける)
import { Link, useParams } from 'react-router'
import { CASE_SECTION_ORDER, type CaseSection } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import { withLocale } from '@/utils/locale-path'
import TechTag from '@/components/TechTag'
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

  const hasMeta = work.period !== undefined || work.role !== undefined || work.scale !== undefined
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined

  return (
    <article className={styles.article}>
      <h1 className={styles.title}>{work.title}</h1>
      {hasMeta ? (
        <dl className={styles.meta}>
          {work.period !== undefined ? (
            <div className={styles.metaItem}>
              <dt>{ui.work.period}</dt>
              <dd>{work.period}</dd>
            </div>
          ) : null}
          {work.role !== undefined ? (
            <div className={styles.metaItem}>
              <dt>{ui.work.role}</dt>
              <dd>{work.role}</dd>
            </div>
          ) : null}
          {work.scale !== undefined ? (
            <div className={styles.metaItem}>
              <dt>{ui.work.scale}</dt>
              <dd>{work.scale}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {work.stack.length > 0 ? (
        <ul className={styles.stack} aria-label={ui.work.stack}>
          {work.stack.map((tech) => (
            <li key={tech}>
              <TechTag label={tech} />
            </li>
          ))}
        </ul>
      ) : null}
      {hasLinks ? (
        <div className={styles.links}>
          {work.links.live !== undefined ? (
            <a href={work.links.live} rel="noreferrer" className={styles.link}>
              {ui.work.live}
            </a>
          ) : null}
          {work.links.repo !== undefined ? (
            <a href={work.links.repo} rel="noreferrer" className={styles.link}>
              {ui.work.repo}
            </a>
          ) : null}
        </div>
      ) : null}
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
