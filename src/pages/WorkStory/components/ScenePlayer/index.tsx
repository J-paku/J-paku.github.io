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
        const isActive = index === activeIndex
        const frameClassName = isActive ? `${styles.frame} ${styles.frameActive}` : styles.frame

        return (
          <div key={scene.id} className={frameClassName}>
            {failedScenes.has(scene.id) ? (
              <span>{placeholder}</span>
            ) : (
              // 活性/非活性の切り替わりでのみ key が変わり img を再マウントする。
              // SVG 内部の CSS アニメーションは img の再生成でしか再始動しないため、
              // 場面が活性化するたびにアニメーションを最初から再生させる
              <img
                key={`${scene.id}-${isActive ? 'on' : 'off'}`}
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
