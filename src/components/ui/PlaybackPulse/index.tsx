// 再生・一時停止の合図。押した直後に一度だけ出るパルスと、停止中ずっと出し続ける印の2つで1組。
// 場面モーダル(Story/SceneModal)と作品カードのキャプチャ枠(Directory/WorkCard/Shot)が
// 同じ処方を各自で持っていたのでここへ引き上げた。違いは大きさと速さだけなので variant で受ける。
//
// 包む要素を作らず Fragment で2つの span をそのまま並べる — 置き場所の .shot は z-index を
// 持たず DOM 順だけで重なりを決めているため、流れの中に箱を1つ足すと重なり順が変わる。
//
// 位置は呼び出し側の基準要素に対する absolute。押せる要素ではないので読み上げからは外す
// (操作口は親のボタンで、状態は親の aria-label が伝える)
import PlaybackIcon from '@/components/ui/PlaybackIcon'
import styles from './playback-pulse.module.css'

type PlaybackPulseProps = {
  // scene = 場面モーダル(72px)、card = 作品カードのキャプチャ枠(64px)
  variant: 'scene' | 'card'
  paused: boolean
  // 押すたびに変わる番号。パルスの span の key に渡して要素ごと作り直し、
  // 同じアニメーションを頭から再生させる(この部品自体には key を付けない)
  pulseKey: number
}

function PlaybackPulse({ variant, paused, pulseKey }: PlaybackPulseProps) {
  const variantClassName = variant === 'scene' ? styles.scene : styles.card

  return (
    <>
      {/* 押した直後だけ出て消える合図。アイコンは新しい状態を示す(停止直後は▶、再生直後は⏸) */}
      <span key={pulseKey} className={`${styles.pulse} ${variantClassName}`} aria-hidden='true'>
        <PlaybackIcon kind={paused ? 'play' : 'pause'} className={styles.icon} />
      </span>
      {/* 停止中はその状態が続いていることを示し続ける。合図が消えたあとも
          「止まっている」と分かるようにするため、パルスとは別に置く */}
      {paused ? (
        <span className={`${styles.pausedMark} ${variantClassName}`} aria-hidden='true'>
          <PlaybackIcon kind='play' className={styles.icon} />
        </span>
      ) : null}
    </>
  )
}

export default PlaybackPulse
