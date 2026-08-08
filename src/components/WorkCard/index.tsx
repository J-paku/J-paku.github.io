// 作品カード。10段階で左右交互(ジグザグ)を廃し、左 = 画面キャプチャ / 右 = 情報の固定2列にする。
// 仕様表・技術タグ・リンクは下部の枠線パネルへ集約し、カードの終端を明示する。
// wip は不変ルール5どおりリンクを持たない — links 自体が空なので WorkLinks が何も描かない
import { useEffect, useState } from 'react'
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useReveal } from '@/hooks/use-reveal'
import { useFullyVisible } from '@/hooks/use-fully-visible'
import { getTechIconPath } from '@/utils/tech-icons'
import WorkSpec from '@/components/WorkSpec'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  // 一覧の配列インデックス(0始まり)。表示は 01 始まりの2桁ゼロ埋めに整える
  index: number
}

function WorkCard({ work, index }: WorkCardProps) {
  const { ui } = useContent()
  const { ref, isRevealed } = useReveal()
  // 画面に丸ごと収まっている間だけ写真の色を戻す。縁に掛かっている間は灰色のまま
  const { ref: shotRef, isFullyVisible } = useFullyVisible<HTMLDivElement>()

  // サムネイルのクリックでリンクの覆いを開く(ホバーではなくクリック)。リンクが無い作品では付けない
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined
  const [isLinksOpen, setIsLinksOpen] = useState(false)

  // Esc と「キャプチャ枠の外側クリック」で閉じる。開いている間だけ購読する。
  // 外側判定は shotRef(枠そのもの)基準 — 枠内のトリガー・リンクは各自の onClick が処理する
  useEffect(() => {
    if (!isLinksOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLinksOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const shot = shotRef.current
      if (shot !== null && event.target instanceof Node && !shot.contains(event.target)) {
        setIsLinksOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isLinksOpen, shotRef])

  const cardClassName = isRevealed ? `${styles.card} ${styles.cardRevealed}` : styles.card
  const shotClassName = isFullyVisible ? `${styles.shot} ${styles.shotInView}` : styles.shot

  // 通し番号。接頭辞などの文言は付けない(表示文字列は content/ の外に置かない)
  const serial = String(index + 1).padStart(2, '0')

  return (
    <article ref={ref} className={cardClassName}>
      {/* グリフは背景装飾。要素として置くと支援技術から隠しても色コントラスト検査に掛かるため、
          data 属性で渡して CSS の疑似要素として描く */}
      <div ref={shotRef} className={shotClassName} data-glyph={work.glyph}>
        {work.thumbnail !== undefined ? (
          <img src={work.thumbnail} alt="" className={styles.thumbnail} />
        ) : (
          <span className={styles.shotPlaceholder}>{ui.work.shotPlaceholder}</span>
        )}
        {hasLinks ? (
          <button
            type="button"
            className={styles.shotTrigger}
            aria-expanded={isLinksOpen}
            onClick={() => setIsLinksOpen((open) => !open)}
          >
            <span className={styles.srOnly}>{ui.work.openLinks}</span>
          </button>
        ) : null}
        {isLinksOpen ? (
          /* 覆いのどこを押しても閉じる。リンク自身のクリックは遷移した上で覆いも閉じるので分岐不要 */
          <div className={styles.shotOverlay} onClick={() => setIsLinksOpen(false)}>
            {work.links.live !== undefined ? (
              <a href={work.links.live} rel="noreferrer" className={styles.overlayPrimary}>
                {ui.work.live}
              </a>
            ) : null}
            {work.links.repo !== undefined ? (
              <a href={work.links.repo} rel="noreferrer" className={styles.overlaySecondary}>
                {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
                <svg className={styles.overlayIcon} viewBox='0 0 24 24' aria-hidden='true'>
                  <path d={getTechIconPath(ui.work.repo)} />
                </svg>
                {ui.work.repo}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.meta}>
        {/* NO. 行。番号(赤)と文脈をドットリーダーで結び、行として1本に見せる */}
        <div className={styles.head}>
          <span className={styles.serial}>NO.{serial}</span>
          <span className={styles.leader} aria-hidden="true" />
          <span className={styles.context}>{work.context}</span>
        </div>

        <h3 className={styles.title}>
          {work.title}
          {work.status === 'wip' ? (
            <span className={styles.wipBadge}>{ui.work.wipBadge}</span>
          ) : null}
        </h3>
        <p className={styles.tagline}>{work.tagline}</p>

        {/* 下部パネル。仕様表 → タグ → リンクの順に積み、カードの終端を枠で明示する */}
        <div className={styles.panel}>
          <WorkSpec work={work} />
          <WorkStack stack={work.stack} />
          <WorkLinks live={work.links.live} repo={work.links.repo} />
        </div>
      </div>
    </article>
  )
}

export default WorkCard
