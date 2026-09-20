// 村のスプライト1枚ぶんの表示位置と、シート内の添字を求める
import type { CSSProperties } from 'react'
import type { SheetLayout } from '@/lib/pixel/art'

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
export type SpriteStyle = CSSProperties & { '--i': number }

// シートに無いキー(存在しない歩行コマなど)は先頭のスプライトへ逃がす
export const spriteIndex = (sheet: SheetLayout, key: string): number => sheet.index[key] ?? 0

export const spriteStyle = (x: number, y: number, i: number): SpriteStyle => ({
  left: `calc(var(--cell) * ${x})`,
  top: `calc(var(--cell) * ${y})`,
  '--i': i,
})
