// 右列に差し替えで出る「担当業務の詳細」パネル(11段階)。
// どの経歴を出すか・いつ閉じるか・フォーカス制御は親(use-career-panel)が持ち、
// ここは受け取った1件を描くことだけを担う。
//
// 文言は career と ui からのみ取る。ラテンのみのキッカー(CAREER DETAIL)は
// 左列の PORTFOLIO — 2026 と同じ扱いで content には置かない
import { Fragment, type RefObject } from 'react'
import type { Career, CareerRole } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import PhraseText from '@/components/PhraseText'
import TechTag from '@/components/TechTag'
import styles from './career-detail.module.css'

type CareerDetailProps = {
  // 表示中の経歴。detail を持たない経歴は左列がトリガー自体を出さない
  career: Career
  // 作品一覧を表示中は true。アンマウントせず hidden で隠す
  isHidden: boolean
  // 下部固定CTA「作品一覧へ戻る」から呼ぶ
  onBackToWorks: () => void
  // 開いた直後に親が focus({ preventScroll: true }) するための参照
  panelRef: RefObject<HTMLElement | null>
}

// 見出し下の1行で期間と役割を繋ぐ。区切り文字はコンテンツ側に持たせない(左列と同じ扱い)
const SEPARATOR = ' · '

// 工程バッジは常に3つ並べ、roles に含まれるものだけを担当として塗る。
// 並びは設計 → 実装 → リリースで固定する
const ROLE_ORDER: CareerRole[] = ['design', 'build', 'release']

function CareerDetail({ career, isHidden, onBackToWorks, panelRef }: CareerDetailProps) {
  const { ui } = useContent()

  const { detail } = career
  if (detail === undefined) return null

  const roleLabels: Record<CareerRole, string> = {
    design: ui.career.roleDesign,
    build: ui.career.roleBuild,
    release: ui.career.roleRelease,
  }

  return (
    <section
      id='panel-career'
      aria-labelledby='career-detail-heading'
      tabIndex={-1}
      ref={panelRef}
      hidden={isHidden}
      className={styles.panel}
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>CAREER DETAIL</p>
        <h2 id='career-detail-heading' className={styles.company}>
          <PhraseText text={career.company} />
        </h2>
        <p className={styles.headMeta}>
          <PhraseText text={`${career.period}${SEPARATOR}${career.role}`} />
        </p>
      </header>

      {/* 総論。何を作っていたのかを最初の1画面で掴ませる */}
      <div className={styles.overview}>
        <h3 className={styles.overviewTitle}>
          <PhraseText text={detail.overview.title} />
        </h3>
        <p className={styles.body}>
          <PhraseText text={detail.overview.body} />
        </p>
        <p className={styles.overviewMeta}>
          <PhraseText text={detail.overview.meta} />
        </p>
      </div>

      {detail.origin !== undefined ? (
        <section className={styles.block}>
          <h3 className={styles.blockHeading}>
            <PhraseText text={detail.origin.heading} />
          </h3>
          {detail.origin.lead !== undefined ? (
            <p className={styles.lead}>
              <PhraseText text={detail.origin.lead} />
            </p>
          ) : null}
          {/* 現場の手順なので順序付きリスト。コマ間の › は装飾のためCSSの疑似要素が持つ */}
          <ol className={styles.flow}>
            {detail.origin.flow.map((step, index) => (
              // 送り記号を枠の外に置くため、<li> は包むだけにしてコマ本体は中の span が持つ
              // 同じ語が再登場しうるので鍵に位置を含める。並びは入力が同じなら常に同じ
              <li key={`${index}:${step.label}`} className={styles.flowItem}>
                <span className={step.emphasis === true ? styles.flowChipStrong : styles.flowChip}>
                  {step.emphasis === true ? (
                    // 強調は濃さだけに頼らず strong でも示す
                    <strong className={styles.flowStrongText}>
                      <PhraseText text={step.label} />
                    </strong>
                  ) : (
                    <PhraseText text={step.label} />
                  )}
                </span>
              </li>
            ))}
          </ol>
          {detail.origin.note !== undefined ? (
            <p className={styles.note}>
              <PhraseText text={detail.origin.note} />
            </p>
          ) : null}
        </section>
      ) : null}

      {detail.core !== undefined ? (
        <div className={styles.core}>
          <p className={styles.coreClaim}>
            <PhraseText text={detail.core.claim} />
          </p>
          <p className={styles.body}>
            <PhraseText text={detail.core.body} />
          </p>
        </div>
      ) : null}

      {/* 事実の列。ラベル列 + 値列で、狭い幅では縦に積む(CSS側) */}
      <dl className={styles.facts}>
        {detail.facts.map((fact) => (
          <div key={fact.label} className={styles.factRow}>
            <dt className={styles.factLabel}>
              <PhraseText text={fact.label} />
            </dt>
            <dd className={styles.factValue}>
              <PhraseText text={fact.value} />
            </dd>
          </div>
        ))}
      </dl>

      {/* 技術スタック表。Web / Native などの層ごとに見出しを立て、行は facts と同じ構造で描く。
          層見出し(Web / Native)はラテンのみの固定文字列相当で、機能一覧の日付(featureDate)と
          同じ扱いで PhraseText を通さない */}
      {detail.stacks !== undefined ? (
        <section className={styles.block}>
          <h3 className={styles.blockHeading}>
            <PhraseText text={detail.stacks.heading} />
          </h3>
          {detail.stacks.groups.map((group) => (
            <Fragment key={group.title}>
              <h4 className={styles.stackGroupTitle}>{group.title}</h4>
              <dl className={styles.facts}>
                {group.rows.map((row) => (
                  <div key={row.label} className={styles.factRow}>
                    <dt className={styles.factLabel}>
                      <PhraseText text={row.label} />
                    </dt>
                    <dd className={styles.factValue}>
                      <PhraseText text={row.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Fragment>
          ))}
        </section>
      ) : null}

      {/* 派遣先ごとの担当内容。在籍1社・派遣先複数の経歴だけが持つ。
          パネル内の第2階層の切れ目なので、節ラベル(ASSIGNMENT NN)+題字で文書のように区切る。
          節番号はラテンのみの装飾 — CAREER DETAIL と同じ扱いで content には置かない */}
      {detail.assignments !== undefined
        ? detail.assignments.map((assignment, index) => (
            <section key={assignment.client} className={styles.assignmentBlock}>
              <p className={styles.assignmentEyebrow}>
                {`ASSIGNMENT ${String(index + 1).padStart(2, '0')}`}
              </p>
              <h3 className={styles.assignmentClient}>
                <PhraseText text={assignment.client} />
              </h3>
              <p className={styles.assignmentTitle}>
                <PhraseText text={assignment.title} />
              </p>
              <p className={styles.overviewMeta}>
                <PhraseText text={assignment.meta} />
              </p>
              {assignment.lead !== undefined ? (
                <p className={styles.lead}>
                  <PhraseText text={assignment.lead} />
                </p>
              ) : null}
              {assignment.core !== undefined ? (
                <div className={styles.core}>
                  <p className={styles.coreClaim}>
                    <PhraseText text={assignment.core.claim} />
                  </p>
                  <p className={styles.body}>
                    <PhraseText text={assignment.core.body} />
                  </p>
                </div>
              ) : null}
              <dl className={styles.facts}>
                {assignment.facts.map((fact) => (
                  <div key={fact.label} className={styles.factRow}>
                    <dt className={styles.factLabel}>
                      <PhraseText text={fact.label} />
                    </dt>
                    <dd className={styles.factValue}>
                      <PhraseText text={fact.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        : null}

      {detail.features !== undefined ? (
        <section className={styles.block}>
          <h3 className={styles.blockHeading}>
            <PhraseText text={detail.features.heading} />
          </h3>
          {detail.features.lead !== undefined ? (
            <p className={styles.lead}>
              <PhraseText text={detail.features.lead} />
            </p>
          ) : null}
          <ul className={styles.features}>
            {detail.features.items.map((item) => (
              <li key={`${item.date}:${item.name}`} className={styles.feature}>
                <p className={styles.featureDate}>{item.date}</p>
                <p className={styles.featureName}>
                  <PhraseText text={item.name} />
                </p>
                <ul className={styles.featureTech}>
                  {item.tech.map((tech) => (
                    <li key={tech}>
                      <TechTag label={tech} />
                    </li>
                  ))}
                </ul>
                <ul className={styles.roles}>
                  {ROLE_ORDER.map((role) => {
                    const isOwned = item.roles.includes(role)

                    return (
                      <li key={role} className={isOwned ? styles.roleOwned : styles.roleOff}>
                        {roleLabels[role]}
                        {/* 塗りと淡さの差は目で見た人にしか伝わらない。担当・担当外は読み上げ用の文字でも添える */}
                        <span className={styles.srOnly}>
                          {isOwned ? ui.career.roleOwned : ui.career.roleNotOwned}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.asides !== undefined ? (
        <section className={styles.block}>
          <h3 className={styles.blockHeading}>
            <PhraseText text={detail.asides.heading} />
          </h3>
          <ul className={styles.asides}>
            {detail.asides.items.map((aside) => (
              <li key={aside.title} className={styles.aside}>
                <h4 className={styles.asideTitle}>
                  <PhraseText text={aside.title} />
                </h4>
                <p className={styles.body}>
                  <PhraseText text={aside.body} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* タブ廃止により、下部固定CTA(Toss式)が作品一覧への唯一の戻り道になった。
          幅を問わず全幅で常時表示 — パネル自体が hidden の間は祖先ごと一緒に隠れる */}
      <button type='button' className={styles.back} onClick={onBackToWorks}>
        <PhraseText text={ui.career.backToWorks} />
      </button>
    </section>
  )
}

export default CareerDetail
