// SceneModalの閉じる(×)・前へ・次への装飾アイコン。色やサイズは親が渡すclassNameで決める
type ControlIconProps = {
  kind: 'close' | 'prev' | 'next'
  className: string
}

function ControlIcon({ kind, className }: ControlIconProps) {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={className}>
      {kind === 'close' ? (
        // 装飾専用の閉じるアイコン。読み上げはボタンの aria-label が担うため aria-hidden
        <path
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          d='M5 5l14 14M19 5L5 19'
        />
      ) : (
        // 装飾専用の前へ/次へアイコン。読み上げはボタンの aria-label が担うため aria-hidden
        <path
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          d={kind === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        />
      )}
    </svg>
  )
}

export default ControlIcon
