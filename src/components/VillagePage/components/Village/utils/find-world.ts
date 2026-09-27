// ワールドの一覧から id でワールドを引く。無ければ null
import type { World, WorldSet } from '@content/types/world'

// 添字の型は常に World だが、保存値や移動先 id は実在しないことがあるので存在を確かめる
export const findWorld = (set: WorldSet, id: string): World | null =>
  Object.prototype.hasOwnProperty.call(set.worlds, id) ? set.worlds[id] : null
