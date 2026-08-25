// 左列の組み立てのみ行う。文言は全て profile / ui から取得する。
// sticky 配置とスクロール中の追従は自分のCSS(.column)が持つ — 親のgrid側からは触らない
//
// h1 は profile.name。共通ヘッダーを廃した08段階では、この列がページの識別そのものを担う
//
// 直下は .top / .out の2塊だけに保つ。列は「上=識別と経歴 / 下=連絡先」の2段の枠で、
// 溢れを引き受けるのは .top の中の経歴リストだけ。ここに3つ目の直下要素を足すと
// その帯の高さ計算(.top が flex: 1 で余りを取る)が崩れる
// (11段階の詳細トリガーも各経歴の <li> の中へ入れ、直下要素は増やさない)
import { useContent } from '@/hooks/use-content'
import { getTechIconPath } from '@/utils/tech-icons'
import PhraseText from '@/components/PhraseText'
import styles from './profile-column.module.css'

// 区切り文字はコンテンツ側に持たせない(型の定義どおり配列で受け取り、ここで繋ぐ)
const SEPARATOR = ' · '

type ProfileColumnProps = {
  // 右列に出ている経歴の id。null なら右列は作品一覧
  activeCareerId: string | null
  // トリガー押下の通知。押された button 自身も渡す(閉じたときのフォーカス復帰に使うため)
  onSelectCareer: (id: string, trigger: HTMLButtonElement) => void
}

function ProfileColumn({ activeCareerId, onSelectCareer }: ProfileColumnProps) {
  const { profile, ui } = useContent()

  return (
    <div className={styles.column}>
      {/* 上塊。列は justify-content: space-between なので、名前から経歴までを1つに束ねる */}
      <div className={styles.top}>
        {/* キッカー(10段階)。固有名詞・ラテンのみなので content には持たせない(不変ルール2の対象外) */}
        <p className={styles.kicker}>PORTFOLIO — 2026</p>
        <h1 className={styles.name}>{profile.name}</h1>
        <p className={styles.role}>
          <PhraseText text={profile.role} />
        </p>
        <p className={styles.scope}>
          <PhraseText text={profile.scope.join(SEPARATOR)} />
        </p>
        <p className={styles.claim}>
          <PhraseText text={profile.headline} />
        </p>

        <ul className={styles.cv}>
          {profile.careers.map((career) => (
            <li key={career.period} className={styles.cvItem}>
              <p className={styles.when}>{career.period}</p>
              <p className={styles.org}>
                <PhraseText text={career.company} />
              </p>
              <p className={styles.post}>
                <PhraseText text={career.role} />
              </p>
              {/* 在籍1社の中の派遣先。期間と配属先を経歴ブロック内に小さく積む(在籍1社であることを列の見た目でも示す) */}
              {career.assignments !== undefined ? (
                <ul className={styles.assignments}>
                  {career.assignments.map((assignment) => (
                    <li key={assignment.period} className={styles.assignment}>
                      <span className={styles.assignmentWhen}>{assignment.period}</span>
                      <PhraseText text={assignment.label} />
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={styles.tech}>{career.stack.join(SEPARATOR)}</p>
              {/* 詳細を持つ経歴だけがトリガーを出す。押すと右列(panel-career)が差し替わる */}
              {career.detail !== undefined ? (
                <button
                  type='button'
                  className={styles.detailTrigger}
                  aria-controls='panel-career'
                  aria-current={activeCareerId === career.id ? 'true' : undefined}
                  onClick={(event) => onSelectCareer(career.id, event.currentTarget)}
                >
                  {/* ボタンが3つ並ぶため、どの経歴のものかを読み上げ名だけに社名で足す。
                      表示文字列の合成はしない(社名も文言も content から来たものをそのまま置く) */}
                  <span className={styles.srOnly}>{career.company}</span>
                  <span className={styles.detailLabel}>{ui.career.openDetail}</span>
                  {/* 矢印は「押せる物」の符号として足した装飾のみ。読み上げ対象から外す */}
                  <span className={styles.detailArrow} aria-hidden='true'>
                    ›
                  </span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* 下塊。列の底に置く外部への導線。一段浮いた面に載せて、連絡先だけを物として立ち上げる。
          ラベル語は置かない — 所在地・メール・GitHub は形を見れば何かが分かる */}
      <div className={styles.out}>
        <div className={styles.card}>
          <p className={styles.location}>
            <PhraseText text={profile.location} />
          </p>

          {profile.links.email !== undefined ? (
            /* mailto: のスキームはここで付ける。content が持つのは素のアドレスだけ */
            <a href={`mailto:${profile.links.email}`} className={`${styles.outLink} ${styles.mail}`}>
              {profile.links.email}
            </a>
          ) : null}

          {profile.links.github !== undefined ? (
            <a href={profile.links.github} rel="noreferrer" className={styles.outLink}>
              {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
              <svg className={styles.outIcon} viewBox='0 0 24 24' aria-hidden='true'>
                <path d={getTechIconPath('GitHub')} />
              </svg>
              GitHub
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ProfileColumn
