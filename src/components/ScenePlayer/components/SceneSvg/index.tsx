// 場面SVGをシャドウルートの中へ直接展開する。
//
// <img> 経由で読んだSVGは独立した文書になり、外側のCSSからもJSからも中のアニメーションへ触れない。
// 一時停止を押しても絵だけ動き続けていたのはこれが原因で、止めるにはこちらの文書へ取り込むしかない。
//
// ただし素のDOMへ展開すると4場面ぶんのSVGが同時に置かれ、互いのクラス名(.anim など。場面ごとに
// animation-duration が違う)と id(#hex・#dummyCard など)を奪い合う。シャドウルートなら
// スタイルも id 参照も各場面の中に閉じるので、この構成では必須。
import { useEffect, useRef, useState } from 'react'
import { fetchSvgSource } from '@/lib/fetch-svg-source'

type SceneSvgProps = {
  src: string
  className: string
  // 値が変わるたびにSVGを組み直し、中のアニメーションを頭から再生させる
  restartKey: string
  paused: boolean
  onError: () => void
}

// シャドウルート側の下地。SVG自身の見た目は取り込んだ markup が持つ。
// animation-play-state は継承しないので、止める時は中の全要素に掛ける
const SHADOW_STYLE = `
:host { display: block; }
svg { display: block; width: 100%; height: 100%; }
:host([data-paused]) * { animation-play-state: paused; }
`

function SceneSvg({ src, className, restartKey, paused, onError }: SceneSvgProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<ShadowRoot | null>(null)
  const [source, setSource] = useState<string | null>(null)

  // onError をそのまま effect の依存に置くと、呼び出し側が再レンダーするたび取得し直してしまう
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false
    fetchSvgSource(src)
      .then((text) => {
        if (!cancelled) setSource(text)
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current()
      })
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const host = hostRef.current
    if (host === null || source === null) return
    // attachShadow は1要素につき1回だけ。2回目は例外になる
    if (shadowRef.current === null) shadowRef.current = host.attachShadow({ mode: 'open' })
    shadowRef.current.innerHTML = `<style>${SHADOW_STYLE}</style>${source}`
  }, [source, restartKey])

  // 装飾なので読み上げ対象から外す(<img alt=''> だった頃と同じ扱い)
  return <div ref={hostRef} className={className} aria-hidden='true' data-paused={paused ? '' : undefined} />
}

export default SceneSvg
