// 絞り込み済み項目をグループ順(作品→言語→テーマ→外部)にまとめる純粋関数。
// 各項目には元の絞り込み済み配列内でのflatIndexを持たせる。
// このindexはaria-activedescendant・自動スクロールの対象特定に使うため、
// useCommandItems側の組み立て順(作品→言語→テーマ→外部)と一致させる
import type { CommandGroupKey, CommandItem } from '../type'

export type CommandItemWithIndex = CommandItem & { flatIndex: number }

export type CommandGroupEntry = {
  group: CommandGroupKey
  items: CommandItemWithIndex[]
}

const GROUP_ORDER: CommandGroupKey[] = ['works', 'locale', 'theme', 'external']

export function groupCommandItems(items: CommandItem[]): CommandGroupEntry[] {
  const withIndex = items.map((item, flatIndex) => ({ ...item, flatIndex }))
  return GROUP_ORDER.map((group) => ({
    group,
    items: withIndex.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length > 0)
}
