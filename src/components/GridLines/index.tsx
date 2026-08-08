// 背景に敷く縦罫線。モックアップの .grid-lines をそのまま持ち込む。
// 情報を持たない純粋な装飾なので aria-hidden で支援技術からは隠し、
// クリック透過(pointer-events)と重なり順(z-index)は自分のCSSが持つ
import styles from './grid-lines.module.css'

// モックアップと同じ本数。並びが変わらない静的な装飾のため key は添字で足りる
const LINE_COUNT = 5
const LINES = Array.from({ length: LINE_COUNT }, (_, index) => index)

function GridLines() {
  return (
    <div className={styles.lines} aria-hidden='true'>
      {LINES.map((index) => (
        <div key={index} className={styles.line} />
      ))}
    </div>
  )
}

export default GridLines
