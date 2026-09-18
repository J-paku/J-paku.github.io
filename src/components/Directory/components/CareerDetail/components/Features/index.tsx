// 機能一覧の節を描く。機能ごとに日付・名前・技術タグ・工程バッジを並べる
import type {
  CareerDetail as CareerDetailContent,
  CareerRole,
  Locale,
  UiStrings,
} from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import TechTag from '@/components/ui/TechTag'
import styles from '../../career-detail.module.css'

type FeaturesProps = {
  // 描く機能一覧。持たない経歴は親が描かない
  features: NonNullable<CareerDetailContent['features']>
  ui: UiStrings
  locale: Locale
}

// 工程バッジは常に3つ並べ、roles に含まれるものだけを担当として塗る。
// 並びは設計 → 実装 → リリースで固定する
const ROLE_ORDER: CareerRole[] = ['design', 'build', 'release']

function Features({ features, ui, locale }: FeaturesProps) {
  const roleLabels: Record<CareerRole, string> = {
    design: ui.career.roleDesign,
    build: ui.career.roleBuild,
    release: ui.career.roleRelease,
  }

  return (
    <section className={styles.block}>
      <h3 className={styles.blockHeading}>
        <PhraseText text={features.heading} locale={locale} />
      </h3>
      {features.lead !== undefined ? (
        <p className={styles.lead}>
          <PhraseText text={features.lead} locale={locale} />
        </p>
      ) : null}
      <ul className={styles.features}>
        {features.items.map(item => (
          <li key={`${item.date}:${item.name}`} className={styles.feature}>
            <p className={styles.featureDate}>{item.date}</p>
            <p className={styles.featureName}>
              <PhraseText text={item.name} locale={locale} />
            </p>
            <ul className={styles.featureTech}>
              {item.tech.map(tech => (
                <li key={tech}>
                  <TechTag label={tech} />
                </li>
              ))}
            </ul>
            <ul className={styles.roles}>
              {ROLE_ORDER.map(role => {
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
  )
}

export default Features
