// content/ui.ts の ui.notFound を描画する。<h1> を持たせることで page-has-heading-one を解消する
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'
import { withLocale } from '@/utils/locale-path'
import PhraseText from '@/components/PhraseText'

function NotFound() {
  const { locale } = useLocale()
  const { ui } = useContent()
  const homePath = withLocale('/', locale)

  return (
    <div>
      <h1>
        <PhraseText text={ui.notFound.title} />
      </h1>
      <p>
        <PhraseText text={ui.notFound.body} />
      </p>
      <Link to={homePath}>
        <PhraseText text={ui.notFound.backHome} />
      </Link>
    </div>
  )
}

export default NotFound
