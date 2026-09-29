// 日本語の一覧ページ。メタデータも表示文字列も content から組み立てる
import { createListMetadata } from '@/app/locale-routes'
import Directory from '@/components/Directory'

export const metadata = createListMetadata('ja')

export default function Page() {
  return <Directory locale='ja' />
}
