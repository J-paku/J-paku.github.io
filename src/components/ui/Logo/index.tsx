// サイトロゴ(public/logo-dark.svg と同じ図形)。色は currentColor で親から受け取る。
// ブート画面と村の見出しが「同じ物体」として動けるよう、両方がこのコンポーネントを描く
type LogoProps = {
  // 読み上げ名(content の profile.name)。ワードマークの文字にも使う
  name: string
  className?: string
  // ブート画面のロゴが着地する先。村の見出しだけ true にする
  bootTarget?: boolean
}

function Logo({ name, className, bootTarget = false }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox='-14.3 -5.66 568.6 224.31'
      role='img'
      aria-label={name}
      data-boot-target={bootTarget ? '' : undefined}
      // ブート画面の script が hydration 前に transform を書くため、属性差分の警告を抑える
      suppressHydrationWarning
    >
      <rect
        x='-9.3'
        y='26.5'
        width='160'
        height='160'
        rx='40'
        fill='none'
        stroke='currentColor'
        strokeWidth='10'
      />
      <g fill='currentColor'>
        <rect x='18' y='58' width='44' height='32' rx='10' />
        <rect x='78' y='58' width='44' height='32' rx='10' />
        <rect x='18' y='122' width='44' height='32' rx='10' />
        <rect x='78' y='122' width='44' height='32' rx='10' />
      </g>
      <rect x='18' y='102' width='104' height='8' rx='4' fill='currentColor' opacity='0.4' />
      <text
        x='186'
        y='106.5'
        fontFamily={`'Segoe UI', 'Helvetica Neue', Arial, sans-serif`}
        fontSize='106'
        fontWeight='700'
        letterSpacing='-2'
        fill='currentColor'
        dominantBaseline='central'
      >
        {name}
      </text>
    </svg>
  )
}

export default Logo
