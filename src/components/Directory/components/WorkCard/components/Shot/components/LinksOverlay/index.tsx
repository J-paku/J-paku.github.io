// 作品カードのリンクの覆い。タップ用のトリガーと、覆い本体(タッチ用モーション操作・live/repo・ストーリー)を描く
// 包む要素を持たない — 枠内の兄弟の DOM 順が重なり順を決めるため、Fragment で親の枠へ直接並べる
import Link from 'next/link'
import type { Dispatch, MouseEvent, SetStateAction } from 'react'
import type { Locale, UiStrings, Work } from '@content/types/content'
import { getTechIconPath } from '@/utils/tech-icons'
import { toHref } from '@/utils/locale-path'
import PlaybackIcon from '@/components/ui/PlaybackIcon'

// 親の shot.module.css のクラス表。CSS の読み込み順を変えないよう、この部品は CSS を直接 import しない
type ShotStyles = { readonly [key: string]: string }

type LinksOverlayProps = {
  work: Work
  locale: Locale
  ui: UiStrings
  styles: ShotStyles
  hasLinks: boolean
  hasStoryOverlay: boolean
  hasOverlay: boolean
  hasMotion: boolean
  isFinePointer: boolean
  isMotionPaused: boolean
  handleToggleMotion: () => void
  isLinksOpen: boolean
  setIsLinksOpen: Dispatch<SetStateAction<boolean>>
}

function LinksOverlay(props: LinksOverlayProps) {
  const { work, locale, ui, styles, hasLinks, hasStoryOverlay, hasOverlay } = props
  const { hasMotion, isFinePointer, isMotionPaused, handleToggleMotion } = props
  const { isLinksOpen, setIsLinksOpen } = props

  return (
    <>
      {hasOverlay && !(hasMotion && isFinePointer) ? (
        <button
          type='button'
          className={styles.shotTrigger}
          aria-expanded={isLinksOpen}
          onClick={() => setIsLinksOpen(open => !open)}
        >
          <span className='sr-only'>{hasLinks ? ui.work.openLinks : ui.work.openStory}</span>
        </button>
      ) : null}
      {hasOverlay ? (
        /* 常に描画し、表示は CSS が切り替える(隠れている間も pointer-events: none でクリックを透過)。
           タブ移動でリンクへ入れば focus-within で現れるため、キーボードでも到達できる。
           覆いのどこを押しても閉じる。リンク自身のクリックは遷移した上で覆いも閉じるので分岐不要。
           このdivの onClick はポインタ・タッチ専用の便宜(空白部分タップでの寄せ閉じ)であり、
           同じ機能(setIsLinksOpen(false))は shotTrigger の再押下(aria-expanded トグル)と
           上のEscapeハンドラで既にキーボードから到達できる — WCAG 2.1.1 は満たしている。
           ここに role='button'+tabIndex を足さないのは意図的: 中に実体の <a>/<Link> を
           抱えているため、外側まで操作可能ロールにすると axe の nested-interactive
           (WCAG 4.1.2・配信ゲート対象)に抵触する */
        <div
          className={
            isLinksOpen ? `${styles.shotOverlay} ${styles.shotOverlayOpen}` : styles.shotOverlay
          }
          onClick={() => setIsLinksOpen(false)}
        >
          {hasMotion && !isFinePointer ? (
            /* 動画・リールの一時停止/再開ボタン(WCAG 2.2.2)。タッチ環境の操作口はこれ1つ
               (デスクトップは全面トグルが既に同じ役割を持つため、同名ボタンの重複を避けて
               ここでは出さない)。覆いの onClick(背景タップ=閉じる)へ伝播すると
               覆いごと閉じてしまうため stopPropagation で止める */
            <button
              type='button'
              className={styles.videoToggle}
              aria-label={isMotionPaused ? ui.work.resumeMotion : ui.work.pauseMotion}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                handleToggleMotion()
              }}
            >
              {isMotionPaused ? (
                <PlaybackIcon kind='play' className={styles.videoToggleIcon} />
              ) : (
                <PlaybackIcon kind='pause' className={styles.videoToggleIcon} />
              )}
            </button>
          ) : null}
          {work.links.live !== undefined ? (
            <a href={work.links.live} rel='noreferrer' className={styles.overlayPrimary}>
              {ui.work.live}
            </a>
          ) : null}
          {work.links.repo !== undefined ? (
            <a href={work.links.repo} rel='noreferrer' className={styles.overlaySecondary}>
              {/* ラベルが GitHub なのでブランドロゴを添える。装飾なので aria-hidden */}
              <svg className={styles.overlayIcon} viewBox='0 0 24 24' aria-hidden='true'>
                <path d={getTechIconPath(ui.work.repo)} />
              </svg>
              {ui.work.repo}
            </a>
          ) : null}
          {hasStoryOverlay ? (
            /* 外部リンクを持たない作品はストーリーページが唯一の行き先。主ボタンの見た目で1つだけ置く */
            <Link href={toHref(`/works/${work.slug}`, locale)} className={styles.overlayPrimary}>
              {ui.work.story}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export default LinksOverlay
