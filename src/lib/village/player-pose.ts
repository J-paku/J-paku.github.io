// 正面・背面は頭部を固定した二つの歩行コマで軸足を交互にする
import type { MoveState } from './movement'

export const playerPose = (state: MoveState, reduceMotion: boolean) => {
  const walking = !reduceMotion && state.motion !== null && state.motion.progress < 0.5
  const side = state.facing === 'left' || state.facing === 'right'
  const direction = state.facing === 'left' ? 'right' : state.facing
  const frame = walking ? (!side && state.stride === 1 ? 2 : 1) : 0
  return {
    key: `player-${direction}-${frame}`,
    flip: state.facing === 'left',
  }
}
