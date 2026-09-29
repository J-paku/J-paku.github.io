// 歩行ループの部品のテストが共有する入れ物。フックがuseRefで作るWalkFrameStateの初期値と、
// 地形に左右されない草地だけのワールドを作る(実データの町は地形が変わると結果も変わるため)
import type { Structure, Tile, World } from '@content/types/world'
import type { WalkFrameState } from './types'

// use-walk-loopのuseRefと同じ初期値。上書きしたい項目だけを渡す
export const makeFrameState = (overrides: Partial<WalkFrameState> = {}): WalkFrameState => ({
  spriteKey: '',
  fishingTarget: null,
  waitSince: null,
  enteredWorld: null,
  ignoreHeld: false,
  plannedTarget: null,
  staleTarget: false,
  smoothedCam: null,
  paintedWorld: null,
  shift: '',
  lastTransform: '',
  frameWidth: null,
  veilCell: '',
  veilId: '',
  ...overrides,
})

// 全マスが草で歩けるワールド。出発は(3,3)の下向き。構造物は必要なテストだけが渡す
export const makeOpenWorld = (
  id: string,
  width: number,
  height: number,
  structures: Structure[] = []
): World => ({
  id,
  kind: 'exterior',
  width,
  height,
  start: { x: 3, y: 3 },
  startFacing: 'down',
  tiles: Array.from({ length: height }, () => Array.from({ length: width }, (): Tile => 'grass')),
  structures,
  spots: [],
  warps: [],
})
