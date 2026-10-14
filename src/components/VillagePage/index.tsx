// 村ページのサーバローダー。内容とシートを組み、初回描画用の style・script を作る。
// マークアップはコンテナが並べ、サーバ専用の 2 要素も元と同じ位置へ差し込む。
import type { Locale } from '@content/types/content'
import { readContent, readVillageText, readWorldSet, listStorySlugs } from '@/lib/content/read'
import VillagePageContainer from './container'
// 子の CSS より先に scene を出さないよう、コンテナの後に読む。
import sceneStyles from './components/Village/scene.module.css'
import { PHASE_INIT } from './utils/phase-init'
import { spriteBackgroundCss } from './utils/sprite-css'
import { villageProps } from './utils/village-props'

type VillagePageProps = { locale: Locale }

function VillagePage({ locale }: VillagePageProps) {
  const props = villageProps(
    locale,
    readContent(locale),
    readVillageText(locale),
    readWorldSet(),
    listStorySlugs(locale)
  )

  return (
    <VillagePageContainer
      {...props}
      spriteStyle={<style>{spriteBackgroundCss(sceneStyles)}</style>}
      // Village の直後で初回ペイント前に data-phase を実際の段階へ直す。
      phaseInit={<script dangerouslySetInnerHTML={{ __html: PHASE_INIT }} />}
    />
  )
}

export default VillagePage
