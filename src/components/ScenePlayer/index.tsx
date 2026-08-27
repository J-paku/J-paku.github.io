// 場面ごとの画面キャプチャを絶対配置で重ね、activeIndex の1枚だけを opacity で見せる(クロスフェード)。
// 資産が未納の場面は取得失敗で検知し、以降はプレースホルダ文言へ切り替える(WorkCard shotPlaceholder 踏襲)
import { useState } from 'react'
import type { WorkStoryScene } from '@/types/content'
import SceneSvg from './components/SceneSvg'
import styles from './scene-player.module.css'

type ScenePlayerProps = {
  scenes: WorkStoryScene[]
  activeIndex: number
  placeholder: string
  // 呼び出し側が一時停止を持つ場合だけ渡す。SVG内部のアニメーションを今の絵のまま止める
  paused?: boolean
}

function ScenePlayer({ scenes, activeIndex, placeholder, paused = false }: ScenePlayerProps) {
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
              // 活性/非活性が切り替わった時だけ restartKey が変わる。SVG内部のCSSアニメーションは
              // 組み直しでしか再始動しないため、場面が活性化するたび頭から再生させる
              <SceneSvg
                src={scene.image}
                className={styles.sceneSvg}
                restartKey={isActive ? 'on' : 'off'}
                paused={paused}
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
