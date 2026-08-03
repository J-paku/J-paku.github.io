// 左列の組み立てのみ行う。文言は全て profile / ui から取得する。
// sticky 配置とスクロール中の追従は自分のCSS(.column)が持つ — 親のgrid側からは触らない
//
// h1 は profile.name。共通ヘッダーを廃した08段階では、この列がページの識別そのものを担う
import { useContent } from '@/hooks/use-content'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import styles from './profile-column.module.css'

// 区切り文字はコンテンツ側に持たせない(型の定義どおり配列で受け取り、ここで繋ぐ)
const SEPARATOR = ' · '

function ProfileColumn() {
  const { profile } = useContent()

  return (
    <div className={styles.column}>
      <h1 className={styles.name}>{profile.name}</h1>
      <p className={styles.role}>{profile.role}</p>
      <p className={styles.scope}>{profile.scope.join(SEPARATOR)}</p>
      <p className={styles.claim}>{profile.headline}</p>

      <ul className={styles.cv}>
        {profile.careers.map((career) => (
          <li key={career.period} className={styles.cvItem}>
            <p className={styles.when}>{career.period}</p>
            <p className={styles.org}>{career.company}</p>
            <p className={styles.post}>{career.role}</p>
            <p className={styles.tech}>{career.stack.join(SEPARATOR)}</p>
          </li>
        ))}
      </ul>

      {/* margin-top: auto で列の底に落とす。ここだけが外部への導線 */}
      <div className={styles.out}>
        <p className={styles.location}>{profile.location}</p>
        <div className={styles.outLinks}>
          {profile.links.github !== undefined ? (
            <a href={profile.links.github} rel="noreferrer" className={styles.outLink}>
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
