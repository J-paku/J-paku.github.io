// 言語ルート内の notFound() 用。直リンクの 404 は public/404.html が担う
import { readContent } from '@/lib/content/read'
import { toHref } from '@/utils/locale-path'

export default function NotFound() {
  const { ui } = readContent('ja')
  return (
    <main id='main'>
      <h1>{ui.notFound.title}</h1>
      <p>{ui.notFound.body}</p>
      <a href={toHref('/list', 'ja')}>{ui.notFound.backHome}</a>
    </main>
  )
}
