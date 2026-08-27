// 各場面のSVGアニメーション1周期の長さ(ms)。各SVGファイルの animation-duration の値をそのまま反映している。
// scene1-camera.svg: 7000 / scene2-register.svg: 8000 / scene3-web.svg: 8000 / scene4-nearby.svg: 6000
// SVG側の周期を変更したら、ここも合わせて更新すること
export const SCENE_ANIMATION_DURATIONS_MS: Record<string, number> = {
  camera: 7000,
  register: 8000,
  web: 8000,
  nearby: 6000,
}

// 上記マップに未登録の場面id向けの既定値
export const DEFAULT_SCENE_ANIMATION_DURATION_MS = 8000
