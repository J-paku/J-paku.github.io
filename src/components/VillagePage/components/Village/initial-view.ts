// JS前と切り替え直後の見た目を決める。rAFが回り出したら useWalkLoop が実測pxで置き換える
import type { CSSProperties } from 'react'
import type { World } from '@content/types/world'
import type { Sheet } from '@/lib/pixel/art'
import { createMoveState } from '@/lib/village/movement'
import { playerPose } from '@/lib/village/player-pose'
import { cameraOffset, VIEW_COLS, VIEW_ROWS } from './hooks/use-stage-scale'
import { spriteIndex, type SpriteStyle } from './sprite-style'

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type RootStyle = CSSProperties & {
  '--cols': number
  '--rows': number
  '--count': number
}
type FrameStyle = CSSProperties & { '--minimap-w': string; '--minimap-h': string }

// ミニマップは 1 マス 4px + 内側余白と枠で 8px。会話窓はこの幅だけ右を空ける
const MINIMAP_SCALE = 4
const MINIMAP_CHROME = 8

export type InitialView = {
  outdoors: boolean
  rootStyle: RootStyle
  frameStyle: FrameStyle
  worldStyle: CSSProperties
  startPose: ReturnType<typeof playerPose>
  playerStyle: SpriteStyle
  locatorStyle: CSSProperties
  locatorSpriteStyle: SpriteStyle
}

export const initialView = (world: World, sprites: Sheet, reduceMotion: boolean): InitialView => {
  const outdoors = world.kind === 'exterior'
  const rootStyle: RootStyle = {
    '--cols': VIEW_COLS,
    '--rows': VIEW_ROWS,
    '--count': sprites.count,
  }
  const frameStyle: FrameStyle = {
    '--minimap-w': outdoors ? `${world.width * MINIMAP_SCALE + MINIMAP_CHROME}px` : '0px',
    '--minimap-h': outdoors ? `${world.height * MINIMAP_SCALE + MINIMAP_CHROME}px` : '0px',
  }
  const startPose = playerPose(createMoveState(world), reduceMotion)
  const startShift = `translate(calc(var(--cell) * ${world.start.x}), calc(var(--cell) * ${world.start.y}))`
  const playerStyle: SpriteStyle = {
    transform: `${startShift}${startPose.flip ? ' scaleX(-1)' : ''}`,
    '--i': spriteIndex(sprites, startPose.key),
  }
  const locatorStyle: CSSProperties = { transform: startShift }
  const startCam = cameraOffset(world, world.start)
  const worldStyle: CSSProperties = {
    width: `calc(var(--cell) * ${world.width})`,
    height: `calc(var(--cell) * ${world.height})`,
    transform: `translate(calc(var(--cell) * ${-startCam.x}), calc(var(--cell) * ${-startCam.y}))`,
  }
  const locatorSpriteStyle: SpriteStyle = { '--i': spriteIndex(sprites, 'locator') }

  return {
    outdoors,
    rootStyle,
    frameStyle,
    worldStyle,
    startPose,
    playerStyle,
    locatorStyle,
    locatorSpriteStyle,
  }
}
