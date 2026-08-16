// 作品カード。10段階で左右交互(ジグザグ)を廃し、左 = 画面キャプチャ / 右 = 情報の固定2列にする。
// 仕様表・技術タグ・リンクは下部の枠線パネルへ集約し、カードの終端を明示する。
// wip は不変ルール5どおりリンクを持たない — links 自体が空なので WorkLinks が何も描かない
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import type { Work } from '@/types/content'
import { useContent } from '@/hooks/use-content'
import { useReveal } from '@/hooks/use-reveal'
import { useFullyVisible } from '@/hooks/use-fully-visible'
import { getTechIconPath } from '@/utils/tech-icons'
import { withLocale } from '@/utils/locale-path'
import WorkSpec from '@/components/WorkSpec'
import WorkStack from '@/components/WorkStack'
import WorkLinks from '@/components/WorkLinks'
import WorkDetail from '@/components/WorkDetail'
import PhraseText from '@/components/PhraseText'
import styles from './work-card.module.css'

type WorkCardProps = {
  work: Work
  // 一覧の配列インデックス(0始まり)。表示は 01 始まりの2桁ゼロ埋めに整える
  index: number
}

function WorkCard({ work, index }: WorkCardProps) {
  const { ui } = useContent()
  const { locale } = useLocale()
  const { ref, isRevealed } = useReveal()
  // 画面に丸ごと収まっている間だけ写真の色を戻す。縁に掛かっている間は灰色のまま
  const { ref: shotRef, isFullyVisible } = useFullyVisible<HTMLDivElement>()

  // リンクの覆い。ポインタ環境ではホバー(と focus-within)で出し、タッチ環境ではタップで開閉する。
  // この state はタップ用 — ホバー表示は CSS 側の @media (hover: hover) が担う
  const hasLinks = work.links.live !== undefined || work.links.repo !== undefined
  const [isLinksOpen, setIsLinksOpen] = useState(false)

  // 折りたたみ式の詳細。work.detail が無いカードはトグル自体を出さない
  const hasDetail = work.detail !== undefined
  const detailId = `${work.slug}-detail`
  const { hash } = useLocation()
  // #slug 付きで到着した時だけ最初から開く。スクロール位置自体は App の useScrollRestoration が
  // 既に保持しているため、ここでは開閉の初期値だけを決める(追加のスクロール操作はしない)
  const [isDetailOpen, setIsDetailOpen] = useState(() => hash === `#${work.slug}`)

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

  // .hasDetail は詳細を持つカードだけに全幅行を足す修飾子。全カード一律に足すと、
  // 詳細を持たないカード(大半)のモバイル1列表示に row-gap 分の空行が余白として残るため分ける
  let cardClassName = isRevealed ? `${styles.card} ${styles.cardRevealed}` : styles.card
  if (hasDetail) cardClassName += ` ${styles.hasDetail}`
  const shotClassName = isFullyVisible ? `${styles.shot} ${styles.shotInView}` : styles.shot

  // 通し番号。接頭辞などの文言は付けない(表示文字列は content/ の外に置かない)
  const serial = String(index + 1).padStart(2, '0')

  return (
    <article id={work.slug} ref={ref} className={cardClassName}>
      {/* 読み順は「見出し → キャプチャ → 事実」。モバイルではこのDOM順がそのまま縦に並ぶ。
          キャプチャを先頭に置くと、何の作品かを判別する前に画面の3割を使う(390px幅で実測233px)。
          並べ替えを CSS の order で行うとタブ順・読み上げ順がDOMのまま残って視覚順とずれるため、
          DOM側をこの順にし、デスクトップの左右2列は grid-template-areas が作る */}
      <div className={styles.intro}>
        {/* NO. 行。番号(赤)と文脈をドットリーダーで結び、行として1本に見せる */}
        <div className={styles.head}>
          <span className={styles.serial}>NO.{serial}</span>
          <span className={styles.leader} aria-hidden="true" />
          <span className={styles.context}>
            <PhraseText text={work.context} />
          </span>
        </div>

        <h3 className={styles.title}>
          {work.story !== undefined ? (
            <Link to={withLocale(`/works/${work.slug}`, locale)} className={styles.titleLink}>
              <PhraseText text={work.title} />
            </Link>
          ) : (
            <PhraseText text={work.title} />
          )}
          {work.status === 'wip' ? <span className={styles.wipBadge}>{ui.work.wipBadge}</span> : null}
        </h3>
        <p className={styles.tagline}>
          <PhraseText text={work.tagline} />
        </p>
      </div>

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
        {hasLinks ? (
          /* 常に描画し、表示は CSS が切り替える(隠れている間も pointer-events: none でクリックを透過)。
             タブ移動でリンクへ入れば focus-within で現れるため、キーボードでも到達できる。
             覆いのどこを押しても閉じる。リンク自身のクリックは遷移した上で覆いも閉じるので分岐不要 */
          <div
            className={isLinksOpen ? `${styles.shotOverlay} ${styles.shotOverlayOpen}` : styles.shotOverlay}
            onClick={() => setIsLinksOpen(false)}
          >
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

      {/* 事実のパネル。仕様表・タグ・リンクを積み、カードの終端を枠で明示する */}
      <div className={styles.panel}>
        <WorkSpec work={work} />
        <WorkStack stack={work.stack} />
        <WorkLinks live={work.links.live} repo={work.links.repo} />
      </div>

      {/* 詳細トグル。全幅バーではなく中央寄せの小さなテキストリンク然としたボタン。
          下線・シェブロンは常時表示し、カードを開く場所としての存在感を持たせる */}
      {hasDetail ? (
        <button
          type='button'
          className={styles.detailToggle}
          aria-expanded={isDetailOpen}
          aria-controls={detailId}
          onClick={() => setIsDetailOpen((open) => !open)}
        >
          <span className={styles.detailToggleLabel}>{isDetailOpen ? ui.work.hideDetail : ui.work.showDetail}</span>
          <svg className={styles.detailChevron} viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M4 6l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        </button>
      ) : null}

      {/* 全幅の詳細行。閉じている間も WorkDetail 自体はマウントしたまま高さアコーディオンで畳む
          (アンマウント/リマウントせず、toggle の度に再フェッチ等が走らない構成にする)。
          内側の detailInner が min-height: 0 / overflow: hidden を持ち、grid-template-rows の
          0fr↔1fr 遷移中も中身を切り詰める。閉じ切った後は inert で操作・読み上げ両方から外す */}
      {hasDetail ? (
        <div className={isDetailOpen ? `${styles.detail} ${styles.detailOpen}` : styles.detail}>
          <div className={styles.detailInner} inert={!isDetailOpen}>
            <WorkDetail work={work} detailId={detailId} />
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default WorkCard
