// 右列(作品一覧 ⇄ 担当業務の詳細)の差し替え状態を持つ。
// 左列のトリガーと右列のタブの両方が同じ状態を触るため、Home で1つだけ立てて配る。
// URL は変えない — 状態はこのフックの中に閉じる(不変ルール1: locale は pathname だけで決まる)
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Career } from '@/types/content'

// 1列に畳まれる幅。home.module.css の分岐と同じ値をここにも置く(CSSの分岐はJSから読めない)
const NARROW_QUERY = '(max-width: 1024px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// matchMedia を持たない環境(テスト・SSR)では「広い画面・モーション許可」として扱い、落とさない
function matchesMedia(query: string) {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useCareerPanel(careers: Career[]) {
  const [activeCareerId, setActiveCareerId] = useState<string | null>(null)
  // 詳細パネル(tabIndex=-1)。開いた直後の焦点移動とスクロールの対象
  const panelRef = useRef<HTMLElement>(null)
  // 開くきっかけになった左列のボタン。作品一覧へ戻すときにここへ焦点を返す
  const triggerRef = useRef<HTMLElement | null>(null)
  // 焦点をパネルへ移す要求。タブ操作では焦点をタブに残すため、要求が立った時だけ動かす
  const focusRequestRef = useRef(false)
  // 作品一覧へ戻す要求。パネルが消えて作品一覧に差し替わった後の描画で焦点とスクロールを行う
  const returnRequestRef = useRef(false)

  // detail を持たない経歴は開かない。トリガーも出さないので、ここが対象の全部になる
  const detailCareers = careers.filter((career) => career.detail !== undefined)
  const activeCareer = detailCareers.find((career) => career.id === activeCareerId) ?? null
  // 閉じている間もパネル自体は描き続ける(タブ・トリガーの aria-controls が指す先を絶やさないため)。
  // 何も選ばれていない間の中身は先頭の経歴 — タブから開いたときに出るものと同じにする
  const panelCareer = activeCareer ?? detailCareers[0] ?? null

  const showWorks = useCallback(() => {
    // ここで即座に焦点・スクロールを行うと、右列がまだパネル表示のままの古いレイアウトを対象にしてしまう
    // (パネルが消えて作品一覧に差し替わるのは次の描画)。トリガーは ref に残したまま要求だけ立て、
    // 実際に作品一覧へ差し替わった後の副作用(下の useEffect)で焦点とスクロールを行う
    focusRequestRef.current = false
    returnRequestRef.current = true
    setActiveCareerId(null)
  }, [])

  // 左列のトリガーから呼ばれる。同じ経歴をもう一度押したら作品一覧へ戻す(トグル)
  const openCareer = useCallback(
    (id: string, trigger?: HTMLElement | null) => {
      const target = careers.find((career) => career.id === id)
      if (target?.detail === undefined) return

      if (activeCareerId === id) {
        showWorks()
        return
      }

      // 呼び出し側が要素を渡さなかった場合の保険。押されたボタンは焦点を持っているのが普通で、
      // 持っていない環境(Safari のボタン)でも body が入るだけで害は無い
      const focused = document.activeElement
      triggerRef.current = trigger ?? (focused instanceof HTMLElement ? focused : null)
      focusRequestRef.current = true
      setActiveCareerId(id)
    },
    [activeCareerId, careers, showWorks],
  )

  // 右列のタブ「担当業務」から呼ばれる。何も選ばれていなければ先頭の経歴を開く。
  // 焦点はタブに残す(APG の自動アクティベーション)ので、パネルへは移さない
  const showDetail = useCallback(() => {
    if (panelCareer === null) return
    triggerRef.current = null
    focusRequestRef.current = false
    setActiveCareerId(panelCareer.id)
  }, [panelCareer])

  useEffect(() => {
    if (activeCareerId === null) return
    if (!focusRequestRef.current) return
    focusRequestRef.current = false

    const panel = panelRef.current
    if (panel === null) return

    // スクロールはこちらで決める
    panel.focus({ preventScroll: true })
    const behavior: ScrollBehavior = matchesMedia(REDUCED_MOTION_QUERY) ? 'auto' : 'smooth'

    if (matchesMedia(NARROW_QUERY)) {
      // 1列の幅ではパネルが左列の下に積まれるので、パネル先頭へ送る
      if (typeof panel.scrollIntoView !== 'function') return
      panel.scrollIntoView({ block: 'start', behavior })
      return
    }

    // 広い幅でもパネル上端が見えていなければページ先頭へ戻す — 作品一覧を下まで
    // 送った状態から開くと、パネルの頭ではなく途中が出たままになるため。
    // 上端が見えている(=右列が既に見えている)ときは従来どおり動かさない
    if (panel.getBoundingClientRect().top >= 0) return
    window.scrollTo({ top: 0, behavior })
  }, [activeCareerId])

  // 作品一覧へ戻る側。パネルが消えて作品一覧に差し替わった描画(activeCareerId が null になった後)で発火する
  useEffect(() => {
    if (activeCareerId !== null) return
    if (!returnRequestRef.current) return
    returnRequestRef.current = false

    const trigger = triggerRef.current
    triggerRef.current = null
    if (trigger === null) return

    // スクロールはこちらで決める
    trigger.focus({ preventScroll: true })
    const behavior: ScrollBehavior = matchesMedia(REDUCED_MOTION_QUERY) ? 'auto' : 'smooth'

    if (matchesMedia(NARROW_QUERY)) {
      // 1列の幅ではパネルが左列の下に積まれているので、トリガーを画面上端へ送る
      if (typeof trigger.scrollIntoView !== 'function') return
      trigger.scrollIntoView({ block: 'start', behavior })
      return
    }

    // 広い幅では左列が sticky で常に画面内に固定されており、トリガー基準のスクロールは意味を持たない
    // (scrollIntoView が no-op になる)。作品一覧を頭から見せるため、ページ先頭へ戻す
    window.scrollTo({ top: 0, behavior })
  }, [activeCareerId])

  return { activeCareerId, activeCareer, panelCareer, openCareer, showDetail, showWorks, panelRef }
}
