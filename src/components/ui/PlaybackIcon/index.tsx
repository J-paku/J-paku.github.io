// 再生(三角)・一時停止(縦棒2本)の装飾アイコン。WorkCard と SceneModal の
// 中央パルス・停止中の常時印・トグルボタンで共用する。読み上げは親ボタンの aria-label が担うため aria-hidden
type PlaybackIconProps = {
  kind: 'play' | 'pause'
  className: string
}

function PlaybackIcon({ kind, className }: PlaybackIconProps) {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={className}>
      {kind === 'play' ? (
        <path
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M7 5l12 7-12 7z'
        />
      ) : (
        <path
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          d='M8 5v14M16 5v14'
        />
      )}
    </svg>
  )
}

export default PlaybackIcon
