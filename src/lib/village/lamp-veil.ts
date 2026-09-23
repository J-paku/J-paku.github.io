// 街灯と主人公が今重なっているかの判定。街灯は絵が縦 2 マス(上が灯 lamp-t・下が柱 lamp-b)ある一方、
// 通行不可なのは柱の立つ下のマスだけなので、主人公は灯のある上のマス(笠の裏)を歩いて通れる。
// そのとき画面側は主人公の上へ半透明の街灯を重ねて描く — その「重なっているか」だけをここが答える。
// 絵のマスは facadeCells が唯一の正本で、ここで縦 2 マスを組み立て直さない
import type { Cell, World } from '@content/types/world'
import { facadeCells, type FacadeCell } from './facade'

// 重ねて描く街灯 1 本ぶん。cells は上下 2 マスの絵一式。柱のマスは塞がれていて立てず、
// 立てるのは笠の裏(上のマス)だけだが、そこに立つと頭が 1 つ上のマスへ出る背丈で笠を覆うので、
// 描く側は街灯を上下まとめて 1 本ぶん重ね直す
export type LampVeil = { id: string; cells: readonly FacadeCell[] }

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y

// 主人公が立つマスに街灯の絵が描かれているとき、その街灯の描画マス一式を返す。無ければ null。
// 「頭が半マス上へ出る」を理由に、絵のマスの 1 つ下まで重なりに数えない — 柱のすぐ下のマスに立つ間は
// 今まで通り主人公が街灯より手前に描かれる必要があり、この線引きがこの関数の核心
export const lampVeilAt = (world: World, playerCell: Cell): LampVeil | null => {
  for (const structure of world.structures) {
    if (structure.kind !== 'lamp') continue
    const cells = facadeCells(structure)
    if (cells.some(({ cell }) => sameCell(cell, playerCell))) return { id: structure.id, cells }
  }
  return null
}
