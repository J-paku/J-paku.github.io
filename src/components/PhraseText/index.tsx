// 日本語の文章を文節ごとに <wbr> で区切って描く。
//
// global.css が word-break: keep-all を掛けているため、日本語はここが入れた <wbr> の位置でしか
// 折り返さない。改行位置をブラウザの実装任せにせずこちら側で決め切るので、端末・エンジンが
// 変わっても同じ幅なら同じ位置で改行し、文節の途中で切れることが無くなる。
//
// ja 以外はそのまま返す。韓国語は語の間に空白があり、keep-all だけで語中改行が止まる
import { Fragment } from 'react'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import { segmentJapanese } from '@/utils/ja-phrase'

type PhraseTextProps = {
  text: string
}

function PhraseText({ text }: PhraseTextProps) {
  const { locale } = useLocale()

  if (locale !== 'ja') return <>{text}</>

  return (
    <>
      {segmentJapanese(text).map((chunk, index) => (
        // 同じ文節が複数回現れうるので鍵に位置を含める。並びは入力が同じなら常に同じ
        <Fragment key={`${index}:${chunk}`}>
          {index > 0 ? <wbr /> : null}
          {chunk}
        </Fragment>
      ))}
    </>
  )
}

export default PhraseText
