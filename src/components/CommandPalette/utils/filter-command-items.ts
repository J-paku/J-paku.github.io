// クエリ文字列に対し、項目のkeywordsいずれかへの部分一致(大小無視)で絞り込む純粋関数。
// ファジー検索は行わない(仕様: 06-command-palette.md)
import type { CommandItem } from '../type'

export function filterCommandItems(items: CommandItem[], query: string): CommandItem[] {
  const trimmed = query.trim()
  if (trimmed === '') return items

  const needle = trimmed.toLowerCase()
  return items.filter((item) => item.keywords.some((keyword) => keyword.toLowerCase().includes(needle)))
}
