// content/ui.ts の ui.notFound を描画する。<h1> を持たせることで page-has-heading-one を解消する
import { Link } from 'react-router'
import { useLocale } from '@/hooks/use-locale'
import { useContent } from '@/hooks/use-content'

function NotFound() {
  const { locale } = useLocale()
  const { ui } = useContent()
  const homePath = locale === 'ko' ? '/ko' : '/'

  return (
    <div>
      <h1>{ui.notFound.title}</h1>
      <p>{ui.notFound.body}</p>
      <Link to={homePath}>{ui.notFound.backHome}</Link>
    </div>
  )
}

export default NotFound
