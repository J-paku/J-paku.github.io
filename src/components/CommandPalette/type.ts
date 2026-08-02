// このコンポーネント専用の型。listboxの1項目とグループの単位を表す
export type CommandGroupKey = 'works' | 'locale' | 'theme' | 'external'

export type CommandItem = {
  id: string
  group: CommandGroupKey
  label: string
  // 検索対象になる文字列群(title・tagline・stack等)。部分一致の対象はここに集約する
  keywords: string[]
  run: () => void
}
