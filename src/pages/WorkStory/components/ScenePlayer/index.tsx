// 場面ごとの画面キャプチャを絶対配置で重ね、activeIndex の1枚だけを opacity で見せる(クロスフェード)。
// 資産が未納の場面は onError で検知し、以降はプレースホルダ文言へ切り替える(WorkCard shotPlaceholder 踏襲)
import { useState } from 'react'
import type { WorkStoryScene } from '@/types/content'
import styles from './scene-player.module.css'

type ScenePlayerProps = {
  scenes: WorkStoryScene[]
  activeIndex: number
  placeholder: string
}

function ScenePlayer({ scenes, activeIndex, placeholder }: ScenePlayerProps) {
  // 読み込みに失敗した場面の id を集める。一度失敗した画像は再試行させずプレースホルダのまま留める
  const [failedScenes, setFailedScenes] = useState<Set<string>>(new Set())

  return (
    <div className={styles.player}>
      {scenes.map((scene, index) => {
        const frameClassName = index === activeIndex ? `${styles.frame} ${styles.frameActive}` : styles.frame

        return (
          <div key={scene.id} className={frameClassName}>
            {failedScenes.has(scene.id) ? (
              <span>{placeholder}</span>
            ) : (
              <img
                src={scene.image}
                alt=''
                draggable={false}
                onError={() => {
                  setFailedScenes((prev) => new Set(prev).add(scene.id))
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ScenePlayer
