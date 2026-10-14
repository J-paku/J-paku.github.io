// 交差の観察(IntersectionObserver)を使えるかと、使えないときの倒し方。
// 観察できない環境(古いブラウザ・サーバ)でも、カードを隠したまま・写真を灰色のままにしない。
// 観察を使うフック(use-reveal・use-fully-visible・use-active-scene)が同じ判定を持つので、ここ 1 か所に置いて単体テストで固める

// この実行環境で IntersectionObserver を使えるか
export const canObserveIntersection = (): boolean => typeof IntersectionObserver !== 'undefined'

// 交差を待たずに最初から表示してよいか(use-reveal)。
// モーション抑制の設定では動かさずに出す。観察できない環境では、待っても合図が来ないので出しておく
export const shouldRevealAtOnce = (prefersReducedMotion: boolean, canObserve: boolean): boolean =>
  prefersReducedMotion || !canObserve

// 画面に丸ごと収まっているとみなすか(use-fully-visible)。観察した結果をそのまま使い、
// 観察できない環境では判定できないので表示側(true)へ倒す(false に沈めると「常に灰色」になる)
export const resolveFullyVisible = (canObserve: boolean, observed: boolean): boolean =>
  !canObserve || observed
