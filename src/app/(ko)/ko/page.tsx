// 韓国語の村ページ。メタデータも表示文字列も content から組み立てる
import { createVillageMetadata } from '@/app/locale-routes'
import VillagePage from '@/app/village-screen'

export const metadata = createVillageMetadata('ko')

export default function Page() {
  return <VillagePage locale='ko' />
}
