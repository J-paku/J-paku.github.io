// ページ先頭へ戻る浮きボタン(モバイル専用)。1画面ぶん以上スクロールした時だけ現れる。
// 表示切替は CSS の opacity + visibility が担い、レイアウトは動かさない。
// スクロール監視は passive + requestAnimationFrame で間引く
import { useEffect, useRef, useState } from 'react'
import { useContent } from '@/hooks/use-content'
import styles from './scroll-top-button.module.css'

type ScrollTopButtonProps = {
  // 下部固定CTA(--cta-height)を持つ画面では、その高さぶん持ち上げて重なりを避ける
  raisedForCta?: boolean
}

function ScrollTopButton({ raisedForCta = false }: ScrollTopButtonProps) {
  const { ui } = useContent()
  const [isShown, setIsShown] = useState(false)
  // rAF の多重予約を防ぐフラグ。state にすると毎スクロールで再レンダーしてしまう
  const isTickingRef = useRef(false)

  useEffect(() => {
    const update = () => {
      isTickingRef.current = false
      setIsShown(window.scrollY > window.innerHeight)
    }
    const onScroll = () => {
      if (isTickingRef.current) return
      isTickingRef.current = true
      window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleClick() {
    // 減速モーション環境では滑らかスクロールをやめて即時に戻す(use-reveal と同じ判定パターン)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }

  let className = styles.button
  if (isShown) className += ` ${styles.buttonShown}`
  if (raisedForCta) className += ` ${styles.buttonRaised}`

  return (
    <button type='button' className={className} aria-label={ui.scrollTop} onClick={handleClick}>
      {/* 上向き矢印。装飾なので読み上げから外す */}
      <svg className={styles.icon} viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M12 5l-7 7 1.4 1.4L11 8.8V19h2V8.8l4.6 4.6L19 12z' />
      </svg>
    </button>
  )
}

export default ScrollTopButton
