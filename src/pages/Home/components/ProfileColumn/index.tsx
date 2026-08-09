// 左列の組み立てのみ行う。文言は全て profile / ui から取得する。
// sticky 配置とスクロール中の追従は自分のCSS(.column)が持つ — 親のgrid側からは触らない
//
// h1 は profile.name。共通ヘッダーを廃した08段階では、この列がページの識別そのものを担う
//
// 直下は .top / .out の2塊だけに保つ。列が justify-content: space-between で
// 上下の端へ振り分けるため、ここに3つ目の直下要素を足すと分配が崩れる
import { useContent } from '@/hooks/use-content'
import { getTechIconPath } from '@/utils/tech-icons'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import PhraseText from '@/components/PhraseText'
import styles from './profile-column.module.css'

// 区切り文字はコンテンツ側に持たせない(型の定義どおり配列で受け取り、ここで繋ぐ)
const SEPARATOR = ' · '

function ProfileColumn() {
  const { profile } = useContent()

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
              <p className={styles.tech}>{career.stack.join(SEPARATOR)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 下塊。space-between のもう一方の端で、ここだけが外部への導線 */}
      <div className={styles.out}>
        <p className={styles.location}>
          <PhraseText text={profile.location} />
        </p>
        <div className={styles.outLinks}>
          {profile.links.github !== undefined ? (
            <a href={profile.links.github} rel="noreferrer" className={styles.outLink}>
              {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
              <svg className={styles.outIcon} viewBox='0 0 24 24' aria-hidden='true'>
                <path d={getTechIconPath('GitHub')} />
              </svg>
              GitHub
            </a>
          ) : null}
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  )
}

export default ProfileColumn
