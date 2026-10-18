'use client'

// 場面再生のコンテナ。作品一覧(WorkCard のリール)と作品ストーリー(イントロのプレビュー・場面モーダル)の
// 両方から使う入口で、呼び出し側はこのファイルを直接 import する。
// 場面SVGの原文を取る(ネットワーク)のは隣の hooks/use-scene-sources.ts で、取れた原文と取れなかった場面を
// 表示の SceneStack(./components/SceneStack/index.tsx)へ渡す。表示の部品は取得を持たない(I/O はコンテナとその hooks だけが触る)
import type { ComponentProps } from 'react'
import SceneStack from './components/SceneStack'
import { useSceneSources } from './hooks/use-scene-sources'

// 呼び出し側が渡す props。表示の props から、ここで取って渡す2つを除いたもの
type ScenePlayerContainerProps = Omit<ComponentProps<typeof SceneStack>, 'sources' | 'failedScenes'>

function ScenePlayerContainer({
  scenes,
  activeIndex,
  placeholder,
  paused,
}: ScenePlayerContainerProps) {
  const { sources, failedScenes } = useSceneSources(scenes)

  return (
    <SceneStack
      scenes={scenes}
      activeIndex={activeIndex}
      placeholder={placeholder}
      paused={paused}
      sources={sources}
      failedScenes={failedScenes}
    />
  )
}

export default ScenePlayerContainer
