// 枠の中に床タイル・建物の正面・目的地の印を並べる地面の層
'use client'

import { memo, useMemo } from 'react'
import type { Cell, World } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { facadeCells } from '@/lib/village/facade'
import { spriteIndex, spriteStyle } from '../../sprite-style'
import styles from '../../scene.module.css'

export type GroundProps = {
  world: World
  sprites: SheetLayout
  destination: Cell | null
}

// 地形と建物は移動・目的地・天候の更新では変わらない。
const Terrain = memo(function Terrain({ world, sprites }: Omit<GroundProps, 'destination'>) {
  const tiles = useMemo(
    () =>
      world.tiles.flatMap((row, y) =>
        row.map((tile, x) => ({
          key: `${x},${y}`,
          style: spriteStyle(x, y, spriteIndex(sprites, tile)),
        }))
      ),
    [world, sprites]
  )

  const facade = useMemo(
    () =>
      world.structures.flatMap(structure =>
        facadeCells(structure).map(({ cell, key }) => ({
          key: `${structure.id}:${cell.x},${cell.y}`,
          style: spriteStyle(cell.x, cell.y, spriteIndex(sprites, key)),
        }))
      ),
    [world, sprites]
  )

  return (
    <>
      {tiles.map(tile => (
        <div key={tile.key} className={styles.sprite} style={tile.style} aria-hidden='true' />
      ))}
      {facade.map(cell => (
        <div key={cell.key} className={styles.sprite} style={cell.style} aria-hidden='true' />
      ))}
    </>
  )
})

export function Ground({ world, sprites, destination }: GroundProps) {
  return (
    <>
      <Terrain world={world} sprites={sprites} />
      {destination !== null ? (
        <div
          className={`${styles.sprite} ${styles.marker}`}
          style={spriteStyle(destination.x, destination.y, spriteIndex(sprites, 'marker'))}
          aria-hidden='true'
        />
      ) : null}
    </>
  )
}

export default Ground
