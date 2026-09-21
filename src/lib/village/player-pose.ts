// 正面・背面は頭部を固定した二つの歩行コマで軸足を交互にする。
// 釣っている間は歩行コマではなく竿を持つコマを使う(向きの左右反転は歩行と同じ)
import type { MoveState } from './movement'

// 竿を振る時間(前半が振りかぶり)。振っている間は竿先が動くので、糸は FishingFloat がこの間だけ隠す
export const FISHING_SWING_MS = 360

export const playerPose = (
  state: MoveState,
  reduceMotion: boolean,
  fishing = false,
  fishingElapsedMs = 0
) => {
  const walking = !reduceMotion && state.motion !== null && state.motion.progress < 0.5
  const side = state.facing === 'left' || state.facing === 'right'
  const direction = state.facing === 'left' ? 'right' : state.facing
  const frame = walking ? (!side && state.stride === 1 ? 2 : 1) : 0
  const castFrame =
    reduceMotion || fishingElapsedMs >= FISHING_SWING_MS
      ? ''
      : fishingElapsedMs < FISHING_SWING_MS / 2
        ? '-backswing'
        : '-cast'
  return {
    key: fishing ? `player-fish-${direction}${castFrame}` : `player-${direction}-${frame}`,
    flip: state.facing === 'left',
  }
}
