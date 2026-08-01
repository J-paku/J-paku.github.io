// dist/quality.json はビルド後にCIが計測して書き込む生成物。ローカル開発には存在しないため、
// 取得に失敗した場合(ローカル・計測前・quality.jsonが無い等)は何も描画しない。
// 「計測中」「—」のような空欄は作らない(仕様: 05-pipeline.md)
import { useEffect, useState } from 'react'
import { useContent } from '@/hooks/use-content'
import { useLocale } from '@/hooks/use-locale'
import styles from './quality-badge.module.css'

type QualityData = {
  measuredAt: string
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
  axeViolations: number
  runUrl: string
}

// fetch自体が成功してもJSONの形が期待と違えば描画しないための実行時検査。
// unknown はこの型ガードの引数としてのみ使う
function isQualityData(value: unknown): value is QualityData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return (
    typeof data.measuredAt === 'string' &&
    typeof data.performance === 'number' &&
    typeof data.accessibility === 'number' &&
    typeof data.bestPractices === 'number' &&
    typeof data.seo === 'number' &&
    typeof data.axeViolations === 'number' &&
    typeof data.runUrl === 'string'
  )
}

function QualityBadge() {
  const { ui } = useContent()
  const { locale } = useLocale()
  const [quality, setQuality] = useState<QualityData | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const response = await fetch('/quality.json')
      if (!response.ok) return
      const data: unknown = await response.json()
      if (!cancelled && isQualityData(data)) {
        setQuality(data)
      }
    }

    // ネットワークエラー・JSON構文エラーも「計測結果が無い」として扱い、何も描画しない
    load().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (quality === null) return null

  const measuredAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(quality.measuredAt))

  return (
    <div className={styles.badge}>
      <span className={styles.title}>{ui.quality.title}</span>
      <dl className={styles.metrics}>
        {/* Performance・Accessibility は Lighthouse 自体のカテゴリ名(固有名詞)。
            ui.quality には個別ラベルが無いため、axe と同様に翻訳しない表記として扱う */}
        <div className={styles.metric}>
          <dt>Performance</dt>
          <dd className={styles.value}>{quality.performance}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Accessibility</dt>
          <dd className={styles.value}>{quality.accessibility}</dd>
        </div>
        <div className={styles.metric}>
          <dt>axe {ui.quality.violations}</dt>
          <dd className={styles.value}>{quality.axeViolations}</dd>
        </div>
      </dl>
      <span className={styles.measuredAt}>
        {ui.quality.measuredAt} {measuredAt}
      </span>
      <a className={styles.link} href={quality.runUrl} target="_blank" rel="noreferrer">
        {ui.quality.viewRun}
      </a>
    </div>
  )
}

export default QualityBadge
