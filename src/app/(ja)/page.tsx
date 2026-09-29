// 日本語の村ページ。メタデータも表示文字列も content から組み立てる
import { createVillageMetadata } from '@/app/locale-routes'
import VillagePage from '@/components/VillagePage'

export const metadata = createVillageMetadata('ja')

export default function Page() {
  return <VillagePage locale='ja' />
}
