'use client'

// 場面ごとの画面キャプチャを絶対配置で重ね、activeIndex の1枚だけを opacity で見せる(クロスフェード)。
// 原文の取得はコンテナ(../../index.tsx)が持ち、ここは取れた原文を描き、取得に失敗した場面はプレースホルダ文言で描く
// (WorkCard shotPlaceholder 踏襲)
import type { WorkStoryScene } from '@content/types/content'
import SceneSvg from '../SceneSvg'
import styles from './scene-stack.module.css'

type SceneStackProps = {
  scenes: WorkStoryScene[]
  activeIndex: number
  placeholder: string
  // 呼び出し側が一時停止を持つ場合だけ渡す。SVG内部のアニメーションを今の絵のまま止める
  paused?: boolean
  // 取れた場面SVGの原文(場面の id → 原文)。届く前の場面は持たない
  sources: ReadonlyMap<string, string>
  // 読み込みに失敗した場面の id。この場面はプレースホルダのまま留める
  failedScenes: ReadonlySet<string>
}

function SceneStack({
  scenes,
  activeIndex,
  placeholder,
  paused = false,
  sources,
  failedScenes,
}: SceneStackProps) {
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
                source={sources.get(scene.id) ?? null}
                className={styles.sceneSvg}
                restartKey={isActive ? 'on' : 'off'}
                paused={paused}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SceneStack
