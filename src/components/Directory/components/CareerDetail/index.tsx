// 「担当業務の詳細」パネル(11段階)。v2 では差し替えをやめ、一覧ページ内に
// 全件を展開して置く。受け取った1件を描くことだけを担うのは変わらない。
//
// 文言は career と ui からのみ取る。ラテンのみのキッカー(CAREER DETAIL)は
// 左列の PORTFOLIO — 2026 と同じ扱いで content には置かない
import { Fragment } from 'react'
import type { Career, Locale, UiStrings } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import Asides from './components/Asides'
import Assignment from './components/Assignment'
import Facts from './components/Facts'
import Features from './components/Features'
import Origin from './components/Origin'
import styles from './career-detail.module.css'

type CareerDetailProps = {
  // 描く経歴。detail を持たない経歴は親が渡さない
  career: Career
  ui: UiStrings
  locale: Locale
}

// 見出し下の1行で期間と役割を繋ぐ。区切り文字はコンテンツ側に持たせない(左列と同じ扱い)
const SEPARATOR = ' · '

function CareerDetail({ career, ui, locale }: CareerDetailProps) {
  const { detail } = career
  if (detail === undefined) return null

  // 同じページに複数枚並ぶため、見出しの id も経歴ごとに分ける
  const headingId = `career-heading-${career.id}`

  return (
    <section
      id={`career-${career.id}`}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={styles.panel}
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>CAREER DETAIL</p>
        <h2 id={headingId} className={styles.company}>
          <PhraseText text={career.company} locale={locale} />
        </h2>
        <p className={styles.headMeta}>
          <PhraseText text={`${career.period}${SEPARATOR}${career.role}`} locale={locale} />
        </p>
      </header>

      {/* 総論。何を作っていたのかを最初の1画面で掴ませる */}
      <div className={styles.overview}>
        <h3 className={styles.overviewTitle}>
          <PhraseText text={detail.overview.title} locale={locale} />
        </h3>
        <p className={styles.body}>
          <PhraseText text={detail.overview.body} locale={locale} />
        </p>
        <p className={styles.overviewMeta}>
          <PhraseText text={detail.overview.meta} locale={locale} />
        </p>
      </div>

      {detail.origin !== undefined ? <Origin origin={detail.origin} locale={locale} /> : null}

      {detail.core !== undefined ? (
        <div className={styles.core}>
          <p className={styles.coreClaim}>
            <PhraseText text={detail.core.claim} locale={locale} />
          </p>
          <p className={styles.body}>
            <PhraseText text={detail.core.body} locale={locale} />
          </p>
        </div>
      ) : null}

      {/* 事実の列。ラベル列 + 値列で、狭い幅では縦に積む(CSS側) */}
      <Facts rows={detail.facts} locale={locale} />

      {/* 技術スタック表。Web / Native などの層ごとに見出しを立て、行は facts と同じ構造で描く。
          層見出し(Web / Native)はラテンのみの固定文字列相当で、機能一覧の日付(featureDate)と
          同じ扱いで PhraseText を通さない */}
      {detail.stacks !== undefined ? (
        <section className={styles.block}>
          <h3 className={styles.blockHeading}>
            <PhraseText text={detail.stacks.heading} locale={locale} />
          </h3>
          {detail.stacks.groups.map(group => (
            <Fragment key={group.title}>
              <h4 className={styles.stackGroupTitle}>{group.title}</h4>
              <Facts rows={group.rows} locale={locale} />
            </Fragment>
          ))}
        </section>
      ) : null}

      {/* 派遣先ごとの担当内容。在籍1社・派遣先複数の経歴だけが持つ。
          パネル内の第2階層の切れ目なので、節ラベル(ASSIGNMENT NN)+題字で文書のように区切る。
          節番号はラテンのみの装飾 — CAREER DETAIL と同じ扱いで content には置かない */}
      {detail.assignments !== undefined
        ? detail.assignments.map((assignment, index) => (
            <Assignment
              key={assignment.client}
              assignment={assignment}
              index={index}
              locale={locale}
            />
          ))
        : null}

      {detail.features !== undefined ? (
        <Features features={detail.features} ui={ui} locale={locale} />
      ) : null}

      {detail.asides !== undefined ? <Asides asides={detail.asides} locale={locale} /> : null}

      {/* 作品一覧への戻り道。v2 では同一ページ内の #works へ跳ぶアンカーにする */}
      <a className={styles.back} href='#works'>
        <PhraseText text={ui.career.backToWorks} locale={locale} />
      </a>
    </section>
  )
}

export default CareerDetail
