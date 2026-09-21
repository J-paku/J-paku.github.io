// 正面・背面は頭部を固定した二つの歩行コマで軸足を交互にする。
// 釣っている間は歩行コマではなく竿を持つコマを使う(向きの左右反転は歩行と同じ)
import type { MoveState } from './movement'

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
    reduceMotion || fishingElapsedMs >= 360 ? '' : fishingElapsedMs < 180 ? '-backswing' : '-cast'
  return {
    key: fishing ? `player-fish-${direction}${castFrame}` : `player-${direction}-${frame}`,
    flip: state.facing === 'left',
  }
}
